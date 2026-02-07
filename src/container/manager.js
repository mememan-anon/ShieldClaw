/**
 * Container Manager
 * Manages Docker containers for isolated skill execution
 */

import Docker from 'dockerode';
import { createLogger, logSecurityEvent } from '../utils/logger.js';

export class ContainerManager {
  constructor(options = {}) {
    this.logger = createLogger({ name: 'container-manager', ...options });
    
    // Docker client
    this.docker = new Docker(options.docker || { socketPath: '/var/run/docker.sock' });
    
    // Configuration
    this.prefix = options.prefix || 'shieldclaw-';
    this.defaultImage = options.defaultImage || 'node:22-alpine';
    this.autoCleanup = options.autoCleanup !== false;
    
    // State
    this.containers = new Map();
    this.networks = new Map();
    this.volumes = new Map();
    
    this.logger.info('Container manager initialized');
  }

  /**
   * Create a new container
   */
  async createContainer(config) {
    const {
      name,
      image = this.defaultImage,
      command = ['node', '/app/skill.js'],
      env = [],
      mounts = [],
      networkMode = 'none',
      resourceLimits = {},
      securityOpts = [],
      labels = {}
    } = config;

    const containerName = `${this.prefix}${name}`;

    try {
      this.logger.info(`Creating container: ${containerName}`);

      // Prepare host config
      const hostConfig = {
        NetworkMode: networkMode,
        Binds: mounts.map(m => `${m.source}:${m.target}:${m.options || 'ro'}`),
        SecurityOpt: securityOpts,
        AutoRemove: this.autoCleanup,
        ReadonlyRootfs: config.readonlyRootfs || false
      };

      // Add resource limits
      if (resourceLimits.memory) {
        hostConfig.Memory = this.parseMemory(resourceLimits.memory);
      }
      if (resourceLimits.cpus) {
        hostConfig.NanoCpus = Math.floor(resourceLimits.cpus * 1e9);
      }
      if (resourceLimits.memoryReservation) {
        hostConfig.MemoryReservation = this.parseMemory(resourceLimits.memoryReservation);
      }

      // Pull image if needed
      await this.ensureImage(image);

      // Create container
      const container = await this.docker.createContainer({
        name: containerName,
        Image: image,
        Cmd: command,
        Env: env,
        HostConfig: hostConfig,
        Labels: {
          'shieldclaw.managed': 'true',
          ...labels
        },
        User: config.user || 'nobody',
        WorkingDir: config.workingDir || '/app'
      });

      // Track container
      this.containers.set(containerName, {
        container,
        config,
        createdAt: Date.now(),
        status: 'created'
      });

      logSecurityEvent(this.logger, {
        type: 'container_created',
        severity: 'info',
        source: 'container-manager',
        target: containerName,
        details: { image, command }
      });

      return container;

    } catch (error) {
      this.logger.error(`Failed to create container: ${containerName}`, error);
      throw error;
    }
  }

  /**
   * Start a container
   */
  async startContainer(name) {
    const containerName = `${this.prefix}${name}`;
    const entry = this.containers.get(containerName);

    if (!entry) {
      throw new Error(`Container not found: ${containerName}`);
    }

    try {
      await entry.container.start();
      entry.status = 'running';
      entry.startedAt = Date.now();

      this.logger.info(`Started container: ${containerName}`);

      logSecurityEvent(this.logger, {
        type: 'container_started',
        severity: 'info',
        source: 'container-manager',
        target: containerName
      });

      return true;

    } catch (error) {
      this.logger.error(`Failed to start container: ${containerName}`, error);
      throw error;
    }
  }

  /**
   * Stop a container
   */
  async stopContainer(name, timeout = 5) {
    const containerName = `${this.prefix}${name}`;
    const entry = this.containers.get(containerName);

    if (!entry) {
      throw new Error(`Container not found: ${containerName}`);
    }

    try {
      await entry.container.stop({ t: timeout });
      entry.status = 'stopped';
      entry.stoppedAt = Date.now();

      this.logger.info(`Stopped container: ${containerName}`);

      return true;

    } catch (error) {
      this.logger.error(`Failed to stop container: ${containerName}`, error);
      throw error;
    }
  }

  /**
   * Remove a container
   */
  async removeContainer(name, force = false) {
    const containerName = `${this.prefix}${name}`;
    const entry = this.containers.get(containerName);

    if (!entry) {
      throw new Error(`Container not found: ${containerName}`);
    }

    try {
      await entry.container.remove({ force, v: true });
      this.containers.delete(containerName);

      this.logger.info(`Removed container: ${containerName}`);

      logSecurityEvent(this.logger, {
        type: 'container_removed',
        severity: 'info',
        source: 'container-manager',
        target: containerName
      });

      return true;

    } catch (error) {
      this.logger.error(`Failed to remove container: ${containerName}`, error);
      throw error;
    }
  }

  /**
   * Execute a command in a container
   */
  async execContainer(name, command, options = {}) {
    const containerName = `${this.prefix}${name}`;
    const entry = this.containers.get(containerName);

    if (!entry) {
      throw new Error(`Container not found: ${containerName}`);
    }

    try {
      const exec = await entry.container.exec({
        Cmd: Array.isArray(command) ? command : ['/bin/sh', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: options.workingDir || '/app'
      });

      const stream = await exec.start({ Detach: false });

      let output = '';
      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
          output += chunk.toString();
        });

        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const info = await exec.inspect();

      return {
        output,
        exitCode: info.ExitCode,
        success: info.ExitCode === 0
      };

    } catch (error) {
      this.logger.error(`Exec failed in container: ${containerName}`, error);
      throw error;
    }
  }

  /**
   * Get container stats
   */
  async getStats(name) {
    const containerName = `${this.prefix}${name}`;
    const entry = this.containers.get(containerName);

    if (!entry) {
      throw new Error(`Container not found: ${containerName}`);
    }

    try {
      const stats = await entry.container.stats({ stream: false });

      return {
        cpu: this.parseCpuStats(stats),
        memory: this.parseMemoryStats(stats),
        network: this.parseNetworkStats(stats),
        blockIO: this.parseBlockIOStats(stats),
        pids: stats.pids_stats?.current || 0
      };

    } catch (error) {
      this.logger.error(`Failed to get stats for: ${containerName}`, error);
      throw error;
    }
  }

  /**
   * List all ShieldClaw containers
   */
  async listContainers(all = false) {
    try {
      const containers = await this.docker.listContainers({ all });
      const shieldClawContainers = containers.filter(c =>
        c.Names.some(n => n.startsWith(`/${this.prefix}`))
      );

      return shieldClawContainers.map(c => ({
        id: c.Id,
        name: c.Names[0].substring(1),
        image: c.Image,
        status: c.Status,
        created: c.Created,
        ports: c.Ports
      }));

    } catch (error) {
      this.logger.error('Failed to list containers', error);
      return [];
    }
  }

  /**
   * Ensure image is available locally
   */
  async ensureImage(image) {
    try {
      await this.docker.getImage(image).inspect();
      this.logger.debug(`Image available: ${image}`);
    } catch (error) {
      this.logger.info(`Pulling image: ${image}`);
      await new Promise((resolve, reject) => {
        this.docker.pull(image, (err, stream) => {
          if (err) return reject(err);

          this.docker.modem.followProgress(stream, (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
      this.logger.info(`Image pulled: ${image}`);
    }
  }

  /**
   * Create isolated network
   */
  async createNetwork(name, options = {}) {
    const networkName = `${this.prefix}${name}`;

    try {
      this.logger.info(`Creating network: ${networkName}`);

      const network = await this.docker.createNetwork({
        Name: networkName,
        Driver: 'bridge',
        Internal: options.internal || false,
        Labels: {
          'shieldclaw.managed': 'true'
        }
      });

      this.networks.set(networkName, network);
      return network;

    } catch (error) {
      this.logger.error(`Failed to create network: ${networkName}`, error);
      throw error;
    }
  }

  /**
   * Connect container to network
   */
  async connectToNetwork(containerName, networkName) {
    const fullContainerName = `${this.prefix}${containerName}`;
    const fullNetworkName = `${this.prefix}${networkName}`;

    try {
      const network = this.networks.get(fullNetworkName);
      const container = this.containers.get(fullContainerName)?.container;

      if (!network || !container) {
        throw new Error('Network or container not found');
      }

      await network.connect({ Container: fullContainerName });
      this.logger.info(`Connected ${fullContainerName} to ${fullNetworkName}`);

    } catch (error) {
      this.logger.error(`Failed to connect to network`, error);
      throw error;
    }
  }

  /**
   * Clean up all ShieldClaw resources
   */
  async cleanup() {
    this.logger.info('Starting cleanup...');

    // Stop and remove all containers
    for (const [name, entry] of this.containers) {
      try {
        if (entry.status === 'running') {
          await entry.container.stop({ t: 5 });
        }
        await entry.container.remove({ force: true, v: true });
      } catch (error) {
        this.logger.warn(`Failed to cleanup container: ${name}`, error);
      }
    }

    // Remove networks
    for (const [name, network] of this.networks) {
      try {
        await network.remove();
      } catch (error) {
        this.logger.warn(`Failed to remove network: ${name}`, error);
      }
    }

    this.containers.clear();
    this.networks.clear();
    this.volumes.clear();

    this.logger.info('Cleanup completed');
  }

  /**
   * Parse CPU stats
   */
  parseCpuStats(stats) {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

    return {
      percent: Math.round(cpuPercent * 100) / 100,
      usage: stats.cpu_stats.cpu_usage.total_usage,
      system: stats.cpu_stats.system_cpu_usage,
      onlineCpus: stats.cpu_stats.online_cpus
    };
  }

  /**
   * Parse memory stats
   */
  parseMemoryStats(stats) {
    const usage = stats.memory_stats.usage || 0;
    const limit = stats.memory_stats.limit || 1;
    const cache = stats.memory_stats.stats?.cache || 0;

    return {
      used: usage,
      limit,
      percent: Math.round((usage / limit) * 10000) / 100,
      cache,
      workingSet: usage - cache
    };
  }

  /**
   * Parse network stats
   */
  parseNetworkStats(stats) {
    const networks = stats.networks || {};
    
    let totalRx = 0;
    let totalTx = 0;
    const interfaces = [];

    for (const [iface, data] of Object.entries(networks)) {
      totalRx += data.rx_bytes || 0;
      totalTx += data.tx_bytes || 0;
      interfaces.push({ iface, ...data });
    }

    return {
      rx: totalRx,
      tx: totalTx,
      interfaces
    };
  }

  /**
   * Parse block I/O stats
   */
  parseBlockIOStats(stats) {
    const ioStats = stats.blkio_stats || {};
    const ioServiceBytes = ioStats.io_service_bytes_recursive || [];

    let readBytes = 0;
    let writeBytes = 0;
    let readOps = 0;
    let writeOps = 0;

    for (const entry of ioServiceBytes) {
      if (entry.op === 'read' || entry.op === 'Read') {
        readBytes += entry.value || 0;
      } else if (entry.op === 'write' || entry.op === 'Write') {
        writeBytes += entry.value || 0;
      }
    }

    return {
      readBytes,
      writeBytes,
      readOps,
      writeOps
    };
  }

  /**
   * Parse memory limit string to bytes
   */
  parseMemory(limit) {
    const match = limit.toString().match(/^(\d+(?:\.\d+)?)([kmgt]?b?)$/i);
    if (!match) {
      return 512 * 1024 * 1024;
    }

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
      t: 1024 * 1024 * 1024 * 1024
    };

    return Math.floor(value * (multipliers[unit] || 1));
  }

  /**
   * Get system status
   */
  async getSystemStatus() {
    try {
      const info = await this.docker.info();
      const containers = await this.listContainers(true);

      return {
        dockerVersion: info.ServerVersion,
        operatingSystem: info.OperatingSystem,
        containers: {
          total: info.Containers,
          running: info.ContainersRunning,
          stopped: info.ContainersStopped,
          shieldClaw: this.containers.size
        },
        images: info.Images,
        storageDriver: info.Driver
      };

    } catch (error) {
      this.logger.error('Failed to get system status', error);
      return { error: error.message };
    }
  }
}

export default ContainerManager;
