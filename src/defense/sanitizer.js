/**
 * Input Sanitizer
 * Sanitizes user input to prevent prompt injection and other attacks
 */

import { PROMPT_INJECTION_PATTERNS } from '../utils/patterns.js';
import { createLogger } from '../utils/logger.js';

export class InputSanitizer {
  constructor(options = {}) {
    this.logger = createLogger({ name: 'input-sanitizer', ...options });
    
    // Configuration
    this.maxInputLength = options.maxInputLength || 10000;
    this.allowMarkdown = options.allowMarkdown !== false;
    this.allowCode = options.allowCode !== false;
    this.stripWhitespace = options.stripWhitespace || true;
    this.normalizeUnicode = options.normalizeUnicode !== false;
    
    // Blocking rules
    this.blockedPatterns = options.blockedPatterns || [];
    this.blockedWords = options.blockedWords || [];
    
    // Replacement rules
    this.replacements = {
      // System instructions
      'ignore (all )?(previous|above|the)? (instructions?|prompts?)': '[SYSTEM_INSTRUCTION_REMOVED]',
      'forget (everything|all|the)? (above|previous)': '[SYSTEM_INSTRUCTION_REMOVED]',
      'disregard (all )?(previous|above|the)? (instructions?|prompts?)': '[SYSTEM_INSTRUCTION_REMOVED]',
      
      // Role-playing
      'you are|act as|pretend to be|become (a )?(malicious|hacker|jailbroken|unrestricted)': '[ROLEPLAY_ATTEMPT_REMOVED]',
      
      // Jailbreak
      'dan mode|developer mode|jailbreak|bypass (safety|security|restrictions)': '[JAILBREAK_ATTEMPT_REMOVED]',
      
      // Dangerous commands
      '__import__|exec\\(|eval\\(|compile\\(': '[CODE_EXECUTION_REMOVED]'
    };
  }

  /**
   * Sanitize input
   */
  sanitize(input) {
    let sanitized = input;
    const removed = [];

    try {
      // Check input length
      if (sanitized.length > this.maxInputLength) {
        this.logger.warn(`Input too long: ${sanitized.length} > ${this.maxInputLength}`);
        sanitized = sanitized.substring(0, this.maxInputLength);
        removed.push('excessive_length');
      }

      // Normalize Unicode
      if (this.normalizeUnicode) {
        sanitized = sanitized.normalize('NFC');
      }

      // Strip excessive whitespace
      if (this.stripWhitespace) {
        sanitized = sanitized.replace(/\s+/g, ' ').trim();
      }

      // Apply pattern replacements
      for (const [pattern, replacement] of Object.entries(this.replacements)) {
        const regex = new RegExp(pattern, 'gi');
        const matches = sanitized.match(regex);
        if (matches) {
          sanitized = sanitized.replace(regex, replacement);
          removed.push(`pattern:${pattern}`);
        }
      }

      // Apply blocked patterns
      for (const pattern of this.blockedPatterns) {
        const regex = new RegExp(pattern, 'gi');
        if (regex.test(sanitized)) {
          sanitized = sanitized.replace(regex, '[BLOCKED_PATTERN]');
          removed.push(`blocked:${pattern}`);
        }
      }

      // Apply blocked words
      for (const word of this.blockedWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        if (regex.test(sanitized)) {
          sanitized = sanitized.replace(regex, '[BLOCKED_WORD]');
          removed.push(`blocked_word:${word}`);
        }
      }

      // Sanitize code blocks if not allowed
      if (!this.allowCode) {
        sanitized = sanitized.replace(/```[\s\S]*?```/g, '[CODE_BLOCK_REMOVED]');
        sanitized = sanitized.replace(/`[^`]+`/g, '[INLINE_CODE_REMOVED]');
      }

      // Sanitize Markdown if not allowed
      if (!this.allowMarkdown) {
        sanitized = sanitized.replace(/#+\s/g, '');
        sanitized = sanitized.replace(/\*\*([^*]+)\*\*/g, '$1');
        sanitized = sanitized.replace(/\*([^*]+)\*/g, '$1');
        sanitized = sanitized.replace(/~~([^~]+)~~/g, '$1');
        sanitized = sanitized.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      }

      // Remove potential shell commands
      sanitized = this.sanitizeCommands(sanitized);

      // Remove file paths
      sanitized = this.sanitizeFilePaths(sanitized);

      return {
        sanitized,
        safe: removed.length === 0,
        removed,
        originalLength: input.length,
        sanitizedLength: sanitized.length
      };

    } catch (error) {
      this.logger.error('Sanitization failed:', error);
      return {
        sanitized: input,
        safe: false,
        removed: [],
        error: error.message
      };
    }
  }

  /**
   * Sanitize shell commands
   */
  sanitizeCommands(input) {
    let sanitized = input;

    // Remove command patterns
    const commandPatterns = [
      /\$\([^)]+\)/g,           // $(command)
      /`[^`]+`/g,               // `command`
      /&&\s*[\w\s|&<>"']+/g,    // && chain
      /\|\s*[\w\s|&<>"']+/g,    // | pipe
      />\s*[/\w.]+/g,           // > redirect
      /curl\s+[\w\s-]+/gi,      // curl
      /wget\s+[\w\s-]+/gi,      // wget
      /bash\s+-c/gi,            // bash -c
      /sh\s+-c/gi,              // sh -c
    ];

    for (const pattern of commandPatterns) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, '[COMMAND_REMOVED]');
      }
    }

    return sanitized;
  }

  /**
   * Sanitize file paths
   */
  sanitizeFilePaths(input) {
    let sanitized = input;

    // Remove suspicious file paths
    const pathPatterns = [
      /\/(?:etc|root|proc|sys)\/[\w\/.-]+/g,
      /~\/[\w\/.-]+/g,
      /\.\.[\/\\]/g,             // Parent directory
      /[A-Z]:\\[\w\\.-]+/g,      // Windows paths
    ];

    for (const pattern of pathPatterns) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, '[PATH_REMOVED]');
      }
    }

    return sanitized;
  }

  /**
   * Check if input is safe
   */
  isSafe(input) {
    const result = this.sanitize(input);
    return result.safe;
  }

  /**
   * Sanitize batch of inputs
   */
  sanitizeBatch(inputs) {
    return inputs.map(input => this.sanitize(input));
  }

  /**
   * Extract metadata from input
   */
  extractMetadata(input) {
    const metadata = {
      length: input.length,
      words: input.split(/\s+/).length,
      lines: input.split('\n').length,
      hasCode: /```/.test(input) || /`[^`]+`/.test(input),
      hasMarkdown: /[#*_~\[\]]/.test(input),
      hasUrls: /https?:\/\//.test(input),
      hasEmail: /\b[\w.-]+@[\w.-]+\.\w+\b/.test(input),
      hasNumbers: /\d+/.test(input),
      hasSpecialChars: /[!@#$%^&*()]/.test(input)
    };

    return metadata;
  }

  /**
   * Validate input against schema
   */
  validateSchema(input, schema) {
    const errors = [];

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!input[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Check field types
    if (schema.fields) {
      for (const [field, rules] of Object.entries(schema.fields)) {
        const value = input[field];

        if (value === undefined || value === null) {
          if (rules.required) {
            errors.push(`Missing required field: ${field}`);
          }
          continue;
        }

        // Type check
        if (rules.type) {
          if (rules.type === 'string' && typeof value !== 'string') {
            errors.push(`${field} must be a string`);
          } else if (rules.type === 'number' && typeof value !== 'number') {
            errors.push(`${field} must be a number`);
          } else if (rules.type === 'boolean' && typeof value !== 'boolean') {
            errors.push(`${field} must be a boolean`);
          }
        }

        // Length check
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`${field} is too short (min: ${rules.minLength})`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${field} is too long (max: ${rules.maxLength})`);
        }

        // Pattern check
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`${field} does not match required pattern`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Add replacement rule
   */
  addReplacement(pattern, replacement) {
    this.replacements[pattern] = replacement;
    this.logger.debug(`Added replacement: ${pattern} -> ${replacement}`);
  }

  /**
   * Add blocked pattern
   */
  addBlockedPattern(pattern) {
    this.blockedPatterns.push(pattern);
    this.logger.debug(`Added blocked pattern: ${pattern}`);
  }

  /**
   * Add blocked word
   */
  addBlockedWord(word) {
    this.blockedWords.push(word.toLowerCase());
    this.logger.debug(`Added blocked word: ${word}`);
  }

  /**
   * Clear all replacements
   */
  clearReplacements() {
    this.replacements = {};
    this.logger.debug('Cleared all replacements');
  }

  /**
   * Clear all blocked patterns
   */
  clearBlockedPatterns() {
    this.blockedPatterns = [];
    this.logger.debug('Cleared all blocked patterns');
  }

  /**
   * Clear all blocked words
   */
  clearBlockedWords() {
    this.blockedWords = [];
    this.logger.debug('Cleared all blocked words');
  }

  /**
   * Get configuration
   */
  getConfig() {
    return {
      maxInputLength: this.maxInputLength,
      allowMarkdown: this.allowMarkdown,
      allowCode: this.allowCode,
      stripWhitespace: this.stripWhitespace,
      normalizeUnicode: this.normalizeUnicode,
      replacementsCount: Object.keys(this.replacements).length,
      blockedPatternsCount: this.blockedPatterns.length,
      blockedWordsCount: this.blockedWords.length
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    Object.assign(this, newConfig);
    this.logger.info('Configuration updated');
  }
}

/**
 * Create default sanitizer
 */
export function createDefaultSanitizer(options = {}) {
  return new InputSanitizer(options);
}

export default InputSanitizer;
