/**
 * OpenClaw Integration Module
 * Main entry point for OpenClaw API integration
 */

import { OpenClawClient } from './client.js';
import { ExecutionHooks, SecurityHooks } from './hooks.js';

export { OpenClawClient, ExecutionHooks, SecurityHooks };

export default {
  OpenClawClient,
  ExecutionHooks,
  SecurityHooks
};
