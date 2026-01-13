import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { setupTestEnv, teardownTestEnv, getLogs, getErrors } from './helpers.js';

vi.mock('../src/client.js', () => ({
  getEpics: vi.fn(),
  getEpic: vi.fn(),
  createEpic: vi.fn(),
  updateEpic: vi.fn(),
  deleteEpic: vi.fn(),
}));

import { getEpics, getEpic, createEpic, updateEpic, deleteEpic } from '../src/client.js';
import { epicCommand } from '../src/commands/epic.js';

const mockGetEpics = getEpics as Mock;
const mockGetEpic = getEpic as Mock;
const mockCreateEpic = createEpic as Mock;
const mockUpdateEpic = updateEpic as Mock;
const mockDeleteEpic = deleteEpic as Mock;

describe('epic command', () => {
  beforeEach(() => {
    setupTestEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    teardownTestEnv();
  });

  describe('list', () => {
    it('lists epics for a project', async () => {
      mockGetEpics.mockResolvedValue([
        { id: 'epic-1', title: 'First Epic', status: 'todo' },
        { id: 'epic-2', title: 'Second Epic', status: 'in_progress' },
      ]);

      await epicCommand('list', ['proj-1'], {}, false);

      expect(mockGetEpics).toHaveBeenCalledWith('proj-1');
      expect(getLogs().some(l => l.includes('epic-1') && l.includes('First Epic'))).toBe(true);
      expect(getLogs().some(l => l.includes('epic-2') && l.includes('[in_progress]'))).toBe(true);
    });

    it('shows message when no epics', async () => {
      mockGetEpics.mockResolvedValue([]);

      await epicCommand('list', ['proj-1'], {}, false);

      expect(getLogs()).toContain('No epics');
    });

    it('exits with error when no project provided', async () => {
      await expect(epicCommand('list', [], {}, false)).rejects.toThrow('process.exit(1)');
      expect(getErrors()).toContain('Usage: flux epic list <project>');
    });

    it('outputs JSON when --json flag', async () => {
      mockGetEpics.mockResolvedValue([{ id: 'epic-1', title: 'Test', status: 'todo' }]);

      await epicCommand('list', ['proj-1'], {}, true);

      const output = JSON.parse(getLogs()[0]);
      expect(output).toHaveLength(1);
      expect(output[0].id).toBe('epic-1');
    });
  });

  describe('create', () => {
    it('creates an epic', async () => {
      mockCreateEpic.mockResolvedValue({ id: 'epic-new', title: 'New Epic', status: 'todo' });

      await epicCommand('create', ['proj-1', 'New Epic'], {}, false);

      expect(mockCreateEpic).toHaveBeenCalledWith('proj-1', 'New Epic', undefined);
      expect(getLogs()).toContain('Created epic: epic-new');
    });

    it('creates epic with notes', async () => {
      mockCreateEpic.mockResolvedValue({ id: 'epic-1', title: 'Test', status: 'todo', notes: 'Notes' });

      await epicCommand('create', ['proj-1', 'Test'], { note: 'Notes' }, false);

      expect(mockCreateEpic).toHaveBeenCalledWith('proj-1', 'Test', 'Notes');
    });

    it('exits with error when missing args', async () => {
      await expect(epicCommand('create', ['proj-1'], {}, false)).rejects.toThrow('process.exit(1)');
      expect(getErrors()).toContain('Usage: flux epic create <project> <title>');
    });

    it('outputs JSON when --json flag', async () => {
      mockCreateEpic.mockResolvedValue({ id: 'epic-1', title: 'Test', status: 'todo' });

      await epicCommand('create', ['proj-1', 'Test'], {}, true);

      const output = JSON.parse(getLogs()[0]);
      expect(output.id).toBe('epic-1');
    });
  });

  describe('update', () => {
    it('updates epic title', async () => {
      mockUpdateEpic.mockResolvedValue({ id: 'epic-1', title: 'Updated', status: 'todo' });

      await epicCommand('update', ['epic-1'], { title: 'Updated' }, false);

      expect(mockUpdateEpic).toHaveBeenCalledWith('epic-1', { title: 'Updated' });
      expect(getLogs()).toContain('Updated epic: epic-1');
    });

    it('updates epic status', async () => {
      mockUpdateEpic.mockResolvedValue({ id: 'epic-1', title: 'Test', status: 'done' });

      await epicCommand('update', ['epic-1'], { status: 'done' }, false);

      expect(mockUpdateEpic).toHaveBeenCalledWith('epic-1', { status: 'done' });
    });

    it('updates epic notes', async () => {
      mockUpdateEpic.mockResolvedValue({ id: 'epic-1', title: 'Test', status: 'todo', notes: 'New notes' });

      await epicCommand('update', ['epic-1'], { note: 'New notes' }, false);

      expect(mockUpdateEpic).toHaveBeenCalledWith('epic-1', { notes: 'New notes' });
    });

    it('exits with error when epic not found', async () => {
      mockUpdateEpic.mockResolvedValue(undefined);

      await expect(epicCommand('update', ['bad-id'], { title: 'Test' }, false)).rejects.toThrow('process.exit(1)');
      expect(getErrors()).toContain('Epic not found: bad-id');
    });

    it('exits with error when no id provided', async () => {
      await expect(epicCommand('update', [], {}, false)).rejects.toThrow('process.exit(1)');
      expect(getErrors()).toContain('Usage: flux epic update <id> [--title] [--status] [--note]');
    });
  });

  describe('delete', () => {
    it('deletes an epic', async () => {
      mockGetEpic.mockResolvedValue({ id: 'epic-1', title: 'Test', status: 'todo' });
      mockDeleteEpic.mockResolvedValue(true);

      await epicCommand('delete', ['epic-1'], {}, false);

      expect(mockDeleteEpic).toHaveBeenCalledWith('epic-1');
      expect(getLogs()).toContain('Deleted epic: epic-1');
    });

    it('exits with error when epic not found', async () => {
      mockGetEpic.mockResolvedValue(undefined);

      await expect(epicCommand('delete', ['bad-id'], {}, false)).rejects.toThrow('process.exit(1)');
      expect(getErrors()).toContain('Epic not found: bad-id');
    });

    it('exits with error when no id provided', async () => {
      await expect(epicCommand('delete', [], {}, false)).rejects.toThrow('process.exit(1)');
      expect(getErrors()).toContain('Usage: flux epic delete <id>');
    });

    it('outputs JSON when --json flag', async () => {
      mockGetEpic.mockResolvedValue({ id: 'epic-1', title: 'Test', status: 'todo' });
      mockDeleteEpic.mockResolvedValue(true);

      await epicCommand('delete', ['epic-1'], {}, true);

      const output = JSON.parse(getLogs()[0]);
      expect(output).toEqual({ deleted: 'epic-1' });
    });
  });

  describe('invalid subcommand', () => {
    it('exits with usage error', async () => {
      await expect(epicCommand('invalid', [], {}, false)).rejects.toThrow('process.exit(1)');
      expect(getErrors()).toContain('Usage: flux epic [list|create|update|delete]');
    });
  });
});
