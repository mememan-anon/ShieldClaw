#!/usr/bin/env node

/**
 * Skill Verification Demo
 * 
 * Demonstrates the Skill Verification System functionality
 */

import chalk from 'chalk';
import { SkillVerifier } from '../src/verify/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ASCII Art Banner
const banner = `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ███╗   ██╗███████╗██╗  ██╗██╗   ██╗                     ║
║   ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║                     ║
║   ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║                     ║
║   ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║                     ║
║   ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝                     ║
║   ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝                      ║
║                                                           ║
║   Skill Verification System Demo                          ║
╚═══════════════════════════════════════════════════════════╝
`;

console.log(chalk.cyan(banner));
console.log(chalk.yellow('\n🔍 Starting Verification Demo...\n'));

// Create verifier
const verifier = new SkillVerifier({
  logLevel: 'info'
});

// Demo skills to verify
const exampleSkillPath = path.join(__dirname, '../skills/example-skill.js');
const safeSkillPath = path.join(__dirname, '../skills/safe-skill.js');

// Run demo
(async () => {
  try {
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.blue('Step 1: Initialize Verifier\n'));
    await verifier.initialize();
    console.log(chalk.green('✅ Verifier initialized\n'));
    
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.blue('Step 2: Register Example Skill\n'));
    const skillInfo = await verifier.registerSkill(exampleSkillPath, {
      name: 'Example Skill',
      author: 'ShieldClaw Team',
      version: '1.0.0',
      description: 'A safe, verified skill demonstrating ShieldClaw verification',
      permissions: [
        { type: 'file:read', resource: '/tmp/*' },
        { type: 'file:write', resource: '/tmp/*' }
      ]
    });
    console.log(chalk.green('✅ Skill registered:'), skillInfo.metadata.name);
    console.log(chalk.gray('   Hash:'), skillInfo.integrity.hash);
    console.log(chalk.gray('   Reputation:'), skillInfo.reputation.score);
    console.log('');
    
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.blue('Step 3: Verify Example Skill\n'));
    const result1 = await verifier.verifySkill(exampleSkillPath, {
      permissions: [
        { type: 'file:read', resource: '/tmp/*' },
        { type: 'file:write', resource: '/tmp/*' }
      ]
    });
    printVerificationResult('Example Skill', result1);
    
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.blue('Step 4: Simulate Reputation Update\n'));
    await verifier.updateReputation(path.basename(exampleSkillPath), true);
    await verifier.updateReputation(path.basename(exampleSkillPath), true);
    await verifier.updateReputation(path.basename(exampleSkillPath), false); // One failure
    console.log(chalk.green('✅ Reputation updated'));
    const updatedInfo = verifier.getSkillInfo(path.basename(exampleSkillPath));
    console.log(chalk.gray('   New Score:'), updatedInfo.reputation.score);
    console.log(chalk.gray('   Executions:'), updatedInfo.reputation.execCount);
    console.log(chalk.gray('   Successes:'), updatedInfo.reputation.successCount);
    console.log(chalk.gray('   Failures:'), updatedInfo.reputation.failureCount);
    console.log('');
    
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.blue('Step 5: Create and Verify Safe Skill\n'));
    
    // Create a safe skill on the fly
    await createSafeSkill(safeSkillPath);
    
    const result2 = await verifier.verifySkill(safeSkillPath, {
      permissions: [
        { type: 'file:read', resource: '/tmp/*' }
      ]
    });
    printVerificationResult('Safe Skill', result2);
    
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.blue('Step 6: Demonstrate Permission Denial\n'));
    
    // Try to verify with denied permissions
    const result3 = await verifier.verifySkill(exampleSkillPath, {
      permissions: [
        { type: 'file:write', resource: '/etc/passwd' }
      ]
    });
    printVerificationResult('Example Skill (Bad Permissions)', result3);
    
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.blue('Step 7: Demonstrate Security Scan\n'));
    
    // Create a skill with security issues
    const unsafeSkillPath = path.join(__dirname, '../skills/unsafe-skill.js');
    await createUnsafeSkill(unsafeSkillPath);
    
    const result4 = await verifier.verifySkill(unsafeSkillPath);
    printVerificationResult('Unsafe Skill', result4);
    
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.green('\n✅ Verification Demo Complete!\n'));
    console.log(chalk.cyan('📊 Summary:'));
    console.log('   ✅ Skill registration');
    console.log('   ✅ Integrity verification');
    console.log('   ✅ Reputation tracking');
    console.log('   ✅ Permission validation');
    console.log('   ✅ Security scanning');
    console.log('');
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
    process.exit(1);
  }
})();

/**
 * Print verification result
 */
function printVerificationResult(skillName, result) {
  console.log(chalk.bold(`Skill: ${skillName}`));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(chalk.gray(`Status: ${result.status}`));
  console.log(chalk.gray(`Verified: ${result.verified ? '✅' : '❌'}`));
  console.log('');
  
  if (Object.keys(result.checks).length > 0) {
    console.log(chalk.blue('Checks:'));
    for (const [checkName, check] of Object.entries(result.checks)) {
      const statusIcon = check.passed ? chalk.green('✅') : chalk.yellow('⚠️');
      console.log(chalk.gray(`  ${statusIcon} ${checkName}: ${check.message}`));
    }
    console.log('');
  }
  
  if (result.errors.length > 0) {
    console.log(chalk.red('Errors:'));
    for (const error of result.errors) {
      console.log(chalk.red(`  ❌ ${error}`));
    }
    console.log('');
  }
  
  if (result.warnings.length > 0) {
    console.log(chalk.yellow('Warnings:'));
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`  ⚠️  ${warning}`));
    }
    console.log('');
  }
  
  console.log('');
}

/**
 * Create a safe skill for demo
 */
async function createSafeSkill(filePath) {
  const content = `#!/usr/bin/env node

/**
 * Safe Skill - Follows Best Practices
 */

export async function run(options = {}) {
  console.log('Running safe skill...');
  
  // Safe operations only
  return {
    success: true,
    message: 'Safe skill completed'
  };
}

export const metadata = {
  name: 'Safe Skill',
  version: '1.0.0',
  author: 'ShieldClaw Team'
};
`;
  
  await import('fs').then(fs => fs.promises.writeFile(filePath, content));
}

/**
 * Create an unsafe skill for demo
 */
async function createUnsafeSkill(filePath) {
  const content = `#!/usr/bin/env node

/**
 * Unsafe Skill - Contains Security Issues
 */

export async function run(options = {}) {
  console.log('Running unsafe skill...');
  
  // Dangerous pattern: eval()
  const code = options.input || '';
  const result = eval(code);
  
  // Dangerous pattern: Function constructor
  const func = new Function('return 42');
  
  return {
    success: true,
    result: result + func()
  };
}

export const metadata = {
  name: 'Unsafe Skill',
  version: '1.0.0',
  author: 'Unknown'
};
`;
  
  await import('fs').then(fs => fs.promises.writeFile(filePath, content));
}
