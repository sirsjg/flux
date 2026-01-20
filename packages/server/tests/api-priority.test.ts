import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Store } from '@flux/shared';
import {
  setStorageAdapter,
  initStore,
  createProject,
  createTask,
  updateTask,
  getReadyTasks,
} from '@flux/shared';
import { cleanupTempDatabases } from '../../shared/tests/test-cleanup.ts';

/**
 * Creates an isolated test adapter for server tests.
 * This is defined inline because server tests import from '@flux/shared' (compiled),
 * not from source, so we need to use the same module instance.
 */
function createTestAdapter(initial?: Partial<Store>) {
  const data: Store = {
    projects: [],
    epics: [],
    tasks: [],
    ...initial,
  };

  return {
    data,
    read: vi.fn(),
    write: vi.fn(),
    isTest: true, // Mark as test adapter for safety
  };
}

describe('HTTP API Priority Endpoints', () => {
  let testApp: Hono;
  let projectId: string;

  beforeEach(() => {
    // Set up fresh storage for each test
    const adapter = createTestAdapter();
    setStorageAdapter(adapter);
    initStore();

    // Create test project
    const project = createProject('Test Project', 'Test project for priority endpoints');
    projectId = project.id;

    // Build minimal test app with the API routes we need
    testApp = new Hono();

    // POST /api/projects/:projectId/tasks
    testApp.post('/api/projects/:projectId/tasks', async (c) => {
      const body = await c.req.json();
      const projectId = c.req.param('projectId');
      const task = createTask(projectId, body.title, body.epic_id, {
        priority: body.priority,
        depends_on: body.depends_on,
        acceptance_criteria: body.acceptance_criteria,
        guardrails: body.guardrails,
      });
      return c.json(task, 201);
    });

    // PATCH /api/tasks/:id
    testApp.patch('/api/tasks/:id', async (c) => {
      const body = await c.req.json();
      const task = updateTask(c.req.param('id'), body);
      if (!task) return c.json({ error: 'Task not found' }, 404);
      return c.json(task);
    });

    // GET /api/tasks/ready
    testApp.get('/api/tasks/ready', (c) => {
      const projectId = c.req.query('project_id');
      const tasks = getReadyTasks(projectId || undefined);
      return c.json(tasks);
    });
  });

  afterAll(() => {
    // Clean up any temp SQLite files that may have been created
    cleanupTempDatabases();
  });

  describe('POST /api/projects/:id/tasks with priority', () => {
    it('creates task with P0 priority', async () => {
      const res = await testApp.request(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Urgent task', priority: 0 }),
      });

      expect(res.status).toBe(201);
      const task = await res.json();
      expect(task.priority).toBe(0);
      expect(task.title).toBe('Urgent task');
    });

    it('creates task with P1 priority', async () => {
      const res = await testApp.request(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Normal task', priority: 1 }),
      });

      expect(res.status).toBe(201);
      const task = await res.json();
      expect(task.priority).toBe(1);
    });

    it('creates task with P2 priority', async () => {
      const res = await testApp.request(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Low priority task', priority: 2 }),
      });

      expect(res.status).toBe(201);
      const task = await res.json();
      expect(task.priority).toBe(2);
    });

    it('creates task without priority (defaults to undefined)', async () => {
      const res = await testApp.request(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'No priority task' }),
      });

      expect(res.status).toBe(201);
      const task = await res.json();
      expect(task.priority).toBeUndefined();
    });
  });

  describe('PATCH /api/tasks/:id priority update', () => {
    it('updates task priority from P1 to P0', async () => {
      const task = createTask(projectId, 'Task', undefined, { priority: 1 });

      const res = await testApp.request(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 0 }),
      });

      expect(res.status).toBe(200);
      const updated = await res.json();
      expect(updated.priority).toBe(0);
      expect(updated.id).toBe(task.id);
    });

    it('updates task priority from P2 to P1', async () => {
      const task = createTask(projectId, 'Task', undefined, { priority: 2 });

      const res = await testApp.request(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 1 }),
      });

      expect(res.status).toBe(200);
      const updated = await res.json();
      expect(updated.priority).toBe(1);
    });

    it('sets priority on task that had none', async () => {
      const task = createTask(projectId, 'Task');

      const res = await testApp.request(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 0 }),
      });

      expect(res.status).toBe(200);
      const updated = await res.json();
      expect(updated.priority).toBe(0);
    });

    it('can update other fields without removing priority', async () => {
      const task = createTask(projectId, 'Task', undefined, { priority: 0 });

      const res = await testApp.request(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated title' }),
      });

      expect(res.status).toBe(200);
      const updated = await res.json();
      expect(updated.title).toBe('Updated title');
      expect(updated.priority).toBe(0);
    });

    it('updates other fields while changing priority', async () => {
      const task = createTask(projectId, 'Task', undefined, { priority: 2 });

      const res = await testApp.request(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New title', priority: 0 }),
      });

      expect(res.status).toBe(200);
      const updated = await res.json();
      expect(updated.title).toBe('New title');
      expect(updated.priority).toBe(0);
    });

    it('returns 404 for non-existent task', async () => {
      const res = await testApp.request(`/api/tasks/nonexistent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 0 }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/tasks/ready returns sorted by priority', () => {
    it('returns tasks sorted by priority (P0, P1, P2, undefined)', async () => {
      const p2Task = createTask(projectId, 'P2 task', undefined, { priority: 2 });
      const p0Task = createTask(projectId, 'P0 task', undefined, { priority: 0 });
      const nullTask = createTask(projectId, 'No priority');
      const p1Task = createTask(projectId, 'P1 task', undefined, { priority: 1 });

      const res = await testApp.request('/api/tasks/ready');

      expect(res.status).toBe(200);
      const tasks = await res.json();
      expect(tasks).toHaveLength(4);
      expect(tasks[0].id).toBe(p0Task.id); // P0 first
      expect(tasks[1].id).toBe(p1Task.id); // P1 second
      // P2 and null both treated as priority 2
      const lastTwo = [tasks[2].id, tasks[3].id];
      expect(lastTwo).toContain(p2Task.id);
      expect(lastTwo).toContain(nullTask.id);
    });

    it('filters by project_id when provided', async () => {
      const project2 = createProject('Project 2');
      createTask(projectId, 'Task 1', undefined, { priority: 0 });
      createTask(project2.id, 'Task 2', undefined, { priority: 0 });

      const res = await testApp.request(`/api/tasks/ready?project_id=${projectId}`);

      expect(res.status).toBe(200);
      const tasks = await res.json();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Task 1');
    });

    it('excludes blocked tasks', async () => {
      const blocker = createTask(projectId, 'Blocker');
      const blocked = createTask(projectId, 'Blocked', undefined, {
        priority: 0,
        depends_on: [blocker.id]
      });
      const ready = createTask(projectId, 'Ready', undefined, { priority: 1 });

      const res = await testApp.request('/api/tasks/ready');

      expect(res.status).toBe(200);
      const tasks = await res.json();
      expect(tasks).toHaveLength(2); // blocker and ready, not blocked
      expect(tasks.find((t: any) => t.id === blocked.id)).toBeUndefined();
    });

    it('excludes done tasks', async () => {
      const done = createTask(projectId, 'Done task', undefined, { priority: 0 });
      updateTask(done.id, { status: 'done' });
      const ready = createTask(projectId, 'Ready task', undefined, { priority: 1 });

      const res = await testApp.request('/api/tasks/ready');

      expect(res.status).toBe(200);
      const tasks = await res.json();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(ready.id);
    });

    it('returns empty array when no ready tasks', async () => {
      const res = await testApp.request('/api/tasks/ready');

      expect(res.status).toBe(200);
      const tasks = await res.json();
      expect(tasks).toEqual([]);
    });
  });
});
