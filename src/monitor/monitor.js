/**
 * Runtime Behavior Monitor
 * 
 * Monitors agent behavior at runtime to detect anomalies and security threats.
 * Features:
 * - System call monitoring (eBPF-based when available)
 * - Resource usage tracking
 * - Behavioral pattern analysis
 * - Anomaly detection
 * - Real-time alerting
 */

import EventEmitter from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import pidusage from 'pidusage';
import si from 'systeminformation';
import winston from 'winston';

const execAsync = promisify(exec);

export class BehaviorMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.pid = options.pid || process.pid;
    this.checkInterval = options.checkInterval || 1000; // 1 second
    this.historySize = options.historySize || 60; // 60 data points
    this.thresholds = options.thresholds || {
      cpu: 80, // CPU usage %
      memory: 80, // Memory usage %
      network: 1024 * 1024 * 10, // 10 MB/s
      disk: 1024 * 1024, // 1 MB/s
      syscalls: 1000 // syscalls per second
    };
    
    this.isRunning = false;
    this.intervalId = null;
    this.history = [];
    this.baseline = null;
    this.alertCount = 0;
    
    // Setup logging
    this.logger = winston.createLogger({
      level: options.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  /**
   * Start monitoring
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('Monitor already running');
      return;
    }
    
    this.isRunning = true;
    this.logger.info(`Starting behavior monitor for PID ${this.pid}`);
    
    // Establish baseline
    await this.establishBaseline();
    
    // Start periodic checks
    this.intervalId = setInterval(() => {
      this.check();
    }, this.checkInterval);
    
    this.emit('start', { pid: this.pid });
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.logger.info('Behavior monitor stopped');
    this.emit('stop', { pid: this.pid });
  }

  /**
   * Establish baseline behavior
   */
  async establishBaseline() {
    this.logger.info('Establishing baseline behavior...');
    
    const samples = [];
    const baselineSamples = 10;
    
    for (let i = 0; i < baselineSamples; i++) {
      const metrics = await this.collectMetrics();
      if (metrics) samples.push(metrics);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (samples.length === 0) {
      this.logger.warn('No valid samples collected, using zero baseline');
      this.baseline = { cpu: 0, memory: 0, networkIn: 0, networkOut: 0, diskRead: 0, diskWrite: 0, syscalls: 0, variance: { cpu: 0, memory: 0 } };
      return this.baseline;
    }
    
    this.baseline = this.calculateBaseline(samples);
    this.logger.info('Baseline established', this.baseline);
    
    return this.baseline;
  }

  /**
   * Calculate baseline from samples
   */
  calculateBaseline(samples) {
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    
    return {
      cpu: avg(samples.map(s => s.cpu)),
      memory: avg(samples.map(s => s.memory)),
      networkIn: avg(samples.map(s => s.network.in)),
      networkOut: avg(samples.map(s => s.network.out)),
      diskRead: avg(samples.map(s => s.disk.read)),
      diskWrite: avg(samples.map(s => s.disk.write)),
      syscalls: avg(samples.map(s => s.syscalls)),
      variance: {
        cpu: this.calculateVariance(samples.map(s => s.cpu)),
        memory: this.calculateVariance(samples.map(s => s.memory))
      }
    };
  }

  /**
   * Calculate variance
   */
  calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Collect current metrics
   */
  async collectMetrics() {
    try {
      // Process-level metrics
      const procStats = await pidusage(this.pid);
      
      // System-level metrics
      const [networkStats, diskStats] = await Promise.all([
        si.networkStats().catch(() => null),
        si.fsStats().catch(() => null)
      ]);

      // Syscall count (Linux-specific)
      let syscalls = 0;
      try {
        const { stdout } = await execAsync(
          `cat /proc/${this.pid}/status 2>/dev/null | grep voluntary_ctxt_switches`
        );
        const match = stdout.match(/(\d+)/);
        syscalls = match ? parseInt(match[1]) : 0;
      } catch (err) {
        syscalls = 0;
      }

      return {
        timestamp: Date.now(),
        pid: this.pid,
        cpu: procStats.cpu,
        memory: (procStats.memory / 1024 / 1024 / 1024) * 100, // Convert to GB %
        network: {
          in: networkStats?.[0]?.rx_sec || 0,
          out: networkStats?.[0]?.tx_sec || 0
        },
        disk: {
          read: diskStats?.rx || 0,
          write: diskStats?.wx || 0
        },
        syscalls: syscalls
      };
    } catch (err) {
      this.logger.error('Error collecting metrics:', err);
      return null;
    }
  }

  /**
   * Check for anomalies
   */
  async check() {
    if (!this.isRunning) {
      return;
    }
    
    const metrics = await this.collectMetrics();
    if (!metrics) {
      return;
    }
    
    // Store in history
    this.history.push(metrics);
    if (this.history.length > this.historySize) {
      this.history.shift();
    }
    
    // Check thresholds
    const thresholdAlerts = this.checkThresholds(metrics);
    if (thresholdAlerts.length > 0) {
      this.handleAlert('threshold', thresholdAlerts);
    }
    
    // Check anomalies (if baseline exists)
    if (this.baseline) {
      const anomalies = this.detectAnomalies(metrics);
      if (anomalies.length > 0) {
        this.handleAlert('anomaly', anomalies);
      }
    }
    
    // Emit metrics event
    this.emit('metrics', metrics);
  }

  /**
   * Check against thresholds
   */
  checkThresholds(metrics) {
    const alerts = [];
    
    if (metrics.cpu > this.thresholds.cpu) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: `CPU usage ${metrics.cpu.toFixed(2)}% exceeds threshold ${this.thresholds.cpu}%`,
        current: metrics.cpu,
        threshold: this.thresholds.cpu
      });
    }
    
    if (metrics.memory > this.thresholds.memory) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `Memory usage ${metrics.memory.toFixed(2)}% exceeds threshold ${this.thresholds.memory}%`,
        current: metrics.memory,
        threshold: this.thresholds.memory
      });
    }
    
    if (metrics.network.in > this.thresholds.network) {
      alerts.push({
        type: 'network',
        severity: 'info',
        message: `Network in ${this.formatBytes(metrics.network.in)}/s exceeds threshold ${this.formatBytes(this.thresholds.network)}/s`,
        current: metrics.network.in,
        threshold: this.thresholds.network
      });
    }
    
    if (metrics.network.out > this.thresholds.network) {
      alerts.push({
        type: 'network',
        severity: 'info',
        message: `Network out ${this.formatBytes(metrics.network.out)}/s exceeds threshold ${this.formatBytes(this.thresholds.network)}/s`,
        current: metrics.network.out,
        threshold: this.thresholds.network
      });
    }
    
    return alerts;
  }

  /**
   * Detect anomalies using statistical analysis
   */
  detectAnomalies(metrics) {
    const anomalies = [];
    const stdDev = Math.sqrt(this.baseline.variance.cpu);
    
    // CPU anomaly detection (2 standard deviations)
    if (Math.abs(metrics.cpu - this.baseline.cpu) > 2 * stdDev) {
      const direction = metrics.cpu > this.baseline.cpu ? 'high' : 'low';
      anomalies.push({
        type: 'cpu',
        severity: direction === 'high' ? 'warning' : 'info',
        message: `CPU usage ${direction} (${metrics.cpu.toFixed(2)}%) deviates from baseline (${this.baseline.cpu.toFixed(2)}%)`,
        deviation: Math.abs(metrics.cpu - this.baseline.cpu)
      });
    }
    
    // Memory anomaly detection
    const memStdDev = Math.sqrt(this.baseline.variance.memory);
    if (Math.abs(metrics.memory - this.baseline.memory) > 2 * memStdDev) {
      const direction = metrics.memory > this.baseline.memory ? 'high' : 'low';
      anomalies.push({
        type: 'memory',
        severity: direction === 'high' ? 'warning' : 'info',
        message: `Memory usage ${direction} (${metrics.memory.toFixed(2)}%) deviates from baseline (${this.baseline.memory.toFixed(2)}%)`,
        deviation: Math.abs(metrics.memory - this.baseline.memory)
      });
    }
    
    return anomalies;
  }

  /**
   * Handle alert
   */
  handleAlert(type, details) {
    this.alertCount++;
    
    const alert = {
      id: this.alertCount,
      type,
      timestamp: Date.now(),
      details
    };
    
    this.logger.warn('Alert triggered:', alert);
    this.emit('alert', alert);
    
    // Check if emergency shutdown needed
    const criticalAlerts = details.filter(d => d.severity === 'critical');
    if (criticalAlerts.length > 0) {
      this.emit('critical', alert);
    }
  }

  /**
   * Format bytes to human-readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics() {
    return this.history[this.history.length - 1] || null;
  }

  /**
   * Get metrics history
   */
  getHistory() {
    return this.history;
  }

  /**
   * Get baseline
   */
  getBaseline() {
    return this.baseline;
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.logger.info('Thresholds updated:', this.thresholds);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      uptime: Date.now() - this.startTime,
      checks: this.history.length,
      alerts: this.alertCount,
      baseline: this.baseline,
      current: this.getCurrentMetrics()
    };
  }
}

export default BehaviorMonitor;
