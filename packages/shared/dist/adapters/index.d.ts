import type { StorageAdapter } from '../store.js';
export { createJsonAdapter } from './json-adapter.js';
/**
 * Create a SQLite storage adapter.
 * Requires Bun runtime (uses bun:sqlite).
 */
export declare function createSqliteAdapter(filePath: string): StorageAdapter;
/**
 * Create a storage adapter based on file extension.
 * - .sqlite or .db → SQLite adapter (requires Bun)
 * - .json or anything else → JSON adapter
 */
export declare function createAdapter(filePath: string): StorageAdapter;
