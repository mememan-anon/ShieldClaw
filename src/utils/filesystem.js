/**
 * Filesystem utilities for ShieldClaw
 * Provides safe file operations with security checks
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Check if path is within allowed directories
 */
export function isPathAllowed(filePath, allowedDirs) {
  const resolvedPath = path.resolve(filePath);
  
  for (const allowedDir of allowedDirs) {
    const resolvedAllowed = path.resolve(allowedDir);
    if (resolvedPath.startsWith(resolvedAllowed + path.sep) || resolvedPath === resolvedAllowed) {
      return true;
    }
  }
  
  return false;
}

/**
 * Sanitize file path to prevent directory traversal
 */
export function sanitizePath(filePath, basePath) {
  const normalized = path.normalize(filePath);
  const resolved = path.resolve(basePath, normalized);
  
  if (!resolved.startsWith(path.resolve(basePath) + path.sep) && resolved !== path.resolve(basePath)) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }
  
  return resolved;
}

/**
 * Safe file read with path validation
 */
export async function safeReadFile(filePath, allowedDirs = []) {
  if (!isPathAllowed(filePath, allowedDirs)) {
    throw new Error(`Access denied to path: ${filePath}`);
  }
  
  return await fs.readFile(filePath, 'utf-8');
}

/**
 * Safe file write with path validation
 */
export async function safeWriteFile(filePath, content, allowedDirs = []) {
  if (!isPathAllowed(filePath, allowedDirs)) {
    throw new Error(`Access denied to path: ${filePath}`);
  }
  
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  
  return await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Safe file deletion with path validation
 */
export async function safeDeleteFile(filePath, allowedDirs = []) {
  if (!isPathAllowed(filePath, allowedDirs)) {
    throw new Error(`Access denied to path: ${filePath}`);
  }
  
  return await fs.unlink(filePath);
}

/**
 * List files in directory recursively
 */
export async function listFilesRecursively(dirPath, maxDepth = 10, currentDepth = 0) {
  if (currentDepth > maxDepth) {
    throw new Error(`Maximum depth exceeded: ${maxDepth}`);
  }
  
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      const subFiles = await listFilesRecursively(fullPath, maxDepth, currentDepth + 1);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Get file stats with security checks
 */
export async function safeStat(filePath, allowedDirs = []) {
  if (!isPathAllowed(filePath, allowedDirs)) {
    throw new Error(`Access denied to path: ${filePath}`);
  }
  
  return await fs.stat(filePath);
}

/**
 * Check if file exists safely
 */
export async function safeExists(filePath, allowedDirs = []) {
  if (!isPathAllowed(filePath, allowedDirs)) {
    return false;
  }
  
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create temporary directory
 */
export async function createTempDir(prefix = 'shieldclaw-') {
  const tempDir = path.join('/tmp', prefix + Date.now());
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Clean up temporary directory
 */
export async function cleanupTempDir(tempDir) {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (err) {
    // Ignore cleanup errors
  }
}

/**
 * Validate file extension
 */
export function validateExtension(filePath, allowedExtensions) {
  const ext = path.extname(filePath).toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * Calculate directory size
 */
export async function calculateDirSize(dirPath) {
  const files = await listFilesRecursively(dirPath);
  let totalSize = 0;
  
  for (const file of files) {
    const stat = await fs.stat(file);
    totalSize += stat.size;
  }
  
  return totalSize;
}

/**
 * Ensure directory exists
 */
export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export default {
  isPathAllowed,
  sanitizePath,
  safeReadFile,
  safeWriteFile,
  safeDeleteFile,
  listFilesRecursively,
  safeStat,
  safeExists,
  createTempDir,
  cleanupTempDir,
  validateExtension,
  calculateDirSize,
  ensureDir
};
