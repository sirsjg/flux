import { createHash, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from 'crypto';
const KEY_PREFIX = 'flx_';
const KEY_LENGTH = 32;
/**
 * Generate a new API key
 * Returns the raw key (shown once), prefix for display, and hash for storage
 */
export function generateKey() {
    const randomPart = randomBytes(KEY_LENGTH).toString('base64url').slice(0, KEY_LENGTH);
    const key = `${KEY_PREFIX}${randomPart}`;
    const prefix = key.slice(0, 12);
    const hash = hashKey(key);
    return { key, prefix, hash };
}
/**
 * Generate a temp token for CLI auth flow
 */
export function generateTempToken() {
    return randomBytes(32).toString('base64url');
}
/**
 * Hash an API key using SHA-256
 */
export function hashKey(key) {
    return createHash('sha256').update(key).digest('hex');
}
/**
 * Validate a key against a stored hash using timing-safe comparison
 */
export function validateKey(key, storedHash) {
    const keyHash = hashKey(key);
    if (keyHash.length !== storedHash.length) {
        return false;
    }
    return timingSafeEqual(Buffer.from(keyHash), Buffer.from(storedHash));
}
/**
 * Encrypt a value using a password (for storing API keys temporarily)
 * Uses AES-256-GCM with password-derived key
 */
export function encrypt(value, password) {
    const key = createHash('sha256').update(password).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}
/**
 * Decrypt a value encrypted with encrypt()
 */
export function decrypt(encrypted, password) {
    try {
        const key = createHash('sha256').update(password).digest();
        const data = Buffer.from(encrypted, 'base64');
        const iv = data.subarray(0, 12);
        const authTag = data.subarray(12, 28);
        const content = data.subarray(28);
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        return decipher.update(content) + decipher.final('utf8');
    }
    catch {
        return null;
    }
}
