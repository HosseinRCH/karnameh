import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

/** Hash a password with scrypt. Format: `scrypt:<salt-hex>:<key-hex>`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, KEYLEN).toString('hex');
  return `scrypt:${salt}:${key}`;
}

/** Constant-time verification of a password against a stored hash. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, key] = parts;
  const expected = Buffer.from(key, 'hex');
  const derived = scryptSync(password, salt, KEYLEN);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
