import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { setupTestEnv, teardownTestEnv, getLogs, getErrors } from './helpers.js';

vi.mock('../src/client.js', () => ({
  getProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getProjectStats: vi.fn(),
}));

import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats,
} from '../src/client.js';
import { projectCommand } from '../src/commands/project.js';

const mockGetProjects = getProjects as Mock;
const mockGetProject = getProject as Mock;
const mockCreateProject = createProject as Mock;
const mockUpdateProject = updateProject as Mock;
const mockDeleteProject = deleteProject as Mock;
const mockGetProjectStats = getProjectStats as Mock;

describe('project command', () => {
  beforeEach(() => {
    setupTestEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    teardownTestEnv();
  });

  describe('list', () => {
    it('lists projects with stats', async () => {
      mockGetProjects.mockResolvedValue([
        { id: 'proj-1', name: 'Project One' },
        { id: 'proj-2', name: 'Project Two' },
      ]);
      mockGetProjectStats.mockResolvedValue({ total: 5, done: 2 });

      await projectCommand('list', [], {}, false);

      expect(getLogs()).toContain('proj-1  Project One  (2/5 done)');
      expect(getLogs()).toContain('proj-2  Project Two  (2/5 done)');
    });

    it('shows message when no projects', async () => {
      mockGetProjects.mockResolvedValue([]);

      await projectCommand('list', [], {}, false);

      expect(getLogs()).toContain('No projects');
    });

    it('outputs JSON when --json flag', async () => {
      mockGetProjects.mockResolvedValue([{ id: 'proj-1', name: 'Test' }]);
      mockGetProjectStats.mockResolvedValue({ total: 3, done: 1 });

      await projectCommand('list', [], {}, true);

      const output = JSON.parse(getLogs()[0]);
      expect(output).toHaveLength(1);
      expect(output[0].id).toBe('proj-1');
      expect(output[0].stats).toEqual({ total: 3, done: 1 });
    });
  });

  describe('create', () => {
    it('creates a project', async () => {
      mockCreateProject.mockResolvedValue({ id: 'proj-new', name: 'New Project' });

      await projectCommand('create', ['New Project'], {}, false);

      expect(createProject).toHaveBeenCalledWith('New Project', undefined);
      expect(getLogs()).toContain('Created project: proj-new');
    });

    it('creates project with description', async () => {
      mockCreateProject.mockResolvedValue({ id: 'proj-1', name: 'Test', description: 'Desc' });

      await projectCommand('create', ['Test'], { desc: 'Desc' }, false);

      expect(createProject).toHaveBeenCalledWith('Test', 'Desc');
    });

    it('exits with error when no name provided', async () => {
      await expect(projectCommand('create', [], {}, false)).rejects.toThrow('process.exit(1)');
      expect(getErrors()).toContain('Usage: flux project create <name>');
    });
  });

  describe('update', () => {
    it('updates project name', async () => {
      mockUpdateProject.mockResolvedValue({ id: 'proj-1', name: 'Updated' });

      await projectCommand('update', ['proj-1'], { name: 'Updated' }, false);

      expect(updateProject).toHaveBeenCalledWith('proj-1', { name: 'Updated' });
      expect(getLogs()).toContain('Updated project: proj-1');
    });

    it('updates project description', async () => {
      mockUpdateProject.mockResolvedValue({ id: 'proj-1', name: 'Test', description: 'New desc' });

      await projectCommand('update', ['proj-1'], { desc: 'New desc' }, false);

      expect(updateProject).toHaveBeenCalledWith('proj-1', { description: 'New desc' });
    });

    it('exits with error when project not found', async () => {
      mockUpdateProject.mockResolvedValue(undefined);

      await expect(projectCommand('update', ['bad-id'], { name: 'Test' }, false)).rejects.toThrow('process.exit(1)');
      expect(getErrors()).toContain('Project not found: bad-id');
    });

    it('exits with error when no id provided', async () => {
      await expect(projectCommand('update', [], {}, false)).rejects.toThrow('process.exit(1)');
      expect(getErrors()).toContain('Usage: flux project update <id> [--name] [--desc]');
    });
  });

  describe('delete', () => {
    it('deletes a project', async () => {
      mockGetProject.mockResolvedValue({ id: 'proj-1', name: 'Test' });
      mockDeleteProject.mockResolvedValue(true);

      await projectCommand('delete', ['proj-1'], {}, false);

      expect(deleteProject).toHaveBeenCalledWith('proj-1');
      expect(getLogs()).toContain('Deleted project: proj-1');
    });

    it('exits with error when project not found', async () => {
      mockGetProject.mockResolvedValue(undefined);

      await expect(projectCommand('delete', ['bad-id'], {}, false)).rejects.toThrow('process.exit(1)');
      expect(getErrors()).toContain('Project not found: bad-id');
    });

    it('exits with error when no id provided', async () => {
      await expect(projectCommand('delete', [], {}, false)).rejects.toThrow('process.exit(1)');
      expect(getErrors()).toContain('Usage: flux project delete <id>');
    });

    it('outputs JSON when --json flag', async () => {
      mockGetProject.mockResolvedValue({ id: 'proj-1', name: 'Test' });
      mockDeleteProject.mockResolvedValue(true);

      await projectCommand('delete', ['proj-1'], {}, true);

      const output = JSON.parse(getLogs()[0]);
      expect(output).toEqual({ deleted: 'proj-1' });
    });
  });

  describe('invalid subcommand', () => {
    it('exits with usage error', async () => {
      await expect(projectCommand('invalid', [], {}, false)).rejects.toThrow('process.exit(1)');
      expect(getErrors()).toContain('Usage: flux project [list|create|update|delete|use]');
    });

    it('exits with usage error when no subcommand', async () => {
      await expect(projectCommand(undefined, [], {}, false)).rejects.toThrow('process.exit(1)');
    });
  });
});
