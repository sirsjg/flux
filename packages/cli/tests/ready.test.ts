import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { setupTestEnv, teardownTestEnv, getLogs } from './helpers.js';

vi.mock('../src/client.js', () => ({
  getReadyTasks: vi.fn(),
  PRIORITY_CONFIG: {
    0: { label: 'P0', ansi: '\x1b[31m' },
    1: { label: 'P1', ansi: '\x1b[33m' },
    2: { label: 'P2', ansi: '\x1b[32m' },
  },
}));

import { getReadyTasks } from '../src/client.js';
import { readyCommand } from '../src/commands/ready.js';

const mockGetReadyTasks = getReadyTasks as Mock;

describe('ready command', () => {
  beforeEach(() => {
    setupTestEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    teardownTestEnv();
  });

  it('lists ready tasks sorted by priority', async () => {
    mockGetReadyTasks.mockResolvedValue([
      { id: 'task-1', title: 'Urgent', status: 'todo', priority: 0 },
      { id: 'task-2', title: 'Normal', status: 'todo', priority: 2 },
    ]);

    await readyCommand([], {}, false);

    expect(mockGetReadyTasks).toHaveBeenCalledWith(undefined);
    expect(getLogs().some(l => l.includes('task-1') && l.includes('Urgent'))).toBe(true);
    expect(getLogs().some(l => l.includes('task-2') && l.includes('Normal'))).toBe(true);
  });

  it('filters by project when provided', async () => {
    mockGetReadyTasks.mockResolvedValue([]);

    await readyCommand(['proj-1'], {}, false);

    expect(mockGetReadyTasks).toHaveBeenCalledWith('proj-1');
  });

  it('filters by project via flag', async () => {
    mockGetReadyTasks.mockResolvedValue([]);

    await readyCommand([], { project: 'proj-1' }, false);

    expect(mockGetReadyTasks).toHaveBeenCalledWith('proj-1');
  });

  it('shows message when no ready tasks', async () => {
    mockGetReadyTasks.mockResolvedValue([]);

    await readyCommand([], {}, false);

    expect(getLogs()).toContain('No ready tasks');
  });

  it('shows latest comment preview', async () => {
    mockGetReadyTasks.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Test',
        status: 'todo',
        priority: 1,
        comments: [{ id: 'c-1', body: 'Latest comment here', author: 'user' }],
      },
    ]);

    await readyCommand([], {}, false);

    expect(getLogs().some(l => l.includes('Latest comment here'))).toBe(true);
  });

  it('truncates long comments', async () => {
    const longComment = 'A'.repeat(100);
    mockGetReadyTasks.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Test',
        status: 'todo',
        priority: 1,
        comments: [{ id: 'c-1', body: longComment, author: 'user' }],
      },
    ]);

    await readyCommand([], {}, false);

    expect(getLogs().some(l => l.includes('...'))).toBe(true);
  });

  it('outputs JSON when --json flag', async () => {
    mockGetReadyTasks.mockResolvedValue([
      { id: 'task-1', title: 'Test', status: 'todo', priority: 0 },
    ]);

    await readyCommand([], {}, true);

    const output = JSON.parse(getLogs()[0]);
    expect(output).toHaveLength(1);
    expect(output[0].id).toBe('task-1');
  });
});
