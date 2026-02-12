/**
 * Sui Blockchain Client
 * Real integration with Sui blockchain via @mysten/sui SDK
 * Provides on-chain logging, reputation tracking, and attestation
 */

import 'dotenv/config';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { createLogger, logSecurityEvent } from '../utils/logger.js';
import crypto from 'crypto';

export class SuiBlockchainClient {
  constructor(options = {}) {
    this.logger = createLogger({ name: 'sui-blockchain', ...options });

    // Network configuration
    this.network = options.network || process.env.SUI_NETWORK || 'testnet';
    this.packageId = options.packageId || process.env.SUI_PACKAGE_ID || null;

    // Initialize Sui client
    const rpcUrl = options.rpcUrl || getFullnodeUrl(this.network);
    this.client = new SuiClient({ url: rpcUrl });

    // Keypair (for signing transactions)
    this.keypair = options.keypair || this._loadKeypair();

    // Object IDs for on-chain state
    this.registryId = options.registryId || process.env.SUI_REGISTRY_ID || null;
    this.eventLogId = options.eventLogId || process.env.SUI_EVENT_LOG_ID || null;
    this.certificateRegistryId = options.certificateRegistryId || process.env.SUI_CERT_REGISTRY_ID || null;

    // State
    this.initialized = false;
    this.eventBuffer = [];
    this.flushInterval = null;
    this.bufferSize = options.bufferSize || 10;
    this.flushIntervalMs = options.flushIntervalMs || 30000;
  }

  /**
   * Load keypair from environment or generate ephemeral
   */
  _loadKeypair() {
    const privateKey = process.env.SUI_PRIVATE_KEY;
    if (privateKey) {
      try {
        // Handle suiprivkey1... Bech32 format
        if (privateKey.startsWith('suiprivkey')) {
          const { secretKey } = decodeSuiPrivateKey(privateKey);
          return Ed25519Keypair.fromSecretKey(secretKey);
        }
        // Handle raw hex format
        return Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
      } catch (err) {
        this.logger.warn('Invalid SUI_PRIVATE_KEY, generating ephemeral keypair:', err.message);
      }
    }
    // Generate ephemeral keypair for demo/testing
    const keypair = new Ed25519Keypair();
    this.logger.info(`Using ephemeral keypair: ${keypair.getPublicKey().toSuiAddress()}`);
    return keypair;
  }

  /**
   * Initialize the blockchain client
   */
  async initialize() {
    try {
      this.logger.info(`Connecting to Sui ${this.network}...`);

      // Verify connectivity
      const chainId = await this.client.getChainIdentifier();
      this.logger.info(`Connected to chain: ${chainId}`);

      // Get address balance
      const address = this.keypair.getPublicKey().toSuiAddress();
      const balance = await this.client.getBalance({ owner: address });
      this.logger.info(`Address: ${address}`);
      this.logger.info(`Balance: ${(parseInt(balance.totalBalance) / 1e9).toFixed(4)} SUI`);

      // Start event buffer flush interval
      this.flushInterval = setInterval(() => {
        this._flushEventBuffer().catch(err =>
          this.logger.warn('Event buffer flush failed:', err.message)
        );
      }, this.flushIntervalMs);

      this.initialized = true;
      return {
        network: this.network,
        chainId,
        address,
        balance: balance.totalBalance,
        packageId: this.packageId
      };
    } catch (error) {
      this.logger.error('Sui initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Log a security event to the blockchain
   */
  async logSecurityEvent(event) {
    if (!this.initialized) {
      this.logger.warn('Sui client not initialized, buffering event');
      this.eventBuffer.push(event);
      return { buffered: true };
    }

    // If no package deployed, create a verifiable hash record
    if (!this.packageId || !this.eventLogId) {
      return this._logEventAsObject(event);
    }

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::security_events::log_event`,
        arguments: [
          tx.object(this.eventLogId),
          tx.pure.u8(event.eventType || 1),
          tx.pure.u8(event.severity || 1),
          tx.pure.string(event.source || 'shieldclaw'),
          tx.pure.string(event.component || 'unknown'),
          tx.pure.string(event.title || 'Security Event'),
          tx.pure.string(event.description || ''),
          tx.pure.vector('u8', event.metadata || [])
        ]
      });

      const result = await this.client.signAndExecuteTransaction({
        signer: this.keypair,
        transaction: tx
      });

      this.logger.info(`Event logged on-chain: ${result.digest}`);

      return {
        success: true,
        digest: result.digest,
        onChain: true
      };
    } catch (error) {
      this.logger.warn('On-chain event logging failed, using fallback:', error.message);
      return this._logEventAsObject(event);
    }
  }

  /**
   * Fallback: log event as a verifiable hash object
   */
  async _logEventAsObject(event) {
    const eventHash = crypto.createHash('sha256')
      .update(JSON.stringify({
        ...event,
        timestamp: Date.now(),
        agent: 'shieldclaw'
      }))
      .digest('hex');

    logSecurityEvent(this.logger, {
      type: 'blockchain_event_hash',
      severity: 'info',
      source: 'sui-client',
      details: {
        eventHash,
        event: event.title || event.type,
        network: this.network
      }
    });

    return {
      success: true,
      eventHash,
      onChain: false,
      reason: 'Package not deployed — event hashed locally'
    };
  }

  /**
   * Record skill execution result on-chain
   */
  async recordExecution(skillName, success, resourceUsage = {}) {
    if (!this.initialized) {
      return { buffered: true };
    }

    if (!this.packageId || !this.registryId) {
      // Log locally with verifiable hash
      const hash = crypto.createHash('sha256')
        .update(JSON.stringify({ skillName, success, resourceUsage, timestamp: Date.now() }))
        .digest('hex');

      this.logger.info(`Execution recorded (hash): ${hash}`);
      return { success: true, executionHash: hash, onChain: false };
    }

    try {
      const tx = new Transaction();
      const target = success
        ? `${this.packageId}::skill_reputation::record_success`
        : `${this.packageId}::skill_reputation::record_failure`;

      tx.moveCall({
        target,
        arguments: [tx.object(this.registryId)]
      });

      const result = await this.client.signAndExecuteTransaction({
        signer: this.keypair,
        transaction: tx
      });

      this.logger.info(`Execution recorded on-chain: ${result.digest}`);
      return { success: true, digest: result.digest, onChain: true };
    } catch (error) {
      this.logger.warn('On-chain execution recording failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a skill attestation on-chain
   */
  async createAttestation(skillName, skillHash, metadata = {}) {
    if (!this.initialized) {
      return { error: 'Not initialized' };
    }

    const attestationData = {
      skillName,
      skillHash,
      metadata,
      timestamp: Date.now(),
      signer: this.keypair.getPublicKey().toSuiAddress()
    };

    // Sign the attestation data
    const dataBytes = new TextEncoder().encode(JSON.stringify(attestationData));
    const signature = await this.keypair.sign(dataBytes);

    if (!this.packageId) {
      return {
        success: true,
        attestation: attestationData,
        signature: Buffer.from(signature).toString('hex'),
        onChain: false,
        reason: 'Package not deployed — attestation signed locally'
      };
    }

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::verification::create_skill_attestation`,
        arguments: [
          tx.pure.string(skillName),
          tx.pure.string(metadata.version || '1.0.0'),
          tx.pure.vector('u8', Array.from(Buffer.from(skillHash, 'hex'))),
          tx.pure.vector('u8', Array.from(signature)),
          tx.pure.address(this.keypair.getPublicKey().toSuiAddress()),
          tx.pure.u64(metadata.expiryEpoch || 1000),
          tx.pure.string(metadata.walrusBlobId || ''),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(JSON.stringify(metadata))))
        ]
      });

      const result = await this.client.signAndExecuteTransaction({
        signer: this.keypair,
        transaction: tx
      });

      this.logger.info(`Attestation created on-chain: ${result.digest}`);
      return { success: true, digest: result.digest, onChain: true };
    } catch (error) {
      this.logger.warn('On-chain attestation failed:', error.message);
      return {
        success: true,
        attestation: attestationData,
        signature: Buffer.from(signature).toString('hex'),
        onChain: false,
        error: error.message
      };
    }
  }

  /**
   * Query on-chain events for a skill
   */
  async queryEvents(filter = {}) {
    if (!this.initialized) {
      return [];
    }

    try {
      const events = await this.client.queryEvents({
        query: {
          MoveModule: {
            package: this.packageId || '0x0',
            module: filter.module || 'security_events'
          }
        },
        limit: filter.limit || 50
      });

      return events.data;
    } catch (error) {
      this.logger.warn('Event query failed:', error.message);
      return [];
    }
  }

  /**
   * Get on-chain reputation for a skill
   */
  async getReputation(objectId) {
    if (!this.initialized || !objectId) {
      return null;
    }

    try {
      const obj = await this.client.getObject({
        id: objectId,
        options: { showContent: true }
      });

      return obj.data?.content?.fields || null;
    } catch (error) {
      this.logger.warn('Reputation query failed:', error.message);
      return null;
    }
  }

  /**
   * Flush buffered events
   */
  async _flushEventBuffer() {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    for (const event of events) {
      await this.logSecurityEvent(event);
    }
  }

  /**
   * Get client health status
   */
  async getHealth() {
    try {
      const address = this.keypair.getPublicKey().toSuiAddress();
      let chainId = null;
      let balance = null;

      if (this.initialized) {
        chainId = await this.client.getChainIdentifier();
        const bal = await this.client.getBalance({ owner: address });
        balance = bal.totalBalance;
      }

      return {
        initialized: this.initialized,
        network: this.network,
        address,
        chainId,
        balance,
        packageDeployed: !!this.packageId,
        bufferedEvents: this.eventBuffer.length
      };
    } catch (error) {
      return {
        initialized: this.initialized,
        error: error.message
      };
    }
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush remaining events
    await this._flushEventBuffer();

    this.initialized = false;
    this.logger.info('Sui blockchain client disconnected');
  }
}

export default SuiBlockchainClient;
