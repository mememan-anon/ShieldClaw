/**
 * Isolated Executor Environment
 * Provides sandboxed execution environment for skills with resource limits
 */

import Docker from 'dockerode';
import { createLogger, logSecurityEvent } from '../utils/logger.js';
import { generateKey } from '../utils/crypto.js';
import { createTempDir, cleanupTempDir, safeExists } from '../utils/filesystem.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class IsolatedExecutor {
  constructor(options = {}) {
    this.logger = createLogger({ name: 'isolated-executor', ...options });
    
    // Docker configuration
    this.docker = new Docker(options.docker || { socketPath: '/var/run/docker.sock' });
    this.defaultImage = options.defaultImage || 'node:22-alpine';
    this.containerPrefix = options.containerPrefix || 'shieldclaw-';
    
    // Resource limits
    this.resourceLimits = options.resourceLimits || {
      memory: '512m',
      cpus: '0.5',
      diskQuota: '1g'
    };
    
    // Network restrictions
    this.networkEnabled = options.networkEnabled !== false;
    this.networkMode = options.networkMode || 'none'; // 'none', 'bridge', 'host'
    this.allowedHosts = options.allowedHosts || [];
    
    // Runtime options
    this.timeout = options.timeout || 30000; // 30 seconds
    this.autoCleanup = options.autoCleanup !== false;
    this.activeContainers = new Map();
  }

  /**
   * Execute a skill in isolated environment
   */
  async execute(skillName, skillCode, options = {}) {
    const executionId = generateKey(8);
    const containerName = `${this.containerPrefix}${skillName}-${executionId}`;
    
    const executionResult = {
      executionId,
      skillName,
      containerName,
      success: false,
      output: null,
      error: null,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      resourceUsage: null
    };

    let container = null;
    let tempDir = null;

    try {
      this.logger.info(`Starting execution: ${skillName} (${executionId})`);

      // Create temporary directory
      tempDir = await createTempDir();

      // Write skill code to temp file
      const skillFile = `${tempDir}/skill.js`;
      await this.writeSkillFile(skillFile, skillCode);

      // Create container
      container = await this.createContainer(containerName, skillFile, options);
      
      this.logger.info(`Created container: ${containerName}`);
      logSecurityEvent(this.logger, {
        type: 'container_created',
        severity: 'info',
        source: 'isolated-executor',
        target: containerName,
        details: { skillName, executionId }
      });

      // Track container
      this.activeContainers.set(containerName, {
        container,
        executionId,
        startTime: Date.now()
      });

      // Start container
      await container.start();
      this.logger.info(`Started container: ${containerName}`);

      // Wait for completion
      const output = await this.waitForCompletion(container, this.timeout);
      
      executionResult.output = output;
      executionResult.success = output.exitCode === 0;

      // Get resource usage
      executionResult.resourceUsage = await this.getResourceUsage(container);

      executionResult.endTime = Date.now();
      executionResult.duration = executionResult.endTime - executionResult.startTime;

      this.logger.info(`Execution completed: ${executionId}, success=${executionResult.success}`);

      return executionResult;

    } catch (error) {
      executionResult.error = error.message;
      executionResult.success = false;
      executionResult.endTime = Date.now();
      executionResult.duration = executionResult.endTime - executionResult.startTime;

      this.logger.error(`Execution failed: ${executionId}`, error);
      
      logSecurityEvent(this.logger, {
        type: 'execution_failed',
        severity: 'warning',
        source: 'isolated-executor',
        target: containerName,
        details: { error: error.message, skillName, executionId }
      });

      return executionResult;

    } finally {
      // Cleanup
      if (container && this.autoCleanup) {
        await this.cleanupContainer(container, containerName);
      }

      if (tempDir) {
        await cleanupTempDir(tempDir);
      }

      this.activeContainers.delete(containerName);
    }
  }

  /**
   * Write skill code to file
   */
  async writeSkillFile(filePath, code) {
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, code, 'utf-8');
  }

  /**
   * Create container
   */
  async createContainer(name, skillFile, options = {}) {
    const hostConfig = {
      NetworkMode: this.networkMode,
      Binds: [
        `${skillFile}:/app/skill.js:ro`,
        `${options.workDir || '/tmp'}:/app/workspace:rw`
      ],
      Memory: this.parseMemoryLimit(this.resourceLimits.memory),
      CpuShares: this.parseCpuLimit(this.resourceLimits.cpus),
      ReadonlyRootfs: options.readonlyRootfs || false,
      AutoRemove: this.autoCleanup
    };

    // Security options
    const securityOpts = [
      'no-new-privileges',
      'seccomp=default',
      'apparmor=docker-default'
    ];

    // Create container
    const container = await this.docker.createContainer({
      name,
      Image: options.image || this.defaultImage,
      Cmd: ['node', '/app/skill.js'],
      WorkingDir: '/app',
      HostConfig: hostConfig,
      SecurityOpt: securityOpts,
      User: 'nobody', // Run as non-root user
      Env: options.env || [
        'NODE_ENV=production',
        'SHIELDCLAW_EXECUTION=true'
      ],
      Labels: {
        'shieldclaw.enabled': 'true',
        'shieldclaw.skill': options.skillName || 'unknown'
      }
    });

    return container;
  }

  /**
   * Wait for container completion
   */
  async waitForCompletion(container, timeout) {
    const startTime = Date.now();
    const maxWaitTime = timeout || this.timeout;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        container.stop().catch(() => {});
        reject(new Error('Execution timeout'));
      }, maxWaitTime);

      container.attach({ stream: true, stdout: true, stderr: true }, (err, stream) => {
        if (err) {
          clearTimeout(timeoutId);
          return reject(err);
        }

        let output = '';
        let errorOutput = '';

        stream.on('data', (chunk) => {
          output += chunk.toString();
        });

        container.wait((err, data) => {
          clearTimeout(timeoutId);
          
          if (err) {
            return reject(err);
          }

          resolve({
            exitCode: data.StatusCode,
            output,
            errorOutput,
            duration: Date.now() - startTime
          });
        });
      });
    });
  }

  /**
   * Get resource usage
   */
  async getResourceUsage(container) {
    try {
      const stats = await container.stats({ stream: false });
      
      return {
        cpu: this.parseCpuUsage(stats),
        memory: this.parseMemoryUsage(stats),
        network: this.parseNetworkUsage(stats),
        blockIO: this.parseBlockIO(stats)
      };
    } catch (error) {
      this.logger.warn('Failed to get resource usage:', error);
      return null;
    }
  }

  /**
   * Parse CPU usage
   */
  parseCpuUsage(stats) {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
    
    return Math.round(cpuPercent * 100) / 100;
  }

  /**
   * Parse memory usage
   */
  parseMemoryUsage(stats) {
    const usage = stats.memory_stats.usage;
    const limit = stats.memory_stats.limit;
    const percent = (usage / limit) * 100;
    
    return {
      used: usage,
      limit,
      percent: Math.round(percent * 100) / 100
    };
  }

  /**
   * Parse network usage
   */
  parseNetworkUsage(stats) {
    const networks = stats.networks || {};
    
    let totalRx = 0;
    let totalTx = 0;
    
    for (const [name, data] of Object.entries(networks)) {
      totalRx += data.rx_bytes;
      totalTx += data.tx_bytes;
    }
    
    return {
      rx: totalRx,
      tx: totalTx,
      interfaces: Object.keys(networks)
    };
  }

  /**
   * Parse block I/O
   */
  parseBlockIO(stats) {
    const ioStats = stats.blkio_stats || {};
    const ioServiceBytes = ioStats.io_service_bytes_recursive || [];
    
    let readBytes = 0;
    let writeBytes = 0;
    
    for (const entry of ioServiceBytes) {
      if (entry.op === 'read') {
        readBytes += entry.value;
      } else if (entry.op === 'write') {
        writeBytes += entry.value;
      }
    }
    
    return { read: readBytes, write: writeBytes };
  }

  /**
   * Parse memory limit
   */
  parseMemoryLimit(limit) {
    const match = limit.match(/^(\d+)([mg]?)$/i);
    if (!match) {
      return 512 * 1024 * 1024; // Default 512MB
    }
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 'g':
        return value * 1024 * 1024 * 1024;
      case 'm':
      default:
        return value * 1024 * 1024;
    }
  }

  /**
   * Parse CPU limit
   */
  parseCpuLimit(limit) {
    const match = limit.match(/^(\d+(?:\.\d+)?)(?:\/(\d+))?$/);
    if (!match) {
      return 512; // Default 0.5 CPU (512 / 1024)
    }
    
    const value = parseFloat(match[1]);
    const base = parseInt(match[2]) || 2;
    
    return Math.round(value * 1024 / base);
  }

  /**
   * Cleanup container
   */
  async cleanupContainer(container, name) {
    try {
      const info = await container.inspect();
      
      if (info.State.Running) {
        await container.stop({ t: 5 });
      }
      
      await container.remove();
      
      this.logger.info(`Cleaned up container: ${name}`);
      
    } catch (error) {
      this.logger.warn(`Failed to cleanup container ${name}:`, error.message);
    }
  }

  /**
   * Stop all running containers
   */
  async stopAll() {
    this.logger.info('Stopping all active containers...');
    
    const containers = Array.from(this.activeContainers.values());
    
    for (const { container, containerName } of containers) {
      try {
        await container.stop({ t: 5 });
        await container.remove();
      } catch (error) {
        this.logger.warn(`Failed to stop container ${containerName}:`, error.message);
      }
    }
    
    this.activeContainers.clear();
    this.logger.info('All containers stopped');
  }

  /**
   * Get active containers
   */
  getActiveContainers() {
    return Array.from(this.activeContainers.entries()).map(([name, data]) => ({
      name,
      ...data,
      runtime: Date.now() - data.startTime
    }));
  }

  /**
   * Get system status
   */
  async getSystemStatus() {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const shieldClawContainers = containers.filter(c => 
        c.Names.some(n => n.startsWith(`/${this.containerPrefix}`))
      );
      
      return {
        totalContainers: containers.length,
        activeContainers: this.activeContainers.size,
        shieldClawContainers: shieldClawContainers.length,
        systemInfo: await this.docker.info()
      };
    } catch (error) {
      this.logger.error('Failed to get system status:', error);
      return { error: error.message };
    }
  }

  /**
   * Update resource limits
   */
  updateResourceLimits(newLimits) {
    this.resourceLimits = { ...this.resourceLimits, ...newLimits };
    this.logger.info('Resource limits updated:', this.resourceLimits);
  }

  /**
   * Update network settings
   */
  updateNetworkSettings(newSettings) {
    Object.assign(this, newSettings);
    this.logger.info('Network settings updated');
  }
}

export default IsolatedExecutor;
