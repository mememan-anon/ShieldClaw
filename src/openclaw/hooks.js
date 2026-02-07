/**
 * OpenClaw Execution Hooks
 * Pre and post-execution hooks for skill execution
 */

import { createLogger } from '../utils/logger.js';
import { logSecurityEvent } from '../utils/logger.js';

export class ExecutionHooks {
  constructor(options = {}) {
    this.logger = createLogger({ name: 'execution-hooks', ...options });
    
    // Hook collections
    this.preExecutionHooks = new Map();
    this.postExecutionHooks = new Map();
    this.errorHooks = new Map();
    
    // Configuration
    this.enableHooks = options.enableHooks !== false;
    this.hookTimeout = options.hookTimeout || 5000;
    this.strictMode = options.strictMode || false;
  }

  /**
   * Register pre-execution hook
   */
  registerPreExecutionHook(name, hook) {
    if (typeof hook !== 'function') {
      throw new Error('Hook must be a function');
    }
    
    this.preExecutionHooks.set(name, hook);
    this.logger.debug(`Registered pre-execution hook: ${name}`);
  }

  /**
   * Register post-execution hook
   */
  registerPostExecutionHook(name, hook) {
    if (typeof hook !== 'function') {
      throw new Error('Hook must be a function');
    }
    
    this.postExecutionHooks.set(name, hook);
    this.logger.debug(`Registered post-execution hook: ${name}`);
  }

  /**
   * Register error hook
   */
  registerErrorHook(name, hook) {
    if (typeof hook !== 'function') {
      throw new Error('Hook must be a function');
    }
    
    this.errorHooks.set(name, hook);
    this.logger.debug(`Registered error hook: ${name}`);
  }

  /**
   * Unregister hook
   */
  unregisterHook(type, name) {
    let hooks;
    
    switch (type) {
      case 'pre':
        hooks = this.preExecutionHooks;
        break;
      case 'post':
        hooks = this.postExecutionHooks;
        break;
      case 'error':
        hooks = this.errorHooks;
        break;
      default:
        throw new Error(`Invalid hook type: ${type}`);
    }
    
    if (hooks.delete(name)) {
      this.logger.debug(`Unregistered ${type}-execution hook: ${name}`);
      return true;
    }
    
    return false;
  }

  /**
   * Execute all pre-execution hooks
   */
  async executePreExecutionHooks(context) {
    if (!this.enableHooks || this.preExecutionHooks.size === 0) {
      return { approved: true, modifications: {} };
    }

    this.logger.info(`Executing ${this.preExecutionHooks.size} pre-execution hooks`);

    const results = {
      approved: true,
      modifications: {},
      warnings: [],
      errors: []
    };

    for (const [name, hook] of this.preExecutionHooks) {
      try {
        this.logger.debug(`Running pre-execution hook: ${name}`);

        const result = await Promise.race([
          hook(context),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Hook timeout')), this.hookTimeout)
          )
        ]);

        // Process result
        if (result) {
          // Check if hook denied execution
          if (result.approved === false) {
            results.approved = false;
            results.warnings.push({
              hook: name,
              reason: result.reason || 'Execution denied by hook'
            });

            logSecurityEvent(this.logger, {
              type: 'pre_hook_denied',
              severity: 'warning',
              source: name,
              details: { reason: result.reason, context }
            });

            // In strict mode, stop on first denial
            if (this.strictMode) {
              break;
            }
          }

          // Merge modifications
          if (result.modifications) {
            Object.assign(results.modifications, result.modifications);
          }

          // Collect warnings
          if (result.warnings && Array.isArray(result.warnings)) {
            results.warnings.push(...result.warnings);
          }
        }

      } catch (error) {
        this.logger.error(`Pre-execution hook failed: ${name}`, error);
        
        results.errors.push({
          hook: name,
          error: error.message
        });

        // In strict mode, any error denies execution
        if (this.strictMode) {
          results.approved = false;
          break;
        }
      }
    }

    // Apply modifications to context
    Object.assign(context, results.modifications);

    if (results.warnings.length > 0) {
      this.logger.warn(`Pre-execution warnings: ${results.warnings.length}`);
    }

    if (results.errors.length > 0) {
      this.logger.error(`Pre-execution errors: ${results.errors.length}`);
    }

    return results;
  }

  /**
   * Execute all post-execution hooks
   */
  async executePostExecutionHooks(context, result) {
    if (!this.enableHooks || this.postExecutionHooks.size === 0) {
      return { processed: true };
    }

    this.logger.info(`Executing ${this.postExecutionHooks.size} post-execution hooks`);

    const results = {
      processed: true,
      modifications: {},
      warnings: [],
      errors: []
    };

    for (const [name, hook] of this.postExecutionHooks) {
      try {
        this.logger.debug(`Running post-execution hook: ${name}`);

        const hookResult = await Promise.race([
          hook(context, result),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Hook timeout')), this.hookTimeout)
          )
        ]);

        // Process result
        if (hookResult) {
          // Merge modifications to result
          if (hookResult.modifications) {
            Object.assign(results.modifications, hookResult.modifications);
            Object.assign(result, hookResult.modifications);
          }

          // Collect warnings
          if (hookResult.warnings && Array.isArray(hookResult.warnings)) {
            results.warnings.push(...hookResult.warnings);
          }

          // Check if hook flagged result
          if (hookResult.flagged) {
            results.warnings.push({
              hook: name,
              reason: hookResult.reason || 'Result flagged by post-execution hook'
            });

            logSecurityEvent(this.logger, {
              type: 'post_hook_flagged',
              severity: 'warning',
              source: name,
              details: { reason: hookResult.reason, result }
            });
          }
        }

      } catch (error) {
        this.logger.error(`Post-execution hook failed: ${name}`, error);
        
        results.errors.push({
          hook: name,
          error: error.message
        });
      }
    }

    if (results.warnings.length > 0) {
      this.logger.warn(`Post-execution warnings: ${results.warnings.length}`);
    }

    if (results.errors.length > 0) {
      this.logger.error(`Post-execution errors: ${results.errors.length}`);
    }

    return results;
  }

  /**
   * Execute error hooks
   */
  async executeErrorHooks(context, error) {
    if (!this.enableHooks || this.errorHooks.size === 0) {
      return { handled: false };
    }

    this.logger.info(`Executing ${this.errorHooks.size} error hooks`);

    const results = {
      handled: false,
      recoveryAttempts: [],
      errors: []
    };

    for (const [name, hook] of this.errorHooks) {
      try {
        this.logger.debug(`Running error hook: ${name}`);

        const hookResult = await Promise.race([
          hook(context, error),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Hook timeout')), this.hookTimeout)
          )
        ]);

        // Process result
        if (hookResult) {
          // Check if hook handled the error
          if (hookResult.handled) {
            results.handled = true;
            
            logSecurityEvent(this.logger, {
              type: 'error_hook_handled',
              severity: 'info',
              source: name,
              details: { error: error.message }
            });
          }

          // Collect recovery attempts
          if (hookResult.recovery) {
            results.recoveryAttempts.push({
              hook: name,
              recovery: hookResult.recovery
            });
          }
        }

      } catch (error) {
        this.logger.error(`Error hook failed: ${name}`, error);
        
        results.errors.push({
          hook: name,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get hook statistics
   */
  getStatistics() {
    return {
      preExecutionHooks: this.preExecutionHooks.size,
      postExecutionHooks: this.postExecutionHooks.size,
      errorHooks: this.errorHooks.size,
      enabled: this.enableHooks,
      strictMode: this.strictMode
    };
  }

  /**
   * Clear all hooks
   */
  clearAllHooks() {
    this.preExecutionHooks.clear();
    this.postExecutionHooks.clear();
    this.errorHooks.clear();
    this.logger.info('All hooks cleared');
  }

  /**
   * Set hooks enabled state
   */
  setEnabled(enabled) {
    this.enableHooks = enabled;
    this.logger.info(`Hooks ${enabled ? 'enabled' : 'disabled'}`);
  }
}

/**
 * Built-in security hooks
 */
export class SecurityHooks {
  static createPreExecutionHooks(client) {
    return {
      /**
       * Verify skill before execution
       */
      async verifySkill(context) {
        if (!context.skillName) {
          return { approved: false, reason: 'No skill name provided' };
        }

        // In a real implementation, this would call the skill verifier
        // For now, just log the verification attempt
        client?.logger?.debug?.(`Verifying skill: ${context.skillName}`);

        return { approved: true };
      },

      /**
       * Check resource limits
       */
      async checkResources(context) {
        const checks = {
          cpu: context.maxCpu || 0.5,
          memory: context.maxMemory || '512m',
          timeout: context.timeout || 30000
        };

        // Validate limits are reasonable
        if (checks.cpu > 2.0) {
          return { 
            approved: false, 
            reason: 'CPU limit too high (max: 2.0 cores)' 
          };
        }

        if (checks.timeout > 60000) {
          return {
            approved: false,
            reason: 'Timeout too long (max: 60s)'
          };
        }

        return { approved: true };
      },

      /**
       * Log execution attempt
       */
      async logAttempt(context) {
        client?.logger?.info?.(`Execution attempt: ${context.skillName}`);
        
        logSecurityEvent(client?.logger || console, {
          type: 'execution_attempt',
          severity: 'info',
          source: context.skillName,
          details: {
            user: context.userId,
            timestamp: Date.now()
          }
        });

        return { approved: true };
      }
    };
  }

  static createPostExecutionHooks(client) {
    return {
      /**
       * Log execution result
       */
      async logResult(context, result) {
        client?.logger?.info?.(`Execution result: ${context.skillName} - success=${result.success}`);

        if (!result.success && result.error) {
          logSecurityEvent(client?.logger || console, {
            type: 'execution_failed',
            severity: 'warning',
            source: context.skillName,
            details: {
              error: result.error,
              duration: result.duration
            }
          });
        }

        return {};
      },

      /**
       * Check for suspicious output
       */
      async checkOutput(context, result) {
        if (!result.output) {
          return {};
        }

        const output = result.output.output || result.output;
        
        // Check for sensitive data patterns
        const sensitivePatterns = [
          /password[:\s]*["']?[\w]+/gi,
          /api[_-]?key[:\s]*["']?[\w-]+/gi,
          /token[:\s]*["']?[\w.-]+/gi
        ];

        let flagged = false;
        for (const pattern of sensitivePatterns) {
          if (pattern.test(output)) {
            flagged = true;
            break;
          }
        }

        if (flagged) {
          return {
            flagged: true,
            reason: 'Output may contain sensitive data',
            modifications: {
              outputSanitized: true
            }
          };
        }

        return {};
      }
    };
  }

  static createErrorHooks(client) {
    return {
      /**
       * Log error
       */
      async logError(context, error) {
        client?.logger?.error?.(`Execution error: ${context.skillName}`, error);

        logSecurityEvent(client?.logger || console, {
          type: 'execution_error',
          severity: 'error',
          source: context.skillName,
          details: {
            error: error.message,
            stack: error.stack
          }
        });

        return {};
      }
    };
  }
}

export default ExecutionHooks;
