/**
 * Cryptographic utilities for ShieldClaw
 * Provides hash generation, signature verification, and encryption helpers
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import { createHash, verify } from 'crypto';

/**
 * Generate SHA-256 hash of content
 */
export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Generate SHA-256 hash of a file
 */
export async function sha256File(filePath) {
  const content = await fs.readFile(filePath);
  return sha256(content);
}

/**
 * Verify content matches expected hash
 */
export function verifyHash(content, expectedHash) {
  const actualHash = sha256(content);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Generate deterministic signature for code verification
 */
export function generateSignature(content, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(content);
  return hmac.digest('hex');
}

/**
 * Verify signature matches expected
 */
export function verifySignature(content, signature, secret) {
  const expectedSignature = generateSignature(content, secret);
  return expectedSignature === signature;
}

/**
 * Generate a secure random key
 */
export function generateKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(data, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encryptedData, key) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate Merkle root from array of hashes
 */
export function generateMerkleRoot(hashes) {
  if (hashes.length === 0) {
    return '0'.repeat(64);
  }
  
  if (hashes.length === 1) {
    return hashes[0];
  }
  
  while (hashes.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = i + 1 < hashes.length ? hashes[i + 1] : hashes[i];
      nextLevel.push(sha256(left + right));
    }
    hashes = nextLevel;
  }
  
  return hashes[0];
}

/**
 * Generate Merkle proof for a given hash
 */
export function generateMerkleProof(hashes, targetHash) {
  const proof = [];
  let index = hashes.indexOf(targetHash);
  
  if (index === -1) {
    return { proof, root: generateMerkleRoot(hashes) };
  }
  
  let level = [...hashes];
  while (level.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      
      if (i === index || (i + 1 === index && i % 2 === 0)) {
        proof.push({
          position: index % 2 === 0 ? 'left' : 'right',
          hash: index % 2 === 0 ? (right || left) : left
        });
        index = Math.floor(index / 2);
      }
      
      nextLevel.push(sha256(left + right));
    }
    level = nextLevel;
  }
  
  return { proof, root: level[0] };
}

/**
 * Verify Merkle proof
 */
export function verifyMerkleProof(targetHash, proof, root) {
  let current = targetHash;
  
  for (const { position, hash } of proof) {
    if (position === 'left') {
      current = sha256(current + hash);
    } else {
      current = sha256(hash + current);
    }
  }
  
  return current === root;
}

export default {
  sha256,
  sha256File,
  verifyHash,
  generateSignature,
  verifySignature,
  generateKey,
  encrypt,
  decrypt,
  generateMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof
};
