/**
 * Prompt Injection Detector
 * Detects prompt injection attacks using pattern matching and heuristics
 */

import { PROMPT_INJECTION_PATTERNS } from '../utils/patterns.js';
import { createLogger } from '../utils/logger.js';

export class PromptInjectionDetector {
  constructor(options = {}) {
    this.logger = createLogger({ name: 'prompt-detector', ...options });
    
    // Detection configuration
    this.strictMode = options.strictMode || false;
    this.threshold = options.threshold ?? 0.2;
    this.enableHeuristics = options.enableHeuristics !== false;
    this.enableMLDetection = options.enableMLDetection || false;
    
    // Custom patterns
    this.customPatterns = options.customPatterns || [];
    
    // Detection statistics
    this.stats = {
      totalChecks: 0,
      detections: 0,
      falsePositives: 0,
      byPattern: {}
    };
  }

  /**
   * Detect prompt injection in input
   */
  detect(input, context = {}) {
    this.stats.totalChecks++;

    const result = {
      input,
      detected: false,
      score: 0,
      confidence: 'low',
      patterns: [],
      heuristics: [],
      risks: [],
      timestamp: Date.now(),
      context
    };

    try {
      // Pattern-based detection
      const patternResult = this.detectPatterns(input);
      result.patterns = patternResult.patterns;
      result.score += patternResult.score;

      // Heuristic detection
      if (this.enableHeuristics) {
        const heuristicResult = this.detectHeuristics(input);
        result.heuristics = heuristicResult.heuristics;
        result.score += heuristicResult.score;
      }

      // Determine if detected
      result.detected = result.score >= this.threshold;

      // Calculate confidence
      if (result.score >= 0.8) {
        result.confidence = 'high';
      } else if (result.score >= 0.5) {
        result.confidence = 'medium';
      }

      // Identify risks
      result.risks = this.identifyRisks(result);

      // Update statistics
      if (result.detected) {
        this.stats.detections++;
        for (const pattern of result.patterns) {
          const key = pattern.pattern || 'unknown';
          this.stats.byPattern[key] = (this.stats.byPattern[key] || 0) + 1;
        }
      }

      this.logger.debug(`Detection result: score=${result.score.toFixed(2)}, detected=${result.detected}`);

      return result;

    } catch (error) {
      this.logger.error('Detection failed:', error);
      result.error = error.message;
      return result;
    }
  }

  /**
   * Detect patterns in input
   */
  detectPatterns(input) {
    const result = {
      patterns: [],
      score: 0
    };

    // Check built-in patterns
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      const matches = input.match(pattern);
      if (matches) {
        result.patterns.push({
          type: 'builtin',
          pattern: pattern.source,
          matches: matches.slice(0, 5), // Limit to 5 matches
          severity: this.getPatternSeverity(pattern)
        });
        result.score += 0.25;
      }
    }

    // Check custom patterns
    for (const pattern of this.customPatterns) {
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'gi');
      const matches = input.match(regex);
      if (matches) {
        result.patterns.push({
          type: 'custom',
          pattern: regex.source,
          matches: matches.slice(0, 5),
          severity: pattern.severity || 'medium'
        });
        result.score += 0.3;
      }
    }

    // Cap score at 1.0
    result.score = Math.min(result.score, 1.0);

    return result;
  }

  /**
   * Detect heuristics
   */
  detectHeuristics(input) {
    const result = {
      heuristics: [],
      score: 0
    };

    const words = input.trim().split(/\s+/);
    const chars = input.split('');

    // Length analysis
    if (words.length < 3) {
      result.heuristics.push({
        type: 'length',
        name: 'very_short',
        description: 'Input is very short',
        severity: 'low'
      });
      result.score += 0.05;
    } else if (words.length > 500) {
      result.heuristics.push({
        type: 'length',
        name: 'very_long',
        description: 'Input is very long',
        severity: 'medium'
      });
      result.score += 0.1;
    }

    // Repetition detection
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    if (words.length > 10 && uniqueWords.size / words.length < 0.3) {
      result.heuristics.push({
        type: 'repetition',
        name: 'high_repetition',
        description: 'Input contains high repetition',
        severity: 'medium'
      });
      result.score += 0.15;
    }

    // Punctuation analysis
    const punctuationCount = chars.filter(c => /[!@#$%^&*()]/.test(c)).length;
    if (punctuationCount > words.length * 0.3) {
      result.heuristics.push({
        type: 'punctuation',
        name: 'excessive_punctuation',
        description: 'Input contains excessive punctuation',
        severity: 'low'
      });
      result.score += 0.1;
    }

    // Case analysis
    const lowerCount = chars.filter(c => /[a-z]/.test(c)).length;
    const upperCount = chars.filter(c => /[A-Z]/.test(c)).length;
    if (lowerCount > 10 && upperCount > 10) {
      const ratio = Math.min(lowerCount, upperCount) / Math.max(lowerCount, upperCount);
      if (ratio > 0.4 && ratio < 0.6) {
        result.heuristics.push({
          type: 'case',
          name: 'random_case',
          description: 'Input has suspicious case distribution',
          severity: 'low'
        });
        result.score += 0.05;
      }
    }

    // Special character sequences
    if (/[\x00-\x1F\x7F-\x9F]/.test(input)) {
      result.heuristics.push({
        type: 'encoding',
        name: 'control_characters',
        description: 'Input contains control characters',
        severity: 'medium'
      });
      result.score += 0.15;
    }

    // URL analysis
    const urlCount = (input.match(/https?:\/\//g) || []).length;
    if (urlCount > 3) {
      result.heuristics.push({
        type: 'urls',
        name: 'many_urls',
        description: 'Input contains many URLs',
        severity: 'medium'
      });
      result.score += 0.1;
    }

    // Emoji analysis (can be used to bypass filters)
    const emojiCount = (input.match(/[\p{Emoji}]/gu) || []).length;
    if (emojiCount > 5) {
      result.heuristics.push({
        type: 'emoji',
        name: 'many_emojis',
        description: 'Input contains many emojis',
        severity: 'low'
      });
      result.score += 0.05;
    }

    // Cap score at 1.0
    result.score = Math.min(result.score, 1.0);

    return result;
  }

  /**
   * Get pattern severity
   */
  getPatternSeverity(pattern) {
    const patternStr = pattern.source.toLowerCase();

    if (patternStr.includes('malicious') || patternStr.includes('hacker') || patternStr.includes('jailbreak')) {
      return 'high';
    } else if (patternStr.includes('ignore') || patternStr.includes('forget') || patternStr.includes('disregard')) {
      return 'high';
    } else if (patternStr.includes('exec') || patternStr.includes('eval')) {
      return 'high';
    } else if (patternStr.includes('password') || patternStr.includes('secret') || patternStr.includes('credential') || patternStr.includes('exfiltrate')) {
      return 'high';
    } else if (patternStr.includes('role') || patternStr.includes('act as') || patternStr.includes('pretend')) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Identify specific risks
   */
  identifyRisks(result) {
    const risks = [];

    // Check for instruction override
    const hasOverride = result.patterns.some(p => 
      p.pattern.includes('ignore') || 
      p.pattern.includes('forget') ||
      p.pattern.includes('disregard')
    );
    if (hasOverride) {
      risks.push({
        type: 'instruction_override',
        severity: 'high',
        description: 'Attempt to override system instructions'
      });
    }

    // Check for jailbreak
    const hasJailbreak = result.patterns.some(p =>
      p.pattern.includes('jailbreak') ||
      p.pattern.includes('dan') ||
      p.pattern.includes('bypass')
    );
    if (hasJailbreak) {
      risks.push({
        type: 'jailbreak',
        severity: 'high',
        description: 'Jailbreak attempt detected'
      });
    }

    // Check for code injection
    const hasCodeInjection = result.patterns.some(p =>
      p.pattern.includes('exec') ||
      p.pattern.includes('eval') ||
      p.pattern.includes('__import__')
    );
    if (hasCodeInjection) {
      risks.push({
        type: 'code_injection',
        severity: 'high',
        description: 'Code injection attempt detected'
      });
    }

    // Check for role-playing
    const hasRoleplay = result.patterns.some(p =>
      p.pattern.includes('role') ||
      p.pattern.includes('act as') ||
      p.pattern.includes('pretend')
    );
    if (hasRoleplay) {
      risks.push({
        type: 'role_play',
        severity: 'medium',
        description: 'Role-playing attempt detected'
      });
    }

    // Check for data exfiltration
    const hasExfiltration = result.patterns.some(p =>
      p.pattern.includes('password') ||
      p.pattern.includes('secret') ||
      p.pattern.includes('token') ||
      p.pattern.includes('key') ||
      p.pattern.includes('credential') ||
      p.pattern.includes('env')
    );
    if (hasExfiltration) {
      risks.push({
        type: 'data_exfiltration',
        severity: 'high',
        description: 'Attempt to extract sensitive data (passwords, keys, secrets)'
      });
    }

    // Check for context manipulation
    const hasContextManip = result.heuristics.some(h =>
      h.type === 'length' && h.name === 'very_long'
    );
    if (hasContextManip && result.score > 0.6) {
      risks.push({
        type: 'context_manipulation',
        severity: 'medium',
        description: 'Potential context manipulation via long input'
      });
    }

    return risks;
  }

  /**
   * Detect in batch
   */
  detectBatch(inputs, context = {}) {
    return inputs.map((input, index) => 
      this.detect(input, { ...context, index })
    );
  }

  /**
   * Add custom pattern
   */
  addCustomPattern(pattern, options = {}) {
    this.customPatterns.push({
      pattern,
      severity: options.severity || 'medium',
      description: options.description || ''
    });
    this.logger.debug(`Added custom pattern: ${pattern}`);
  }

  /**
   * Clear custom patterns
   */
  clearCustomPatterns() {
    this.customPatterns = [];
    this.logger.debug('Cleared custom patterns');
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      detectionRate: this.stats.totalChecks > 0 
        ? this.stats.detections / this.stats.totalChecks 
        : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.stats = {
      totalChecks: 0,
      detections: 0,
      falsePositives: 0,
      byPattern: {}
    };
    this.logger.info('Statistics reset');
  }

  /**
   * Report false positive
   */
  reportFalsePositive(input) {
    this.stats.falsePositives++;
    this.logger.warn('False positive reported');
    
    // Log for analysis
    this.logger.debug('False positive input:', input.substring(0, 200));
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    Object.assign(this, newConfig);
    this.logger.info('Configuration updated');
  }

  /**
   * Export detection rules
   */
  exportRules() {
    return {
      strictMode: this.strictMode,
      threshold: this.threshold,
      enableHeuristics: this.enableHeuristics,
      enableMLDetection: this.enableMLDetection,
      customPatterns: this.customPatterns.map(p => ({
        pattern: p.pattern instanceof RegExp ? p.pattern.source : p.pattern,
        severity: p.severity,
        description: p.description
      }))
    };
  }

  /**
   * Import detection rules
   */
  importRules(rules) {
    Object.assign(this, {
      strictMode: rules.strictMode,
      threshold: rules.threshold,
      enableHeuristics: rules.enableHeuristics,
      enableMLDetection: rules.enableMLDetection
    });

    if (rules.customPatterns) {
      this.customPatterns = rules.customPatterns.map(p => ({
        pattern: new RegExp(p.pattern, 'gi'),
        severity: p.severity,
        description: p.description
      }));
    }

    this.logger.info('Rules imported');
  }
}

/**
 * Create default detector
 */
export function createDefaultDetector(options = {}) {
  return new PromptInjectionDetector(options);
}

export default PromptInjectionDetector;
