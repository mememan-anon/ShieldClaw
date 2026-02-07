/**
 * eBPF Loader
 * Loads and manages eBPF programs for syscall monitoring
 * Note: This is a stub implementation. Real eBPF requires:
 * - bpf() syscall access (requires CAP_BPF or root)
 * - Compiled eBPF bytecode (.o files)
 * - libbpf or bcc library
 */

import { createLogger } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class EBPFLoader {
  constructor(options = {}) {
    this.logger = createLogger({ name: 'ebpf-loader', ...options });
    
    // eBPF program directory
    this.programDir = options.programDir || './src/container/ebpf-programs';
    
    // Loaded programs
    this.programs = new Map();
    
    // Check if eBPF is available
    this.ebpfAvailable = false;
    this.checkEBPFAvailability();
  }

  /**
   * Check if eBPF is available on the system
   */
  async checkEBPFAvailability() {
    try {
      // Check kernel version (eBPF requires 3.18+)
      const { stdout } = await execAsync('uname -r');
      const version = parseFloat(stdout.trim().split('-')[0]);

      if (version < 3.18) {
        this.logger.warn(`eBPF not available: kernel version ${version} < 3.18`);
        this.ebpfAvailable = false;
        return;
      }

      // Check if bpf() syscall is available
      await execAsync('ls /proc/sys/kernel/unprivileged_bpf_disabled');
      
      // Try to check bpftool
      try {
        await execAsync('bpftool version');
        this.ebpfAvailable = true;
        this.logger.info('eBPF is available on this system');
      } catch {
        this.logger.warn('bpftool not found, eBPF may not be fully available');
        this.ebpfAvailable = false;
      }

    } catch (error) {
      this.logger.warn('eBPF availability check failed:', error.message);
      this.ebpfAvailable = false;
    }
  }

  /**
   * Load eBPF program
   */
  async loadProgram(name, programData) {
    if (!this.ebpfAvailable) {
      this.logger.warn('eBPF not available, cannot load program');
      return false;
    }

    try {
      this.logger.info(`Loading eBPF program: ${name}`);

      // In a real implementation, this would:
      // 1. Parse the eBPF bytecode
      // 2. Use bpf() syscall to load the program
      // 3. Get a file descriptor for the program
      // 4. Attach to appropriate hooks (tracepoints, kprobes, etc.)

      // Stub implementation
      const program = {
        name,
        loaded: true,
        fd: Math.floor(Math.random() * 1000),
        attached: false,
        stats: {
          hits: 0,
          drops: 0
        }
      };

      this.programs.set(name, program);
      this.logger.info(`eBPF program loaded: ${name}`);

      return program;

    } catch (error) {
      this.logger.error(`Failed to load eBPF program: ${name}`, error);
      throw error;
    }
  }

  /**
   * Load program from file
   */
  async loadProgramFromFile(filePath, name) {
    if (!this.ebpfAvailable) {
      this.logger.warn('eBPF not available, cannot load program');
      return false;
    }

    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(filePath);
      
      const programName = name || filePath.split('/').pop();
      return await this.loadProgram(programName, data);

    } catch (error) {
      this.logger.error(`Failed to load eBPF program from file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Attach eBPF program to a hook point
   */
  async attachProgram(name, hookType, hookPoint) {
    const program = this.programs.get(name);

    if (!program) {
      throw new Error(`Program not found: ${name}`);
    }

    try {
      this.logger.info(`Attaching eBPF program ${name} to ${hookType}:${hookPoint}`);

      // Hook types:
      // - tracepoint: kernel tracepoints
      // - kprobe: kernel function entry
      // - kretprobe: kernel function return
      // - raw_tracepoint: raw tracepoint
      // - cgroup: cgroup hooks
      // - socket: socket filters

      // Stub implementation
      program.attached = true;
      program.hookType = hookType;
      program.hookPoint = hookPoint;

      this.logger.info(`eBPF program attached: ${name} -> ${hookPoint}`);

      return true;

    } catch (error) {
      this.logger.error(`Failed to attach eBPF program: ${name}`, error);
      throw error;
    }
  }

  /**
   * Detach eBPF program
   */
  async detachProgram(name) {
    const program = this.programs.get(name);

    if (!program) {
      throw new Error(`Program not found: ${name}`);
    }

    try {
      this.logger.info(`Detaching eBPF program: ${name}`);

      // Close file descriptor and detach
      program.attached = false;
      program.hookType = null;
      program.hookPoint = null;

      this.logger.info(`eBPF program detached: ${name}`);

      return true;

    } catch (error) {
      this.logger.error(`Failed to detach eBPF program: ${name}`, error);
      throw error;
    }
  }

  /**
   * Unload eBPF program
   */
  async unloadProgram(name) {
    const program = this.programs.get(name);

    if (!program) {
      throw new Error(`Program not found: ${name}`);
    }

    try {
      this.logger.info(`Unloading eBPF program: ${name}`);

      // Detach if attached
      if (program.attached) {
        await this.detachProgram(name);
      }

      // Close file descriptor
      program.loaded = false;

      this.programs.delete(name);

      this.logger.info(`eBPF program unloaded: ${name}`);

      return true;

    } catch (error) {
      this.logger.error(`Failed to unload eBPF program: ${name}`, error);
      throw error;
    }
  }

  /**
   * Read eBPF map
   */
  async readMap(programName, mapName) {
    if (!this.ebpfAvailable) {
      return {};
    }

    try {
      this.logger.debug(`Reading eBPF map: ${programName}/${mapName}`);

      // Stub implementation - would use bpf() syscall to read map data
      return {
        entries: 0,
        data: {}
      };

    } catch (error) {
      this.logger.error(`Failed to read eBPF map: ${mapName}`, error);
      throw error;
    }
  }

  /**
   * Update eBPF map
   */
  async updateMap(programName, mapName, key, value) {
    if (!this.ebpfAvailable) {
      return false;
    }

    try {
      this.logger.debug(`Updating eBPF map: ${programName}/${mapName}`);

      // Stub implementation - would use bpf() syscall to update map
      return true;

    } catch (error) {
      this.logger.error(`Failed to update eBPF map: ${mapName}`, error);
      throw error;
    }
  }

  /**
   * Get program statistics
   */
  async getProgramStats(name) {
    const program = this.programs.get(name);

    if (!program) {
      throw new Error(`Program not found: ${name}`);
    }

    try {
      // Stub implementation - would read eBPF stats
      return {
        name: program.name,
        loaded: program.loaded,
        attached: program.attached,
        hookType: program.hookType,
        hookPoint: program.hookPoint,
        stats: program.stats,
        runtime: Date.now() - (program.loadedAt || Date.now())
      };

    } catch (error) {
      this.logger.error(`Failed to get program stats: ${name}`, error);
      throw error;
    }
  }

  /**
   * Get all loaded programs
   */
  getLoadedPrograms() {
    return Array.from(this.programs.entries()).map(([name, program]) => ({
      name,
      loaded: program.loaded,
      attached: program.attached,
      hookType: program.hookType,
      hookPoint: program.hookPoint
    }));
  }

  /**
   * Create syscall monitoring program
   */
  async createSyscallMonitor(syscalls = []) {
    if (!this.ebpfAvailable) {
      this.logger.warn('eBPF not available, using fallback monitoring');
      return null;
    }

    try {
      this.logger.info('Creating syscall monitor');

      // In a real implementation, this would compile C code to eBPF bytecode
      const programCode = this.generateSyscallMonitorCode(syscalls);
      
      // Load and attach
      await this.loadProgram('syscall-monitor', Buffer.from(programCode));
      await this.attachProgram('syscall-monitor', 'tracepoint', 'syscalls:sys_enter_execve');

      return 'syscall-monitor';

    } catch (error) {
      this.logger.error('Failed to create syscall monitor', error);
      return null;
    }
  }

  /**
   * Generate eBPF program code (stub)
   */
  generateSyscallMonitorCode(syscalls) {
    // This is placeholder code that would be compiled to eBPF bytecode
    // Real implementation would compile C code using clang/bpf-elf
    return `
      // eBPF syscall monitor program
      #include <linux/bpf.h>
      #include <linux/ptrace.h>
      #include <linux/sched.h>
      
      struct syscalls_event_t {
        __u32 pid;
        __u32 uid;
        char comm[16];
        __u64 syscall;
      };
      
      struct bpf_map_def SEC("maps") syscalls_events = {
        .type = BPF_MAP_TYPE_PERF_EVENT_ARRAY,
        .key_size = sizeof(__u32),
        .value_size = sizeof(__u32),
        .max_entries = 1024,
      };
      
      SEC("tracepoint/syscalls/sys_enter_execve")
      int trace_execve(struct trace_event_raw_sys_enter* ctx) {
        struct syscalls_event_t event = {};
        event.pid = bpf_get_current_pid_tgid() >> 32;
        event.uid = bpf_get_current_uid_gid();
        bpf_get_current_comm(&event.comm, sizeof(event.comm));
        event.syscall = ctx->id;
        bpf_perf_event_output(ctx, &syscalls_events, BPF_F_CURRENT_CPU, &event, sizeof(event));
        return 0;
      }
      
      char _license[] SEC("license") = "GPL";
    `;
  }

  /**
   * Cleanup all loaded programs
   */
  async cleanup() {
    this.logger.info('Cleaning up eBPF programs...');

    const programNames = Array.from(this.programs.keys());

    for (const name of programNames) {
      try {
        await this.unloadProgram(name);
      } catch (error) {
        this.logger.warn(`Failed to unload program: ${name}`, error);
      }
    }

    this.logger.info('eBPF cleanup completed');
  }

  /**
   * Check if eBPF is available
   */
  isAvailable() {
    return this.ebpfAvailable;
  }

  /**
   * Get system information
   */
  async getSystemInfo() {
    try {
      const { stdout: kernelVersion } = await execAsync('uname -r');
      const { stdout: arch } = await execAsync('uname -m');

      return {
        kernelVersion: kernelVersion.trim(),
        architecture: arch.trim(),
        ebpfAvailable: this.ebpfAvailable,
        loadedPrograms: this.programs.size
      };

    } catch (error) {
      this.logger.error('Failed to get system info', error);
      return { error: error.message };
    }
  }
}

export default EBPFLoader;
