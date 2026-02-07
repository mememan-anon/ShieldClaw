#!/usr/bin/env node

/**
 * Isolated Executor Demo
 * Demonstrates containerized skill execution with resource limits
 */

import { IsolatedExecutor } from '../src/executor/index.js';
import { createLogger } from '../src/utils/logger.js';

const logger = createLogger({ name: 'executor-demo' });

// Example skills
const exampleSkills = {
  'safe-compute': `
    // Safe computation skill
    console.log('Starting computation...');
    
    function fibonacci(n) {
      if (n <= 1) return n;
      return fibonacci(n - 1) + fibonacci(n - 2);
    }
    
    const result = fibonacci(35);
    console.log('Fibonacci(35) =', result);
    
    process.exit(0);
  `,
  
  'file-reader': `
    // File reader skill
    const fs = require('fs');
    
    console.log('Reading skill file...');
    const content = fs.readFileSync('/app/skill.js', 'utf8');
    console.log('File size:', content.length, 'bytes');
    
    process.exit(0);
  `,
  
  'network-test': `
    // Network test (should fail in isolated environment)
    console.log('Testing network access...');
    
    const http = require('http');
    http.get('http://example.com', (res) => {
      console.log('Response:', res.statusCode);
    }).on('error', (err) => {
      console.error('Network error (expected):', err.message);
      process.exit(0);
    });
  `
};

/**
 * Display results nicely
 */
function displayResult(result) {
  console.log('\n' + '='.repeat(60));
  console.log(`Execution ID: ${result.executionId}`);
  console.log(`Skill: ${result.skillName}`);
  console.log(`Container: ${result.containerName}`);
  console.log(`Success: ${result.success ? '✓' : '✗'}`);
  console.log(`Duration: ${result.duration}ms`);
  console.log('='.repeat(60));
  
  if (result.output) {
    console.log('\n📤 Output:');
    console.log(result.output.output || '(no output)');
  }
  
  if (result.error) {
    console.log('\n❌ Error:');
    console.log(result.error);
  }
  
  if (result.resourceUsage) {
    console.log('\n📊 Resource Usage:');
    console.log(`  CPU: ${result.resourceUsage.cpu}%`);
    if (result.resourceUsage.memory) {
      console.log(`  Memory: ${Math.round(result.resourceUsage.memory.used / 1024 / 1024)}MB / ${Math.round(result.resourceUsage.memory.limit / 1024 / 1024)}MB (${result.resourceUsage.memory.percent}%)`);
    }
    if (result.resourceUsage.network) {
      console.log(`  Network: ${result.resourceUsage.network.rx} bytes RX, ${result.resourceUsage.network.tx} bytes TX`);
    }
  }
  
  console.log('');
}

/**
 * Run demo
 */
async function runDemo() {
  console.log('🐳 ShieldClaw Isolated Executor Demo\n');
  console.log('This demo shows containerized skill execution with:');
  console.log('  • Resource limits (CPU, memory, disk)');
  console.log('  • Network isolation');
  console.log('  • File system restrictions');
  console.log('  • Automatic cleanup');
  console.log('');

  // Create executor
  const executor = new IsolatedExecutor({
    defaultImage: 'node:22-alpine',
    resourceLimits: {
      memory: '256m',
      cpus: '0.5'
    },
    networkEnabled: false, // Isolated from network
    autoCleanup: true,
    timeout: 30000
  });

  try {
    // Get system status
    console.log('🔍 Checking system status...');
    const status = await executor.getSystemStatus();
    console.log(`Docker: ${status.systemInfo.ServerVersion}`);
    console.log(`Active containers: ${status.activeContainers}\n`);

    // Execute safe compute skill
    console.log('▶️  Executing safe-compute skill...');
    const computeResult = await executor.execute('safe-compute', exampleSkills['safe-compute']);
    displayResult(computeResult);

    // Execute file reader skill
    console.log('▶️  Executing file-reader skill...');
    const fileResult = await executor.execute('file-reader', exampleSkills['file-reader']);
    displayResult(fileResult);

    // Execute network test (should fail or show network restriction)
    console.log('▶️  Executing network-test skill...');
    const networkResult = await executor.execute('network-test', exampleSkills['network-test']);
    displayResult(networkResult);

    // Show active containers
    console.log('📋 Active containers:');
    const activeContainers = executor.getActiveContainers();
    if (activeContainers.length === 0) {
      console.log('  (none - all containers cleaned up)');
    } else {
      for (const container of activeContainers) {
        console.log(`  • ${container.name} (runtime: ${container.runtime}ms)`);
      }
    }

    console.log('\n✅ Demo completed successfully!');

  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      await executor.stopAll();
    } catch (error) {
      logger.error('Cleanup failed:', error);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default runDemo;
