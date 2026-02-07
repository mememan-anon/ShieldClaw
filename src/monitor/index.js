/**
 * Runtime Behavior Monitor - Main Entry Point
 * 
 * Provides comprehensive runtime monitoring including:
 * - Process behavior monitoring
 * - System call tracking (eBPF + fallback)
 * - Resource usage tracking
 * - Anomaly detection
 * - Real-time alerting
 */

import { BehaviorMonitor } from './monitor.js';
import { EBPFMonitor } from './ebpf-monitor.js';

export { BehaviorMonitor, EBPFMonitor };

export default class MonitorManager {
  constructor(options = {}) {
    this.pid = options.pid || process.pid;
    this.options = options;
    
    this.behaviorMonitor = new BehaviorMonitor({
      pid: this.pid,
      checkInterval: options.checkInterval,
      historySize: options.historySize,
      thresholds: options.thresholds,
      logLevel: options.logLevel
    });
    
    this.ebpfMonitor = new EBPFMonitor({
      pid: this.pid,
      targetPids: options.targetPids,
      syscallFilters: options.syscallFilters,
      suspiciousPatterns: options.suspiciousPatterns,
      logLevel: options.logLevel
    });
    
    this.alerts = [];
    
    // Setup event forwarding
    this.setupEventForwarding();
  }

  /**
   * Setup event forwarding from monitors to manager
   */
  setupEventForwarding() {
    // Forward behavior monitor events
    this.behaviorMonitor.on('alert', (alert) => {
      this.alerts.push({ ...alert, source: 'behavior' });
      this.emit('alert', { ...alert, source: 'behavior' });
    });
    
    this.behaviorMonitor.on('critical', (alert) => {
      this.emit('critical', { ...alert, source: 'behavior' });
    });
    
    // Forward eBPF monitor events
    this.ebpfMonitor.on('alert', (alert) => {
      this.alerts.push({ ...alert, source: 'ebpf' });
      this.emit('alert', { ...alert, source: 'ebpf' });
    });
    
    this.ebpfMonitor.on('syscall', (data) => {
      this.emit('syscall', data);
    });
  }

  /**
   * Start all monitors
   */
  async start() {
    console.log(`🔍 Starting ShieldClaw Monitor for PID ${this.pid}`);
    
    // Start behavior monitor
    await this.behaviorMonitor.start();
    console.log('✅ Behavior monitor started');
    
    // Start eBPF monitor (will fall back if not available)
    await this.ebpfMonitor.start();
    console.log('✅ eBPF monitor started (or fallback enabled)');
    
    console.log('🎯 All monitors active - watching for suspicious activity...\n');
  }

  /**
   * Stop all monitors
   */
  stop() {
    this.behaviorMonitor.stop();
    this.ebpfMonitor.stop();
    console.log('🛑 All monitors stopped');
  }

  /**
   * Get combined statistics
   */
  getStatistics() {
    return {
      pid: this.pid,
      behavior: this.behaviorMonitor.getStatistics(),
      ebpf: this.ebpfMonitor.getSyscallStats(),
      alerts: this.alerts
    };
  }

  /**
   * Print current status
   */
  printStatus() {
    const stats = this.getStatistics();
    const metrics = stats.behavior.current;
    
    console.log('\n📊 Current Status:');
    console.log('─'.repeat(50));
    console.log(`PID: ${this.pid}`);
    console.log(`Uptime: ${Math.floor(stats.behavior.uptime / 1000)}s`);
    console.log(`Checks performed: ${stats.behavior.checks}`);
    console.log(`Alerts triggered: ${this.alerts.length}`);
    
    if (metrics) {
      console.log('\n📈 Resource Usage:');
      console.log(`  CPU: ${metrics.cpu.toFixed(2)}%`);
      console.log(`  Memory: ${metrics.memory.toFixed(2)}%`);
      console.log(`  Network In: ${(metrics.network.in / 1024).toFixed(2)} KB/s`);
      console.log(`  Network Out: ${(metrics.network.out / 1024).toFixed(2)} KB/s`);
      console.log(`  Syscalls: ${metrics.syscalls}`);
    }
    
    if (stats.behavior.baseline) {
      console.log('\n📏 Baseline:');
      console.log(`  CPU: ${stats.behavior.baseline.cpu.toFixed(2)}%`);
      console.log(`  Memory: ${stats.behavior.baseline.memory.toFixed(2)}%`);
    }
    
    console.log('');
  }
}

// If run directly, start monitoring
if (import.meta.url === `file://${process.argv[1]}`) {
  const manager = new MonitorManager({
    checkInterval: 1000,
    thresholds: {
      cpu: 80,
      memory: 80,
      network: 1024 * 1024 * 10,
      disk: 1024 * 1024
    }
  });
  
  // Start monitoring
  manager.start();
  
  // Print status every 10 seconds
  setInterval(() => {
    manager.printStatus();
  }, 10000);
  
  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    manager.stop();
    process.exit(0);
  });
  
  // Keep process alive
  process.stdin.resume();
}
