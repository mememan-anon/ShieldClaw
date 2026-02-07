/**
 * OpenClaw API Client
 * Integrates ShieldClaw with OpenClaw's agent ecosystem
 */

import axios from 'axios';
import { createLogger, logSecurityEvent } from '../utils/logger.js';

export class OpenClawClient {
  constructor(options = {}) {
    this.logger = createLogger({ name: 'openclaw-client', ...options });
    
    // Gateway configuration
    this.gatewayUrl = options.gatewayUrl || process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:8080';
    this.timeout = options.timeout || 10000;
    
    // Agent configuration
    this.agentName = options.agentName || 'shieldclaw';
    this.agentVersion = options.version || '0.1.0';
    this.capabilities = options.capabilities || [
      'runtime_monitor',
      'skill_verification',
      'isolated_execution',
      'prompt_injection_defense',
      'blockchain_logging'
    ];
    
    // Authentication
    this.apiKey = options.apiKey || process.env.OPENCLAW_API_KEY;
    
    // State
    this.registered = false;
    this.connected = false;
    this.heartbeatInterval = null;
    this.callbacks = new Map();
    
    // Initialize client
    this.client = axios.create({
      baseURL: this.gatewayUrl,
      timeout: this.timeout,
      headers: this.getHeaders()
    });
  }

  /**
   * Get default headers
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': `ShieldClaw/${this.agentVersion}`
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Register ShieldClaw as an OpenClaw agent
   */
  async register() {
    try {
      this.logger.info(`Registering agent: ${this.agentName}`);

      const agentInfo = {
        name: this.agentName,
        version: this.agentVersion,
        type: 'security',
        capabilities: this.capabilities,
        status: 'initializing'
      };

      const response = await this.client.post('/api/v1/agents/register', agentInfo);
      
      if (response.data.success) {
        this.registered = true;
        this.connected = true;
        this.logger.info(`Agent registered successfully: ${response.data.agentId}`);
        
        logSecurityEvent(this.logger, {
          type: 'agent_registered',
          severity: 'info',
          source: this.agentName,
          details: { agentId: response.data.agentId }
        });

        // Start heartbeat
        this.startHeartbeat();
        
        return response.data;
      } else {
        throw new Error(response.data.error || 'Registration failed');
      }

    } catch (error) {
      this.logger.error('Agent registration failed:', error);
      this.connected = false;
      throw error;
    }
  }

  /**
   * Unregister agent
   */
  async unregister() {
    try {
      if (!this.registered) {
        return;
      }

      this.logger.info('Unregistering agent');

      await this.client.post('/api/v1/agents/unregister', {
        name: this.agentName
      });

      this.registered = false;
      this.connected = false;
      this.stopHeartbeat();

      this.logger.info('Agent unregistered successfully');

    } catch (error) {
      this.logger.error('Agent unregistration failed:', error);
      throw error;
    }
  }

  /**
   * Start heartbeat
   */
  startHeartbeat(interval = 30000) {
    this.logger.info(`Starting heartbeat (interval: ${interval}ms)`);

    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.sendHeartbeat();
      } catch (error) {
        this.logger.warn('Heartbeat failed:', error.message);
      }
    }, interval);

    // Send initial heartbeat
    this.sendHeartbeat();
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      this.logger.info('Heartbeat stopped');
    }
  }

  /**
   * Send heartbeat
   */
  async sendHeartbeat(status = {}) {
    try {
      const heartbeatData = {
        name: this.agentName,
        version: this.agentVersion,
        timestamp: Date.now(),
        uptime: process.uptime(),
        status: {
          registered: this.registered,
          connected: this.connected,
          ...status
        }
      };

      await this.client.post('/api/v1/agents/heartbeat', heartbeatData);
      
      this.logger.debug('Heartbeat sent successfully');

    } catch (error) {
      this.logger.warn('Heartbeat failed:', error.message);
      this.connected = false;
    }
  }

  /**
   * Update agent status
   */
  async updateStatus(status) {
    try {
      await this.client.put(`/api/v1/agents/${this.agentName}/status`, status);
      this.logger.debug('Status updated:', status);
    } catch (error) {
      this.logger.error('Status update failed:', error);
    }
  }

  /**
   * Publish security event
   */
  async publishEvent(event) {
    try {
      const eventData = {
        source: this.agentName,
        timestamp: Date.now(),
        type: event.type,
        severity: event.severity || 'info',
        data: event.data || {}
      };

      await this.client.post('/api/v1/events/publish', eventData);
      
      this.logger.debug(`Event published: ${event.type}`);

    } catch (error) {
      this.logger.error('Event publication failed:', error);
    }
  }

  /**
   * Send alert to OpenClaw message system
   */
  async sendAlert(alert) {
    try {
      const alertData = {
        source: this.agentName,
        type: 'security_alert',
        severity: alert.severity || 'warning',
        title: alert.title,
        message: alert.message,
        timestamp: Date.now(),
        channels: alert.channels || ['default'],
        metadata: alert.metadata || {}
      };

      await this.client.post('/api/v1/alerts/send', alertData);
      
      logSecurityEvent(this.logger, {
        type: 'alert_sent',
        severity: alert.severity,
        source: this.agentName,
        details: { title: alert.title }
      });

      this.logger.info(`Alert sent: ${alert.title}`);

    } catch (error) {
      this.logger.error('Alert sending failed:', error);
    }
  }

  /**
   * Register callback for agent commands
   */
  registerCallback(eventType, callback) {
    if (!this.callbacks.has(eventType)) {
      this.callbacks.set(eventType, []);
    }
    this.callbacks.get(eventType).push(callback);
    this.logger.debug(`Registered callback for: ${eventType}`);
  }

  /**
   * Handle incoming command
   */
  async handleCommand(command) {
    try {
      this.logger.info(`Received command: ${command.type}`);

      const callbacks = this.callbacks.get(command.type) || [];
      
      for (const callback of callbacks) {
        try {
          const result = await callback(command);
          
          // Send response if callback returns data
          if (result) {
            await this.sendResponse(command.id, result);
          }
        } catch (error) {
          this.logger.error(`Callback execution failed:`, error);
          await this.sendResponse(command.id, {
            success: false,
            error: error.message
          });
        }
      }

    } catch (error) {
      this.logger.error('Command handling failed:', error);
    }
  }

  /**
   * Send command response
   */
  async sendResponse(commandId, response) {
    try {
      await this.client.post('/api/v1/commands/response', {
        commandId,
        source: this.agentName,
        response
      });

      this.logger.debug(`Response sent for command: ${commandId}`);

    } catch (error) {
      this.logger.error('Response sending failed:', error);
    }
  }

  /**
   * Query other agents
   */
  async queryAgents(filter = {}) {
    try {
      const response = await this.client.get('/api/v1/agents/query', { params: filter });
      return response.data.agents || [];
    } catch (error) {
      this.logger.error('Agent query failed:', error);
      return [];
    }
  }

  /**
   * Get agent by name
   */
  async getAgent(agentName) {
    try {
      const response = await this.client.get(`/api/v1/agents/${agentName}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Agent lookup failed: ${agentName}`, error);
      return null;
    }
  }

  /**
   * Start event streaming
   */
  async startEventStream(callback) {
    try {
      const EventSource = (await import('eventsource')).default;
      
      const eventSource = new EventSource(
        `${this.gatewayUrl}/api/v1/agents/${this.agentName}/stream`,
        { headers: this.getHeaders() }
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          callback(data);
        } catch (error) {
          this.logger.error('Event parsing failed:', error);
        }
      };

      eventSource.onerror = (error) => {
        this.logger.error('Event stream error:', error);
      };

      return eventSource;

    } catch (error) {
      this.logger.error('Event stream creation failed:', error);
      throw error;
    }
  }

  /**
   * Log security event to blockchain
   */
  async logToBlockchain(event) {
    try {
      const blockchainData = {
        agent: this.agentName,
        timestamp: Date.now(),
        eventType: event.type,
        severity: event.severity,
        data: event.data,
        signature: await this.signEvent(event)
      };

      await this.client.post('/api/v1/blockchain/log', blockchainData);
      
      this.logger.info(`Event logged to blockchain: ${event.type}`);

    } catch (error) {
      this.logger.error('Blockchain logging failed:', error);
    }
  }

  /**
   * Sign event (placeholder - would use actual crypto)
   */
  async signEvent(event) {
    // Placeholder for digital signature
    // In production, this would use agent's private key
    return Buffer.from(JSON.stringify(event)).toString('base64');
  }

  /**
   * Get system health
   */
  async getHealth() {
    return {
      agent: this.agentName,
      version: this.agentVersion,
      status: {
        registered: this.registered,
        connected: this.connected,
        uptime: process.uptime()
      },
      capabilities: this.capabilities,
      gateway: this.gatewayUrl,
      timestamp: Date.now()
    };
  }

  /**
   * Disconnect
   */
  async disconnect() {
    this.logger.info('Disconnecting from OpenClaw');
    
    await this.unregister();
    this.stopHeartbeat();
    
    this.logger.info('Disconnected successfully');
  }
}

export default OpenClawClient;
