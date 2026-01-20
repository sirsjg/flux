import { describe, expect, it } from 'vitest';
import {
  generateKey,
  generateTempToken,
  hashKey,
  validateKey,
  encrypt,
  decrypt,
} from '../src/auth.js';

describe('auth', () => {
  describe('generateKey', () => {
    it('generates key with flx_ prefix', () => {
      const { key } = generateKey();
      expect(key.startsWith('flx_')).toBe(true);
    });

    it('generates key of correct length', () => {
      const { key } = generateKey();
      expect(key.length).toBe(36); // flx_ (4) + 32 chars
    });

    it('generates unique keys', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        keys.add(generateKey().key);
      }
      expect(keys.size).toBe(100);
    });

    it('returns prefix as first 12 chars', () => {
      const { key, prefix } = generateKey();
      expect(prefix).toBe(key.slice(0, 12));
    });

    it('returns hash of the key', () => {
      const { key, hash } = generateKey();
      expect(hash).toBe(hashKey(key));
    });
  });

  describe('generateTempToken', () => {
    it('generates base64url string', () => {
      const token = generateTempToken();
      expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
    });

    it('generates unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateTempToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe('hashKey', () => {
    it('returns 64 char hex string (SHA-256)', () => {
      const hash = hashKey('test-key');
      expect(hash.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });

    it('is deterministic', () => {
      const hash1 = hashKey('same-key');
      const hash2 = hashKey('same-key');
      expect(hash1).toBe(hash2);
    });

    it('different keys produce different hashes', () => {
      const hash1 = hashKey('key-1');
      const hash2 = hashKey('key-2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('validateKey', () => {
    it('returns true for matching key and hash', () => {
      const { key, hash } = generateKey();
      expect(validateKey(key, hash)).toBe(true);
    });

    it('returns false for wrong key', () => {
      const { hash } = generateKey();
      const { key: wrongKey } = generateKey();
      expect(validateKey(wrongKey, hash)).toBe(false);
    });

    it('returns false for wrong hash', () => {
      const { key } = generateKey();
      const wrongHash = hashKey('wrong-key');
      expect(validateKey(key, wrongHash)).toBe(false);
    });

    it('returns false for mismatched hash length', () => {
      const { key } = generateKey();
      expect(validateKey(key, 'short')).toBe(false);
    });

    it('is timing-safe (same execution time for valid/invalid)', () => {
      const { key, hash } = generateKey();
      const wrongKey = 'flx_' + 'x'.repeat(32);

      // Warm up
      for (let i = 0; i < 100; i++) {
        validateKey(key, hash);
        validateKey(wrongKey, hash);
      }

      // Measure valid key
      const validStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        validateKey(key, hash);
      }
      const validTime = performance.now() - validStart;

      // Measure invalid key (same length)
      const invalidStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        validateKey(wrongKey, hash);
      }
      const invalidTime = performance.now() - invalidStart;

      // Times should be within 50% of each other (timing-safe)
      const ratio = Math.max(validTime, invalidTime) / Math.min(validTime, invalidTime);
      expect(ratio).toBeLessThan(1.5);
    });
  });

  describe('encrypt/decrypt', () => {
    it('round-trips successfully', () => {
      const value = 'secret-api-key';
      const password = 'temp-token';
      const encrypted = encrypt(value, password);
      const decrypted = decrypt(encrypted, password);
      expect(decrypted).toBe(value);
    });

    it('encrypted value is different from original', () => {
      const value = 'secret-api-key';
      const encrypted = encrypt(value, 'password');
      expect(encrypted).not.toBe(value);
      expect(encrypted).not.toContain(value);
    });

    it('same value encrypts differently each time (random IV)', () => {
      const value = 'secret';
      const password = 'pass';
      const enc1 = encrypt(value, password);
      const enc2 = encrypt(value, password);
      expect(enc1).not.toBe(enc2);
    });

    it('wrong password returns null', () => {
      const encrypted = encrypt('secret', 'correct-password');
      const decrypted = decrypt(encrypted, 'wrong-password');
      expect(decrypted).toBeNull();
    });

    it('corrupted data returns null', () => {
      const decrypted = decrypt('not-valid-base64!!!', 'password');
      expect(decrypted).toBeNull();
    });

    it('handles empty string', () => {
      const encrypted = encrypt('', 'password');
      const decrypted = decrypt(encrypted, 'password');
      expect(decrypted).toBe('');
    });

    it('handles unicode', () => {
      const value = '🔐 秘密 🔑';
      const encrypted = encrypt(value, 'password');
      const decrypted = decrypt(encrypted, 'password');
      expect(decrypted).toBe(value);
    });
  });
});
