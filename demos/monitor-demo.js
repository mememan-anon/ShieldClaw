#!/usr/bin/env node

/**
 * Monitor Demo
 * 
 * Demonstrates the Runtime Behavior Monitor functionality
 */

import chalk from 'chalk';
import MonitorManager from '../src/monitor/index.js';

// ASCII Art Banner
const banner = `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ███████╗██╗   ██╗███╗   ██╗████████╗███████╗███╗   ███╗ ║
║   ██╔════╝██║   ██║████╗  ██║╚══██╔══╝██╔════╝████╗ ████║ ║
║   ███████╗██║   ██║██╔██╗ ██║   ██║   █████╗  ██╔████╔██║ ║
║   ╚════██║██║   ██║██║╚██╗██║   ██║   ██╔══╝  ██║╚██╔╝██║ ║
║   ███████║╚██████╔╝██║ ╚████║   ██║   ███████╗██║ ╚═╝ ██║ ║
║   ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝     ╚═╝ ║
║                                                           ║
║   Runtime Behavior Monitor Demo                           ║
╚═══════════════════════════════════════════════════════════╝
`;

console.log(chalk.cyan(banner));
console.log(chalk.yellow('\n🎯 Starting Monitor Demo...\n'));

// Create monitor manager
const manager = new MonitorManager({
  checkInterval: 2000, // Check every 2 seconds
  historySize: 30,
  thresholds: {
    cpu: 50,      // Lower threshold for demo
    memory: 60,   // Lower threshold for demo
    network: 1024 * 100, // 100 KB/s
    disk: 1024 * 100     // 100 KB/s
  }
});

// Event handlers
manager.on('alert', (alert) => {
  console.log(chalk.yellow('⚠️  ALERT:'), alert.details[0]?.message || alert.message);
});

manager.on('critical', (alert) => {
  console.log(chalk.red('🚨 CRITICAL:'), alert.details[0]?.message || alert.message);
});

manager.on('syscall', (data) => {
  if (data.syscall === 'context_switch') {
    // Suppress frequent context switch events
    return;
  }
  console.log(chalk.gray(`  📋 Syscall: ${data.syscall} from ${data.comm} (${data.pid})`));
});

// Start monitoring
(async () => {
  try {
    await manager.start();
    
    // Print initial status after baseline established
    setTimeout(() => {
      console.log(chalk.green('✅ Baseline established'));
      manager.printStatus();
      
      // Simulate some activity
      simulateActivity();
    }, 5000);
    
    // Print status periodically
    const statusInterval = setInterval(() => {
      manager.printStatus();
    }, 15000);
    
    // Handle shutdown
    process.on('SIGINT', () => {
      clearInterval(statusInterval);
      console.log(chalk.yellow('\n\n🛑 Shutting down monitor...'));
      manager.stop();
      console.log(chalk.green('✅ Monitor stopped'));
      console.log(chalk.cyan('\n📊 Final Statistics:'));
      const stats = manager.getStatistics();
      console.log(JSON.stringify(stats, null, 2));
      process.exit(0);
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
    process.exit(1);
  }
})();

/**
 * Simulate activity for demo purposes
 */
function simulateActivity() {
  console.log(chalk.blue('\n🎭 Simulating Agent Activity...\n'));
  
  // Phase 1: Normal activity
  setTimeout(() => {
    console.log(chalk.gray('  📝 Phase 1: Normal processing...'));
  }, 2000);
  
  // Phase 2: Increased CPU usage
  setTimeout(() => {
    console.log(chalk.gray('  🔢 Phase 2: Intensive computation...'));
    simulateHighCPU();
  }, 5000);
  
  // Phase 3: Memory pressure
  setTimeout(() => {
    console.log(chalk.gray('  💾 Phase 3: Memory allocation...'));
    simulateMemoryUsage();
  }, 10000);
  
  // Phase 4: Network activity
  setTimeout(() => {
    console.log(chalk.gray('  🌐 Phase 4: Network I/O...'));
    console.log(chalk.gray('     (Network alerts may trigger)'));
  }, 15000);
  
  // Phase 5: Return to normal
  setTimeout(() => {
    console.log(chalk.gray('  ✓ Phase 5: Normal operation restored'));
    console.log(chalk.green('\n✅ Activity simulation complete\n'));
  }, 20000);
}

/**
 * Simulate high CPU usage
 */
function simulateHighCPU() {
  const start = Date.now();
  const duration = 3000; // 3 seconds
  
  const interval = setInterval(() => {
    // CPU-intensive computation
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i);
    }
    
    if (Date.now() - start > duration) {
      clearInterval(interval);
    }
  }, 100);
}

/**
 * Simulate memory usage
 */
function simulateMemoryUsage() {
  const arrays = [];
  
  // Allocate memory in chunks
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      const size = 1024 * 1024 * 5; // 5 MB
      const buffer = new Uint8Array(size);
      // Fill buffer to ensure allocation
      for (let j = 0; j < buffer.length; j += 4096) {
        buffer[j] = Math.random() * 255;
      }
      arrays.push(buffer);
      console.log(chalk.gray(`     Allocated ${(size / 1024 / 1024).toFixed(0)} MB (total: ${(arrays.length * size / 1024 / 1024).toFixed(0)} MB)`));
    }, i * 200);
  }
  
  // Clean up after delay
  setTimeout(() => {
    arrays.length = 0;
    console.log(chalk.gray('     Memory freed'));
  }, 4000);
}
