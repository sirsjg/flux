import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { setupTestEnv, teardownTestEnv, getLogs, getErrors, MOCK_PRIORITY_CONFIG } from './helpers.js';

vi.mock('../src/client.js', () => ({
  getTask: vi.fn(),
  isTaskBlocked: vi.fn(),
  getEpic: vi.fn(),
  getProject: vi.fn(),
  PRIORITY_CONFIG: MOCK_PRIORITY_CONFIG,
}));

import { getTask, isTaskBlocked, getEpic, getProject } from '../src/client.js';
import { showCommand } from '../src/commands/show.js';

const mockGetTask = getTask as Mock;
const mockIsTaskBlocked = isTaskBlocked as Mock;
const mockGetEpic = getEpic as Mock;
const mockGetProject = getProject as Mock;

describe('show command', () => {
  beforeEach(() => {
    setupTestEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    teardownTestEnv();
  });

  it('shows task details', async () => {
    mockGetTask.mockResolvedValue({
      id: 'task-1',
      title: 'Test Task',
      status: 'in_progress',
      priority: 1,
      project_id: 'proj-1',
      depends_on: [],
      created_at: '2024-01-01T00:00:00Z',
    });
    mockIsTaskBlocked.mockResolvedValue(false);
    mockGetProject.mockResolvedValue({ id: 'proj-1', name: 'My Project' });

    await showCommand(['task-1'], {}, false);

    expect(getLogs().some(l => l.includes('Task: task-1'))).toBe(true);
    expect(getLogs().some(l => l.includes('Title: Test Task'))).toBe(true);
    expect(getLogs().some(l => l.includes('Status: in_progress'))).toBe(true);
    expect(getLogs().some(l => l.includes('Project: My Project'))).toBe(true);
  });

  it('shows blocked status', async () => {
    mockGetTask.mockResolvedValue({
      id: 'task-1',
      title: 'Blocked Task',
      status: 'todo',
      project_id: 'proj-1',
      depends_on: ['task-0'],
    });
    mockIsTaskBlocked.mockResolvedValue(true);
    mockGetProject.mockResolvedValue({ id: 'proj-1', name: 'Project' });

    await showCommand(['task-1'], {}, false);

    expect(getLogs().some(l => l.includes('[BLOCKED]'))).toBe(true);
    expect(getLogs().some(l => l.includes('Depends on: task-0'))).toBe(true);
  });

  it('shows epic info when task has epic', async () => {
    mockGetTask.mockResolvedValue({
      id: 'task-1',
      title: 'Test',
      status: 'todo',
      project_id: 'proj-1',
      epic_id: 'epic-1',
      depends_on: [],
    });
    mockIsTaskBlocked.mockResolvedValue(false);
    mockGetProject.mockResolvedValue({ id: 'proj-1', name: 'Project' });
    mockGetEpic.mockResolvedValue({ id: 'epic-1', title: 'Epic Title', status: 'todo' });

    await showCommand(['task-1'], {}, false);

    expect(getLogs().some(l => l.includes('Epic: Epic Title'))).toBe(true);
  });

  it('shows comments', async () => {
    mockGetTask.mockResolvedValue({
      id: 'task-1',
      title: 'Test',
      status: 'todo',
      project_id: 'proj-1',
      depends_on: [],
      comments: [
        { id: 'c-1', body: 'User comment', author: 'user', created_at: '2024-01-01T10:00:00Z' },
        { id: 'c-2', body: 'Agent comment', author: 'mcp', created_at: '2024-01-02T10:00:00Z' },
      ],
    });
    mockIsTaskBlocked.mockResolvedValue(false);
    mockGetProject.mockResolvedValue({ id: 'proj-1', name: 'Project' });

    await showCommand(['task-1'], {}, false);

    expect(getLogs().some(l => l.includes('Comments:'))).toBe(true);
    expect(getLogs().some(l => l.includes('[user]') && l.includes('User comment'))).toBe(true);
    expect(getLogs().some(l => l.includes('[agent]') && l.includes('Agent comment'))).toBe(true);
  });

  it('exits with error when no id provided', async () => {
    await expect(showCommand([], {}, false)).rejects.toThrow('process.exit(1)');
    expect(getErrors()).toContain('Usage: flux show <id> [--json]');
  });

  it('exits with error when task not found', async () => {
    mockGetTask.mockResolvedValue(undefined);

    await expect(showCommand(['bad-id'], {}, false)).rejects.toThrow('process.exit(1)');
    expect(getErrors()).toContain('Task not found: bad-id');
  });

  it('outputs JSON when --json flag', async () => {
    mockGetTask.mockResolvedValue({
      id: 'task-1',
      title: 'Test',
      status: 'todo',
      priority: 0,
      project_id: 'proj-1',
      depends_on: [],
    });
    mockIsTaskBlocked.mockResolvedValue(true);
    mockGetProject.mockResolvedValue({ id: 'proj-1', name: 'Project' });

    await showCommand(['task-1'], {}, true);

    const output = JSON.parse(getLogs()[0]);
    expect(output.id).toBe('task-1');
    expect(output.blocked).toBe(true);
    expect(output.project_name).toBe('Project');
  });
});
