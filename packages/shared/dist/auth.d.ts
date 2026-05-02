/**
 * Generate a new API key
 * Returns the raw key (shown once), prefix for display, and hash for storage
 */
export declare function generateKey(): {
    key: string;
    prefix: string;
    hash: string;
};
/**
 * Generate a temp token for CLI auth flow
 */
export declare function generateTempToken(): string;
/**
 * Hash an API key using SHA-256
 */
export declare function hashKey(key: string): string;
/**
 * Validate a key against a stored hash using timing-safe comparison
 */
export declare function validateKey(key: string, storedHash: string): boolean;
/**
 * Encrypt a value using a password (for storing API keys temporarily)
 * Uses AES-256-GCM with password-derived key
 */
export declare function encrypt(value: string, password: string): string;
/**
 * Decrypt a value encrypted with encrypt()
 */
export declare function decrypt(encrypted: string, password: string): string | null;
