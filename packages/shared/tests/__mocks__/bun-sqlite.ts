// Mock bun:sqlite for vitest (runs in Node.js, not Bun)
import { vi } from 'vitest';

class MockStatement {
  get = vi.fn(() => null);
  run = vi.fn();
}

export class Database {
  exec = vi.fn();
  prepare = vi.fn(() => new MockStatement());

  constructor(_path?: string, _options?: { create?: boolean }) {}
}
