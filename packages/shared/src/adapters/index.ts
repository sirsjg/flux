import type { StorageAdapter } from '../store.js';
import { createJsonAdapter } from './json-adapter.js';
import { createSqliteAdapter } from './sqlite-adapter.js';

export { createJsonAdapter } from './json-adapter.js';
export { createSqliteAdapter } from './sqlite-adapter.js';

/**
 * Create a storage adapter based on file extension.
 * - .sqlite or .db → SQLite adapter
 * - .json or anything else → JSON adapter
 */
export function createAdapter(filePath: string): StorageAdapter {
  if (filePath.endsWith('.sqlite') || filePath.endsWith('.db')) {
    return createSqliteAdapter(filePath);
  }
  return createJsonAdapter(filePath);
}
