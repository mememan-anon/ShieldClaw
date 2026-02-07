#!/usr/bin/env node

/**
 * Example Skill - Demonstrates ShieldClaw Verification
 * 
 * This is a safe, verified skill that follows best practices.
 */

import { promises as fs } from 'fs';

export async function run(options = {}) {
  console.log('Running example skill...');
  
  // Read a file from /tmp
  const content = await fs.readFile('/tmp/input.txt', 'utf8')
    .catch(() => 'No input file found');
  
  // Process the content
  const result = content.toUpperCase();
  
  // Write output to /tmp
  await fs.mkdir('/tmp', { recursive: true });
  await fs.writeFile('/tmp/output.txt', result);
  
  return {
    success: true,
    result,
    message: 'Example skill completed successfully'
  };
}

export const metadata = {
  name: 'Example Skill',
  version: '1.0.0',
  description: 'A safe, verified skill demonstrating ShieldClaw verification',
  author: 'ShieldClaw Team',
  permissions: [
    { type: 'file:read', resource: '/tmp/*' },
    { type: 'file:write', resource: '/tmp/*' }
  ]
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run()
    .then(console.log)
    .catch(console.error);
}
