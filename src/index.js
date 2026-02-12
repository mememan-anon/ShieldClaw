/**
 * ShieldClaw - AI Agent Security Framework
 *
 * Defense-in-depth security for AI agents with:
 * - Runtime behavior monitoring (eBPF + fallback)
 * - Skill verification & reputation tracking
 * - Isolated execution (Docker containers)
 * - Prompt injection defense (pattern + heuristic + LLM)
 * - Sui blockchain audit trail & attestation
 * - OpenClaw agent ecosystem integration
 */

// Core modules
export { BehaviorMonitor, EBPFMonitor } from './monitor/index.js';
export { default as MonitorManager } from './monitor/index.js';
export { SkillVerifier } from './verify/index.js';
export { IsolatedExecutor } from './executor/index.js';
export {
  PromptInjectionDefense,
  InputSanitizer,
  createDefaultSanitizer,
  PromptInjectionDetector,
  createDefaultDetector,
  LLMAnalyzer
} from './defense/index.js';

// Blockchain integration
export { SuiBlockchainClient } from './blockchain/index.js';

// OpenClaw integration
export { OpenClawClient, ExecutionHooks, SecurityHooks } from './openclaw/index.js';

// Utilities
export { sha256, generateKey, generateSignature, verifySignature } from './utils/crypto.js';
export { createLogger, logSecurityEvent } from './utils/logger.js';

// Default export with all components
const ShieldClaw = {
  version: '0.1.0',
  description: 'AI Agent Security Framework'
};

export default ShieldClaw;
