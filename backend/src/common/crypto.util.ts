import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { Logger } from '@nestjs/common';

const logger = new Logger('crypto');
const PREFIX = 'enc:v1:';

/**
 * Derive a 32-byte AES key. Prefer SECRETS_KEY (hex/base64); otherwise derive from JWT_SECRET
 * (dev fallback) so the app still runs locally — with a warning, since rotating JWT_SECRET would
 * make existing ciphertext unreadable.
 */
let cachedKey: Buffer | undefined;
function key(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.SECRETS_KEY;
  if (raw) {
    const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (buf.length === 32) {
      cachedKey = buf;
      return cachedKey;
    }
    logger.warn('SECRETS_KEY is set but not a 32-byte hex/base64 value; deriving a key from it instead.');
    cachedKey = scryptSync(raw, 'uifactory-secrets', 32);
    return cachedKey;
  }
  logger.warn('SECRETS_KEY is not set — deriving an at-rest encryption key from JWT_SECRET (dev only).');
  cachedKey = scryptSync(process.env.JWT_SECRET || 'dev-insecure-uifactory-secret', 'uifactory-secrets', 32);
  return cachedKey;
}

/** Encrypt a UTF-8 string with AES-256-GCM. Returns a self-describing token. */
export function encryptString(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

/** Decrypt a token from encryptString. Values without the prefix are returned as-is (back-compat). */
export function decryptString(stored: string): string {
  if (!stored?.startsWith(PREFIX)) return stored;
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch (e) {
    logger.error(`Failed to decrypt a stored secret: ${(e as Error).message}`);
    throw e;
  }
}

/** Convenience: encrypt/decrypt a JSON-serializable value. */
export const encryptJson = (value: unknown): string => encryptString(JSON.stringify(value));
export function decryptJson<T>(stored: string): T {
  return JSON.parse(decryptString(stored)) as T;
}
