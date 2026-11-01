import test from 'node:test';
import assert from 'node:assert/strict';
import { hotp, totp, verifyTotp, generateSecret, base32Decode } from '../src/lib/totp';

// RFC 6238 test vectors (SHA-1, 8 digits, secret "12345678901234567890").
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test('base32 round trip for the RFC secret', () => {
  assert.equal(base32Decode(SECRET).toString('ascii'), '12345678901234567890');
});

test('HOTP matches RFC 4226 vector (counter 1)', () => {
  assert.equal(hotp(SECRET, 1, 8), '94287082');
});

test('TOTP matches RFC 6238 vectors', () => {
  assert.equal(totp(SECRET, 59_000, 30, 8), '94287082');
  assert.equal(totp(SECRET, 1_111_111_109_000, 30, 8), '07081804');
  assert.equal(totp(SECRET, 1_111_111_111_000, 30, 8), '14050471');
});

test('verifyTotp accepts the current code and rejects a wrong one', () => {
  const secret = generateSecret();
  const code = totp(secret, 1_700_000_000_000);
  assert.equal(verifyTotp(secret, code, 1_700_000_000_000), true);
  assert.equal(verifyTotp(secret, '000000', 1_700_000_000_000), false);
});
