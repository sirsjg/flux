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

  let data: Store = { ...defaultData };

  return {
    get data() {
      return data;
    },
    read() {
      const row = selectStmt.get() as { data?: string } | null;
      if (row?.data) {
        try {
          data = JSON.parse(row.data) as Store;
        } catch {
          data = { ...defaultData };
        }
      } else {
        data = { ...defaultData };
        this.write();
      }
    },
    write() {
      const serialized = JSON.stringify(data);
      const row = selectStmt.get();
      if (row) {
        updateStmt.run(serialized);
      } else {
        insertStmt.run(serialized);
      }
    },
  };
}
