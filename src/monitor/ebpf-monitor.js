/**
 * eBPF System Call Monitor
 * 
 * Advanced system call monitoring using eBPF (Extended Berkeley Packet Filter).
 * Requires Linux kernel 4.4+ and root privileges.
 * 
 * Features:
 * - Real-time syscall interception
 * - Syscall filtering by type
 * - Argument inspection
 * - Return value monitoring
 * - Performance-optimized kernel-space filtering
 */

import EventEmitter from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import winston from 'winston';

const execAsync = promisify(exec);

export class EBPFMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.pid = options.pid || process.pid;
    this.targetPids = options.targetPids || [];
    this.isRunning = false;
    
    // Syscall categories to monitor
    this.syscallFilters = options.syscallFilters || {
      file: ['open', 'openat', 'read', 'write', 'stat', 'lstat', 'fstat', 'access'],
      network: ['connect', 'accept', 'bind', 'listen', 'sendto', 'recvfrom', 'socket'],
      process: ['execve', 'fork', 'clone', 'exit', 'kill', 'ptrace'],
      memory: ['mmap', 'mprotect', 'munmap', 'brk', 'madvise'],
      security: ['chown', 'chmod', 'setuid', 'setgid', 'setreuid', 'setregid']
    };
    
    // Suspicious syscall patterns
    this.suspiciousPatterns = options.suspiciousPatterns || [
      { syscall: 'execve', severity: 'warning' },
      { syscall: 'fork', severity: 'info' },
      { syscall: 'clone', severity: 'info' },
      { syscall: 'kill', severity: 'warning' },
      { syscall: 'ptrace', severity: 'critical' },
      { syscall: 'setuid', severity: 'critical' },
      { syscall: 'setgid', severity: 'critical' }
    ];
    
    // Logging
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
    
    // Syscall count tracking
    this.syscallCounts = {};
    this.startTime = null;
  }

  /**
   * Check if eBPF is available
   */
  async checkAvailability() {
    try {
      // Check kernel version (need 4.4+)
      const { stdout: kernelVersion } = await execAsync('uname -r');
      const [major, minor] = kernelVersion.split('.').map(Number);
      if (major < 4 || (major === 4 && minor < 4)) {
        throw new Error(`Kernel version ${kernelVersion} too old (need 4.4+)`);
      }
      
      // Check for BCC tools
      await execAsync('which bpftrace').catch(() => {
        throw new Error('bpftrace not found - install via: apt-get install bpftrace');
      });
      
      // Check for root privileges
      if (process.getuid && process.getuid() !== 0) {
        this.logger.warn('Not running as root - some features may be limited');
      }
      
      return true;
    } catch (err) {
      this.logger.error('eBPF not available:', err.message);
      return false;
    }
  }

  /**
   * Start eBPF monitoring
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('eBPF monitor already running');
      return;
    }
    
    const available = await this.checkAvailability();
    if (!available) {
      this.logger.warn('eBPF not available, falling back to procfs monitoring');
      await this.startFallbackMonitoring();
      return;
    }
    
    this.isRunning = true;
    this.startTime = Date.now();
    this.logger.info(`Starting eBPF monitor for PID ${this.pid}`);
    
    // Start bpftrace program
    this.startBPFTrace();
    
    this.emit('start', { pid: this.pid });
  }

  /**
   * Stop eBPF monitoring
   */
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.bpfTraceProcess) {
      this.bpfTraceProcess.kill('SIGTERM');
      this.bpfTraceProcess = null;
    }
    
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
    
    this.logger.info('eBPF monitor stopped');
    this.emit('stop', { pid: this.pid });
  }

  /**
   * Start bpftrace program
   */
  startBPFTrace() {
    const pids = [this.pid, ...this.targetPids].join(',');
    
    // bpftrace program for syscall monitoring
    const bpfScript = `
#!/usr/bin/env bpftrace
#include <linux/sched.h>

BEGIN {
  printf("Starting syscall monitoring for PIDs: ${pids}\\n");
}

tracepoint:syscalls:sys_enter_* {
  $pid = pid;
  $pname = comm;
  
  // Filter by PID
  if ($pid != ${this.pid} && $pid != ${this.targetPids.join(' && $pid != ')}) {
    next;
  }
  
  @syscalls[$pid, $pname, probe] = count();
  @args[$pid, $pname, probe, args->0] = args->0;
  
  // Check for suspicious syscalls
  if (probe == "tracepoint:syscalls:sys_enter_execve") {
    printf("CRITICAL: execve called by PID %d (%s)\\n", $pid, $pname);
  }
  
  if (probe == "tracepoint:syscalls:sys_enter_ptrace") {
    printf("CRITICAL: ptrace called by PID %d (%s)\\n", $pid, $pname);
  }
  
  if (probe == "tracepoint:syscalls:sys_enter_kill") {
    printf("WARNING: kill called by PID %d (%s) with signal %d\\n", $pid, $pname, args->1);
  }
}

interval:s:1 {
  print(@syscalls);
  clear(@syscalls);
}
`;
    
    try {
      this.bpfTraceProcess = exec('bpftrace -e "' + bpfScript.replace(/\n/g, '\\n') + '"', 
        (error, stdout, stderr) => {
          if (error) {
            this.logger.error('bpftrace error:', error);
          }
        }
      );
      
      this.bpfTraceProcess.stdout.on('data', (data) => {
        this.parseBPFTraceOutput(data.toString());
      });
      
      this.bpfTraceProcess.stderr.on('data', (data) => {
        this.logger.warn('bpftrace stderr:', data.toString());
      });
      
      this.bpfTraceProcess.on('exit', (code) => {
        if (this.isRunning) {
          this.logger.warn(`bpftrace exited with code ${code}`);
        }
      });
      
    } catch (err) {
      this.logger.error('Failed to start bpftrace:', err);
      this.startFallbackMonitoring();
    }
  }

  /**
   * Parse bpftrace output
   */
  parseBPFTraceOutput(output) {
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Parse critical alerts
      if (line.includes('CRITICAL:')) {
        const match = line.match(/CRITICAL: (\w+) called by PID (\d+) \((.+?)\)/);
        if (match) {
          const [, syscall, pid, comm] = match;
          this.emit('alert', {
            type: 'syscall',
            severity: 'critical',
            syscall,
            pid: parseInt(pid),
            comm,
            message: `Critical syscall ${syscall} detected from ${comm} (PID ${pid})`
          });
        }
      }
      
      // Parse warnings
      if (line.includes('WARNING:')) {
        const match = line.match(/WARNING: (\w+) called by PID (\d+) \((.+?)\) with signal (\d+)/);
        if (match) {
          const [, syscall, pid, comm, signal] = match;
          this.emit('alert', {
            type: 'syscall',
            severity: 'warning',
            syscall,
            pid: parseInt(pid),
            comm,
            signal: parseInt(signal),
            message: `Warning: ${syscall}(${signal}) from ${comm} (PID ${pid})`
          });
        }
      }
      
      // Parse syscall counts
      if (line.includes('@syscalls[')) {
        const match = line.match(/@syscalls\[(\d+), (.+?), tracepoint:syscalls:sys_enter_(\w+)\]: (\d+)/);
        if (match) {
          const [, pid, comm, syscall, count] = match;
          this.emit('syscall', {
            pid: parseInt(pid),
            comm,
            syscall,
            count: parseInt(count)
          });
          
          // Update counts
          const key = `${pid}:${syscall}`;
          this.syscallCounts[key] = (this.syscallCounts[key] || 0) + parseInt(count);
        }
      }
    }
  }

  /**
   * Fallback monitoring using /proc filesystem
   */
  async startFallbackMonitoring() {
    this.logger.info('Starting fallback monitoring using /proc filesystem');
    
    this.fallbackInterval = setInterval(async () => {
      await this.collectProcStats();
    }, 1000);
  }

  /**
   * Collect statistics from /proc
   */
  async collectProcStats() {
    const pids = [this.pid, ...this.targetPids];
    
    for (const pid of pids) {
      try {
        // Read syscall counts
        const { stdout: status } = await execAsync(`cat /proc/${pid}/status 2>/dev/null`);
        
        const voluntaryMatch = status.match(/voluntary_ctxt_switches:\s+(\d+)/);
        const nonVoluntaryMatch = status.match(/nonvoluntary_ctxt_switches:\s+(\d+)/);
        
        const voluntary = voluntaryMatch ? parseInt(voluntaryMatch[1]) : 0;
        const nonVoluntary = nonVoluntaryMatch ? parseInt(nonVoluntaryMatch[1]) : 0;
        
        this.emit('syscall', {
          pid,
          comm: await this.getProcessName(pid),
          syscall: 'context_switch',
          count: voluntary + nonVoluntary
        });
        
      } catch (err) {
        // Process may have exited
        continue;
      }
    }
  }

  /**
   * Get process name from PID
   */
  async getProcessName(pid) {
    try {
      const { stdout } = await execAsync(`cat /proc/${pid}/comm 2>/dev/null`);
      return stdout.trim();
    } catch (err) {
      return 'unknown';
    }
  }

  /**
   * Get syscall statistics
   */
  getSyscallStats() {
    return {
      counts: this.syscallCounts,
      startTime: this.startTime,
      uptime: this.startTime ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Check for suspicious activity
   */
  checkSuspiciousActivity() {
    const alerts = [];
    const timeElapsed = (Date.now() - this.startTime) / 1000; // seconds
    
    // Check syscall frequency
    for (const [key, count] of Object.entries(this.syscallCounts)) {
      const frequency = count / timeElapsed; // syscalls per second
      
      // Check suspicious patterns
      const [pid, syscall] = key.split(':');
      const pattern = this.suspiciousPatterns.find(p => p.syscall === syscall);
      
      if (pattern && count > 0) {
        alerts.push({
          ...pattern,
          pid: parseInt(pid),
          count,
          frequency: frequency.toFixed(2),
          message: `${pattern.severity}: ${syscall} called ${count} times (${frequency.toFixed(2)}/s)`
        });
      }
      
      // Check for excessive syscall rate
      if (frequency > 1000) {
        alerts.push({
          severity: 'warning',
          pid: parseInt(pid),
          syscall,
          count,
          frequency: frequency.toFixed(2),
          message: `Excessive syscall rate: ${syscall} at ${frequency.toFixed(2)}/s`
        });
      }
    }
    
    return alerts;
  }
}

export default EBPFMonitor;
