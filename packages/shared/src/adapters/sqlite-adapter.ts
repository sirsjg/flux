import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { Store } from '../types.js';
import type { StorageAdapter } from '../store.js';

const defaultData: Store = {
  projects: [],
  epics: [],
  tasks: [],
};

export function createSqliteAdapter(filePath: string): StorageAdapter {
  // Ensure directory exists
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(filePath, { create: true });

  // WAL mode for better concurrency with multiple readers
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('CREATE TABLE IF NOT EXISTS store (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)');

  const selectStmt = db.prepare('SELECT data FROM store WHERE id = 1');
  const insertStmt = db.prepare('INSERT INTO store (id, data) VALUES (1, ?)');
  const updateStmt = db.prepare('UPDATE store SET data = ? WHERE id = 1');

  let _data: Store = { ...defaultData };

  // Helper to read fresh data from DB
  const readFromDb = (): Store => {
    const row = selectStmt.get() as { data?: string } | null;
    if (row?.data) {
      try {
        return JSON.parse(row.data) as Store;
      } catch {
        return { ...defaultData };
      }
    }
    return { ...defaultData };
  };

  return {
    get data() {
      return _data;
    },
    read() {
      // Always refresh from DB - critical for concurrent access
      _data = readFromDb();
      if (!selectStmt.get()) {
        // Initialize DB if empty
        insertStmt.run(JSON.stringify(_data));
      }
    },
    write() {
      // Use transaction to ensure atomic read-modify-write
      db.transaction(() => {
        // Re-read current state inside transaction
        const current = readFromDb();
        
        // Merge changes: preserve any data added by other processes
        // This prevents lost updates by merging rather than overwriting
        const merged: Store = {
          projects: mergeById(current.projects, _data.projects),
          epics: mergeById(current.epics, _data.epics),
          tasks: mergeById(current.tasks, _data.tasks),
          blobs: mergeById(current.blobs || [], _data.blobs || []),
        };
        
        const serialized = JSON.stringify(merged);
        const row = selectStmt.get();
        if (row) {
          updateStmt.run(serialized);
        } else {
          insertStmt.run(serialized);
        }
        
        // Update in-memory state to match what we wrote
        _data = merged;
      })();
    },
  };
}

// Merge arrays by ID, preferring items from 'updated' but keeping items only in 'current'
function mergeById<T extends { id: string }>(current: T[], updated: T[]): T[] {
  const result = new Map<string, T>();
  
  // Start with current items
  for (const item of current) {
    result.set(item.id, item);
  }
  
  // Overlay with updated items (overwrites if same ID)
  for (const item of updated) {
    result.set(item.id, item);
  }
  
  return Array.from(result.values());
}
