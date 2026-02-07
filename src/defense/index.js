/**
 * Prompt Injection Defense Module
 * Main entry point for prompt injection defense
 */

import { PromptInjectionDefense } from './defense.js';
import { InputSanitizer, createDefaultSanitizer } from './sanitizer.js';
import { PromptInjectionDetector, createDefaultDetector } from './detector.js';
import { LLMAnalyzer } from './llm-analyzer.js';

export { 
  PromptInjectionDefense, 
  InputSanitizer, 
  createDefaultSanitizer,
  PromptInjectionDetector,
  createDefaultDetector,
  LLMAnalyzer 
};

export default {
  PromptInjectionDefense,
  InputSanitizer,
  createDefaultSanitizer,
  PromptInjectionDetector,
  createDefaultDetector,
  LLMAnalyzer
};
