/**
 * Skill Verification System
 * Verifies code integrity, permissions, and signatures of agent skills
 */

import { sha256, sha256File, verifyHash, verifySignature } from '../utils/crypto.js';
import { isSuspiciousFilePath, isSuspiciousCommand, detectPromptInjection } from '../utils/patterns.js';
import { safeReadFile, listFilesRecursively, safeExists } from '../utils/filesystem.js';
import { createLogger, logSecurityEvent } from '../utils/logger.js';

export class SkillVerifier {
  constructor(options = {}) {
    this.logger = createLogger({ name: 'skill-verifier', ...options });
    this.allowedDirs = options.allowedDirs || [];
    this.trustedSigners = options.trustedSigners || {};
    this.permissionPolicy = options.permissionPolicy || this.defaultPermissionPolicy();
    this.reputationDB = options.reputationDB || new Map();
  }

  /**
   * Default permission policy
   */
  defaultPermissionPolicy() {
    return {
      fileAccess: {
        read: true,
        write: false,
        delete: false,
        allowedPaths: ['/tmp', './data', './workspace']
      },
      network: {
        enabled: true,
        allowedHosts: [],
        allowedPorts: [80, 443],
        denyPrivateNetworks: true
      },
      system: {
        allowShellCommands: false,
        allowProcessControl: false,
        maxMemory: '512m',
        maxCpu: 50
      },
      dangerousOperations: {
        allowEval: false,
        allowDynamicImports: false,
        allowNativeModules: false
      }
    };
  }

  /**
   * Verify a skill
   */
  async verifySkill(skillPath, options = {}) {
    const {
      checkSignature = true,
      checkReputation = true,
      scanCode = true,
      verifyPermissions = true
    } = options;

    this.logger.info(`Verifying skill: ${skillPath}`);

    const verificationResult = {
      skillPath,
      verified: false,
      timestamp: Date.now(),
      checks: {}
    };

    try {
      // Check if skill exists
      if (!(await safeExists(skillPath, this.allowedDirs))) {
        verificationResult.checks.existence = {
          passed: false,
          message: 'Skill path does not exist or is not accessible'
        };
        return verificationResult;
      }
      verificationResult.checks.existence = { passed: true };

      // Code integrity check
      if (scanCode) {
        verificationResult.checks.codeIntegrity = await this.checkCodeIntegrity(skillPath);
        if (!verificationResult.checks.codeIntegrity.passed) {
          logSecurityEvent(this.logger, {
            type: 'skill_verification_failed',
            severity: 'high',
            source: 'skill-verifier',
            target: skillPath,
            details: verificationResult.checks.codeIntegrity
          });
          return verificationResult;
        }
      }

      // Signature verification
      if (checkSignature) {
        verificationResult.checks.signature = await this.checkSignature(skillPath);
      }

      // Reputation check
      if (checkReputation) {
        verificationResult.checks.reputation = await this.checkReputation(skillPath);
      }

      // Permission verification
      if (verifyPermissions) {
        verificationResult.checks.permissions = await this.verifyPermissions(skillPath);
      }

      // Final verdict
      verificationResult.verified = this.finalizeVerification(verificationResult);

      if (verificationResult.verified) {
        this.logger.info(`Skill verified successfully: ${skillPath}`);
      } else {
        this.logger.warn(`Skill verification failed: ${skillPath}`);
      }

      return verificationResult;

    } catch (error) {
      this.logger.error(`Error verifying skill ${skillPath}:`, error);
      verificationResult.error = error.message;
      return verificationResult;
    }
  }

  /**
   * Check code integrity
   */
  async checkCodeIntegrity(skillPath) {
    const result = {
      passed: false,
      issues: [],
      files: []
    };

    try {
      const files = await listFilesRecursively(skillPath);

      for (const file of files) {
        const content = await safeReadFile(file, this.allowedDirs);
        const hash = sha256(content);
        
        const fileResult = {
          path: file,
          hash,
          suspiciousPatterns: []
        };

        // Check for suspicious patterns
        const injectionPatterns = detectPromptInjection(content);
        if (injectionPatterns.length > 0) {
          fileResult.suspiciousPatterns.push({
            type: 'prompt_injection',
            patterns: injectionPatterns
          });
          result.issues.push({
            file,
            type: 'prompt_injection',
            message: `Prompt injection patterns detected in ${file}`
          });
        }

        // Check for suspicious file operations
        const suspiciousFileOps = this.checkSuspiciousFileOperations(content);
        if (suspiciousFileOps.length > 0) {
          fileResult.suspiciousPatterns.push({
            type: 'file_operations',
            patterns: suspiciousFileOps
          });
          result.issues.push({
            file,
            type: 'suspicious_file_ops',
            message: `Suspicious file operations in ${file}`
          });
        }

        // Check for suspicious commands
        const suspiciousCommands = this.checkSuspiciousCommands(content);
        if (suspiciousCommands.length > 0) {
          fileResult.suspiciousPatterns.push({
            type: 'commands',
            patterns: suspiciousCommands
          });
          result.issues.push({
            file,
            type: 'suspicious_commands',
            message: `Suspicious commands in ${file}`
          });
        }

        result.files.push(fileResult);
      }

      result.passed = result.issues.length === 0;
      return result;

    } catch (error) {
      result.issues.push({
        type: 'error',
        message: `Code integrity check failed: ${error.message}`
      });
      return result;
    }
  }

  /**
   * Check suspicious file operations
   */
  checkSuspiciousFileOperations(content) {
    const patterns = [
      /require\s*\(\s*["']fs["']\s*\).*?\.unlink|unlinkSync/gi,
      /require\s*\(\s*["']fs["']\s*\).*?\.rmdir|rmdirSync/gi,
      /require\s*\(\s*["']child_process["']\s*\)/gi,
      /require\s*\(\s*["']vm["']\s*\)/gi,
      /eval\s*\(/gi,
      /Function\s*\(/gi,
    ];

    const suspiciousOps = [];
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        suspiciousOps.push(...matches);
      }
    }

    return [...new Set(suspiciousOps)]; // Deduplicate
  }

  /**
   * Check suspicious commands
   */
  checkSuspiciousCommands(content) {
    const patterns = [
      /exec\s*\(/gi,
      /spawn\s*\(/gi,
      /shell\s*[:=]\s*["'](?:bash|sh|zsh)/gi,
      /rm\s+-rf/gi,
      /chmod\s+777/gi,
      /curl.*?\|\s*(?:sh|bash)/gi,
    ];

    const suspiciousCommands = [];
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        suspiciousCommands.push(...matches);
      }
    }

    return [...new Set(suspiciousCommands)];
  }

  /**
   * Check signature
   */
  async checkSignature(skillPath) {
    const result = {
      passed: false,
      signed: false,
      verified: false
    };

    try {
      const signaturePath = `${skillPath}.sig`;
      
      if (!(await safeExists(signaturePath, this.allowedDirs))) {
        result.message = 'No signature file found';
        return result;
      }

      result.signed = true;

      const files = await listFilesRecursively(skillPath);
      const hashes = [];
      
      for (const file of files) {
        const hash = await sha256File(file);
        hashes.push(hash);
      }

      const contentHash = hashes.sort().join('');
      const signature = await safeReadFile(signaturePath, this.allowedDirs);

      // Verify against trusted signers
      for (const [signer, secret] of Object.entries(this.trustedSigners)) {
        if (verifySignature(contentHash, signature.trim(), secret)) {
          result.verified = true;
          result.passed = true;
          result.signer = signer;
          break;
        }
      }

      if (!result.verified) {
        result.message = 'Signature verification failed - not from trusted signer';
      }

      return result;

    } catch (error) {
      result.message = `Signature check error: ${error.message}`;
      return result;
    }
  }

  /**
   * Check reputation
   */
  async checkReputation(skillPath) {
    const result = {
      passed: true,
      score: 100,
      flags: []
    };

    try {
      const skillName = skillPath.split('/').pop();
      const reputation = this.reputationDB.get(skillName);

      if (reputation) {
        result.score = reputation.score;
        result.flags = reputation.flags || [];
        result.lastUpdated = reputation.lastUpdated;

        if (result.score < 50) {
          result.passed = false;
          result.message = `Low reputation score: ${result.score}`;
        }
      } else {
        result.message = 'No reputation data available (assuming neutral)';
      }

      return result;

    } catch (error) {
      result.message = `Reputation check error: ${error.message}`;
      return result;
    }
  }

  /**
   * Verify permissions
   */
  async verifyPermissions(skillPath) {
    const result = {
      passed: true,
      violations: [],
      warnings: []
    };

    try {
      const files = await listFilesRecursively(skillPath);

      for (const file of files) {
        if (!file.endsWith('.js')) continue;

        const content = await safeReadFile(file, this.allowedDirs);

        // Check file access
        if (content.includes('fs.') || content.includes('require("fs")') || content.includes("require('fs')")) {
          if (!this.permissionPolicy.fileAccess.write) {
            result.violations.push({
              file,
              type: 'file_access',
              message: 'File system access not permitted'
            });
          } else {
            result.warnings.push({
              file,
              type: 'file_access',
              message: 'File system access allowed (check paths)'
            });
          }
        }

        // Check network access
        if (content.includes('http') || content.includes('net.') || content.includes('require("net")')) {
          if (!this.permissionPolicy.network.enabled) {
            result.violations.push({
              file,
              type: 'network',
              message: 'Network access not permitted'
            });
          }
        }

        // Check shell commands
        if (content.includes('child_process') || content.includes('exec') || content.includes('spawn')) {
          if (!this.permissionPolicy.system.allowShellCommands) {
            result.violations.push({
              file,
              type: 'shell',
              message: 'Shell commands not permitted'
            });
          }
        }

        // Check eval
        if (content.includes('eval(') || content.includes('Function(')) {
          if (!this.permissionPolicy.dangerousOperations.allowEval) {
            result.violations.push({
              file,
              type: 'eval',
              message: 'Eval/Function not permitted'
            });
          }
        }
      }

      result.passed = result.violations.length === 0;
      return result;

    } catch (error) {
      result.message = `Permission verification error: ${error.message}`;
      return result;
    }
  }

  /**
   * Finalize verification decision
   */
  finalizeVerification(verificationResult) {
    const { existence, codeIntegrity, signature, reputation, permissions } = verificationResult.checks;

    // Must exist and pass code integrity
    if (!existence?.passed) return false;
    if (codeIntegrity && !codeIntegrity.passed) return false;

    // Signature is optional but if present must be verified
    if (signature?.signed && !signature.verified) return false;

    // Reputation check
    if (reputation && !reputation.passed) return false;

    // Permission check
    if (permissions && !permissions.passed) return false;

    return true;
  }

  /**
   * Update skill reputation
   */
  updateReputation(skillName, score, flags = []) {
    this.reputationDB.set(skillName, {
      score: Math.max(0, Math.min(100, score)),
      flags,
      lastUpdated: Date.now()
    });

    this.logger.info(`Updated reputation for ${skillName}: score=${score}, flags=${flags.length}`);
  }

  /**
   * Get skill reputation
   */
  getReputation(skillName) {
    return this.reputationDB.get(skillName);
  }

  /**
   * Add trusted signer
   */
  addTrustedSigner(name, secret) {
    this.trustedSigners[name] = secret;
    this.logger.info(`Added trusted signer: ${name}`);
  }

  /**
   * Remove trusted signer
   */
  removeTrustedSigner(name) {
    delete this.trustedSigners[name];
    this.logger.info(`Removed trusted signer: ${name}`);
  }

  /**
   * Update permission policy
   */
  updatePermissionPolicy(newPolicy) {
    this.permissionPolicy = {
      ...this.permissionPolicy,
      ...newPolicy
    };
    this.logger.info('Permission policy updated');
  }
}

export default SkillVerifier;
