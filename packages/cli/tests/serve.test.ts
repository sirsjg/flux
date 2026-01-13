import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupTestEnv, teardownTestEnv, getLogs, getErrors } from './helpers.js';

// Mock the server and storage
vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}));

vi.mock('@flux/shared', () => ({
  setStorageAdapter: vi.fn(),
  initStore: vi.fn(),
  getProjects: vi.fn(() => []),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getProjectStats: vi.fn(() => ({ total: 0, done: 0 })),
  getEpics: vi.fn(() => []),
  getEpic: vi.fn(),
  createEpic: vi.fn(),
  updateEpic: vi.fn(),
  deleteEpic: vi.fn(),
  getTasks: vi.fn(() => []),
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  addTaskComment: vi.fn(),
  deleteTaskComment: vi.fn(),
  isTaskBlocked: vi.fn(() => false),
  cleanupProject: vi.fn(),
  getStore: vi.fn(() => ({ projects: [], epics: [], tasks: [] })),
  replaceStore: vi.fn(),
  mergeStore: vi.fn(),
}));

vi.mock('@flux/shared/adapters', () => ({
  createAdapter: vi.fn(() => ({})),
}));

let mockConfigReturn = {};
vi.mock('../src/config.js', () => ({
  findFluxDir: vi.fn(() => '/tmp/.flux'),
  readConfig: vi.fn(() => mockConfigReturn),
}));

// Mock net module so isPortAvailable always returns true
vi.mock('net', () => ({
  createServer: vi.fn(() => ({
    once: vi.fn((event: string, cb: () => void) => {
      if (event === 'listening') setTimeout(cb, 0);
    }),
    listen: vi.fn(),
    close: vi.fn(),
  })),
}));

import { serve } from '@hono/node-server';
import { serveCommand } from '../src/commands/serve.js';
import { findFluxDir, readConfig } from '../src/config.js';

describe('serve command', () => {
  beforeEach(() => {
    setupTestEnv();
    vi.clearAllMocks();
    mockConfigReturn = {};
  });

  afterEach(() => {
    teardownTestEnv();
  });

  it('starts server on default port 3589', async () => {
    await serveCommand([], {});

    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({ port: 3589 })
    );
    expect(getLogs()).toContainEqual(expect.stringContaining('Starting server on http://localhost:3589'));
  });

  it('uses custom port from -p flag', async () => {
    await serveCommand([], { p: '8080' });

    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({ port: 8080 })
    );
  });

  it('uses custom port from --port flag', async () => {
    await serveCommand([], { port: '9000' });

    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({ port: 9000 })
    );
  });

  it('reads config from .flux directory', async () => {
    await serveCommand([], {});

    expect(findFluxDir).toHaveBeenCalled();
    expect(readConfig).toHaveBeenCalledWith('/tmp/.flux');
  });

  it('uses dataFile from config when available', async () => {
    mockConfigReturn = { dataFile: 'custom.sqlite' };

    await serveCommand([], {});

    expect(getLogs()).toContainEqual(expect.stringContaining('custom.sqlite'));
  });

  it('--data flag overrides config', async () => {
    mockConfigReturn = { dataFile: 'config.json' };

    await serveCommand([], { data: '/custom/path.json' });

    expect(getLogs()).toContainEqual(expect.stringContaining('/custom/path.json'));
  });
});
