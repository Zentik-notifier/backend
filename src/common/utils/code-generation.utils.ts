import * as crypto from 'crypto';
import { isUuid } from './validation.utils';

/**
 * Generate a unique magic code for user-bucket authentication
 * Format: 8 hexadecimal characters
 * @returns A random 8-character hex string
 */
export function generateMagicCode(): string {
  const randomBytes = crypto.randomBytes(4);
  return randomBytes.toString('hex');
}

/**
 * Check if a bucket identifier is likely a magic code
 * Magic codes are 8 hex characters and are not UUIDs
 * @param bucketId - The bucket identifier to check
 * @returns true if the identifier appears to be a magic code
 */
export function isMagicCode(bucketId: string): boolean {
  const isValidUuid = isUuid(bucketId);
  const isLikelyMagicCode = !isValidUuid && /^[0-9a-fA-F]{8}$/.test(bucketId);
  return isLikelyMagicCode;
}

