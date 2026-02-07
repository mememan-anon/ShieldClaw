/**
 * Pattern detection utilities for ShieldClaw
 * Common patterns for detecting malicious behavior and prompt injection
 */

/**
 * Known prompt injection patterns
 */
export const PROMPT_INJECTION_PATTERNS = [
  // Direct instruction overrides
  /ignore\s+(all\s+)?(previous|above|the)\s+(instructions?|prompts?)/gi,
  /disregard\s+(all\s+)?(previous|above|the)\s+(instructions?|prompts?)/gi,
  /forget\s+(everything|all|the)\s+(above|previous)/gi,
  
  // Role-playing attempts
  /(?:you\s+are|act\s+as|pretend\s+to\s+be|become)\s+(?:a\s+)?(?:malicious|hacker|jailbroken|unrestricted)/gi,
  /(?:you\s+are|act\s+as|pretend\s+to\s+be|become)\s+(?:a\s+)?(?:developer|admin|root)/gi,
  /roleplay\s+as\s+(?:a\s+)?(?:malicious|hacker|unrestricted)/gi,
  
  // Jailbreak attempts
  /(?:dan\s+mode|developer\s+mode|jailbreak|bypass|override)/gi,
  /(?:ignore|break|override)\s+(?:safety|security|restrictions)/gi,
  /(?:do\s+)?(?:whatever|anything)\s+(?:i\s+)?(?:want|say|ask)/gi,
  
  // Context manipulation
  /(?:the\s+)?(real\s+)?(context|instructions|prompt|system\s+message)\s+is/gi,
  /(?:your\s+)?(?:true|real|actual)\s+(?:instructions?|goal|purpose)/gi,
  
  // Confusion tactics
  /(?:what\s+(?:if|would happen)|imagine|hypothetically|theoretically)/gi,
  /(?:just\s+)?(?:answering|responding)\s+(?:as\s+)?(?:if|though)/gi,
  
  // Code injection patterns
  /(?:execute|run|eval)\s+["']?(?:python|javascript|bash|shell|code|script)/gi,
  /__import__|eval\(|compile\(/gi,
  /os\.system|subprocess\.|Popen\(/gi,
  
  // Data exfiltration attempts
  /(?:print|output|show|display|return|expose)\s+(?:all|the\s+)?(?:passwords?|keys?|tokens?|secrets?)/gi,
  /(?:reveal|leak|dump)\s+(?:internal|system|admin)/gi,
];

/**
 * Suspicious file paths
 */
export const SUSPICIOUS_FILE_PATTERNS = [
  /\/(?:etc|root)\/(?:passwd|shadow|hosts|ssh)/gi,
  /\/(?:proc|sys)\/.*/gi,
  /\/(?:home|var)\/.*\/\.(?:ssh|git|config)/gi,
  /\.env$|\.key$|\.pem$|\.crt$/gi,
];

/**
 * Suspicious network patterns
 */
export const SUSPICIOUS_NETWORK_PATTERNS = [
  /(?:0x[0-9a-f]+\.){3}0x[0-9a-f]+/gi,  // Hex IPs
  /10\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)/gi,  // Private networks
  /192\.168\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)/gi,
  /172\.(?:1[6-9]|2\d|3[01])\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)/gi,
];

/**
 * Dangerous system calls
 */
export const DANGEROUS_SYSCALLS = [
  'execve', 'fork', 'clone',
  'ptrace', 'setuid', 'setgid',
  'chmod', 'chown', 'chroot',
  'mount', 'umount', 'pivot_root',
  'swapon', 'swapoff',
  'reboot', 'power_off',
  'delete_module', 'init_module',
  'kexec_load',
];

/**
 * Suspicious command patterns
 */
export const SUSPICIOUS_COMMAND_PATTERNS = [
  /(?:curl|wget)\s+.*?https?:\/\//gi,
  /nc\s+.*?\s+\d+/gi,
  /(?:chmod|chown)\s+\d+.*?\//gi,
  /(?:rm|dd)\s+(?:-rf|-f)/gi,
  /\/bin\/(?:sh|bash|zsh)\s+-/gi,
];

/**
 * Check if text matches any prompt injection pattern
 */
export function detectPromptInjection(text) {
  const matches = [];
  
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    const found = text.match(pattern);
    if (found) {
      matches.push({
        pattern: pattern.source,
        matches: found
      });
    }
  }
  
  return matches;
}

/**
 * Check if file path is suspicious
 */
export function isSuspiciousFilePath(filePath) {
  for (const pattern of SUSPICIOUS_FILE_PATTERNS) {
    if (pattern.test(filePath)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if network address is suspicious
 */
export function isSuspiciousNetwork(address) {
  for (const pattern of SUSPICIOUS_NETWORK_PATTERNS) {
    if (pattern.test(address)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if syscall is dangerous
 */
export function isDangerousSyscall(syscall) {
  return DANGEROUS_SYSCALLS.includes(syscall);
}

/**
 * Check if command is suspicious
 */
export function isSuspiciousCommand(command) {
  for (const pattern of SUSPICIOUS_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate risk score based on detections
 */
export function calculateRiskScore(detections) {
  let score = 0;
  
  for (const detection of detections) {
    if (detection.severity === 'critical') {
      score += 50;
    } else if (detection.severity === 'high') {
      score += 25;
    } else if (detection.severity === 'medium') {
      score += 10;
    } else {
      score += 5;
    }
  }
  
  return Math.min(score, 100); // Cap at 100
}

export default {
  PROMPT_INJECTION_PATTERNS,
  SUSPICIOUS_FILE_PATTERNS,
  SUSPICIOUS_NETWORK_PATTERNS,
  DANGEROUS_SYSCALLS,
  SUSPICIOUS_COMMAND_PATTERNS,
  detectPromptInjection,
  isSuspiciousFilePath,
  isSuspiciousNetwork,
  isDangerousSyscall,
  isSuspiciousCommand,
  calculateRiskScore
};
