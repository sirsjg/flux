import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import {
  setStorageAdapter,
  initStore,
  createApiKey,
  setAuthFunctions,
  type StoreWithWebhooks,
} from '@flux/shared';
import {
  generateKey,
  generateTempToken,
  validateKey,
  encrypt,
  decrypt,
} from '@flux/shared/auth';
import {
  authMiddleware,
  hasServerAccess,
  isAuthRequired,
  canWriteProject,
  canReadProject,
  requireServerAccess,
  type AuthContext,
} from '../src/middleware/auth.js';

function createAdapter(initial?: Partial<StoreWithWebhooks>) {
  const data: StoreWithWebhooks = {
    projects: [],
    epics: [],
    tasks: [],
    api_keys: [],
    cli_auth_requests: [],
    ...initial,
  };
  return { data, read: () => {}, write: () => {} };
}

describe('auth middleware', () => {
  const originalEnv = process.env.FLUX_API_KEY;

  beforeAll(() => {
    setAuthFunctions({ generateKey, generateTempToken, validateKey, encrypt, decrypt });
  });

  beforeEach(() => {
    delete process.env.FLUX_API_KEY;
    setStorageAdapter(createAdapter());
    initStore();
  });

  afterAll(() => {
    if (originalEnv) {
      process.env.FLUX_API_KEY = originalEnv;
    } else {
      delete process.env.FLUX_API_KEY;
    }
  });

  describe('dev mode (no auth)', () => {
    it('allows all requests when no keys configured', async () => {
      const app = new Hono<{ Variables: { auth: AuthContext } }>();
      app.use('*', authMiddleware);
      app.post('/test', (c) => c.json({ auth: c.get('auth') }));

      const res = await app.request('/test', { method: 'POST' });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.auth.keyType).toBe('anonymous');
    });
  });

  describe('with FLUX_API_KEY env', () => {
    beforeEach(() => {
      process.env.FLUX_API_KEY = 'test-env-key';
    });

    it('rejects POST without token', async () => {
      const app = new Hono<{ Variables: { auth: AuthContext } }>();
      app.use('*', authMiddleware);
      app.post('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('allows GET without token (anonymous)', async () => {
      const app = new Hono<{ Variables: { auth: AuthContext } }>();
      app.use('*', authMiddleware);
      app.get('/test', (c) => c.json({ auth: c.get('auth') }));

      const res = await app.request('/test');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.auth.keyType).toBe('anonymous');
    });

    it('accepts valid env key', async () => {
      const app = new Hono<{ Variables: { auth: AuthContext } }>();
      app.use('*', authMiddleware);
      app.post('/test', (c) => c.json({ auth: c.get('auth') }));

      const res = await app.request('/test', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-env-key' },
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.auth.keyType).toBe('env');
    });

    it('rejects invalid key', async () => {
      const app = new Hono<{ Variables: { auth: AuthContext } }>();
      app.use('*', authMiddleware);
      app.post('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        method: 'POST',
        headers: { Authorization: 'Bearer wrong-key' },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('with stored API keys', () => {
    let serverKey: string;
    let projectKey: string;

    beforeEach(() => {
      const server = createApiKey('Server Key', { type: 'server' });
      serverKey = server.rawKey;

      const project = createApiKey('Project Key', {
        type: 'project',
        project_ids: ['proj-1'],
      });
      projectKey = project.rawKey;
    });

    it('accepts server-scoped key', async () => {
      const app = new Hono<{ Variables: { auth: AuthContext } }>();
      app.use('*', authMiddleware);
      app.post('/test', (c) => c.json({ auth: c.get('auth') }));

      const res = await app.request('/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${serverKey}` },
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.auth.keyType).toBe('server');
    });

    it('accepts project-scoped key with project IDs', async () => {
      const app = new Hono<{ Variables: { auth: AuthContext } }>();
      app.use('*', authMiddleware);
      app.post('/test', (c) => c.json({ auth: c.get('auth') }));

      const res = await app.request('/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.auth.keyType).toBe('project');
      expect(body.auth.projectIds).toEqual(['proj-1']);
    });
  });

  describe('requireServerAccess middleware', () => {
    it('allows request in dev mode', async () => {
      const app = new Hono<{ Variables: { auth: AuthContext } }>();
      app.use('*', authMiddleware);
      app.post('/admin', requireServerAccess, (c) => c.json({ ok: true }));

      const res = await app.request('/admin', { method: 'POST' });
      expect(res.status).toBe(200);
    });

    it('blocks anonymous when auth required', async () => {
      process.env.FLUX_API_KEY = 'test-key';

      const app = new Hono<{ Variables: { auth: AuthContext } }>();
      app.use('*', authMiddleware);
      app.get('/admin', requireServerAccess, (c) => c.json({ ok: true }));

      const res = await app.request('/admin');
      expect(res.status).toBe(401);
    });

    it('allows env key', async () => {
      process.env.FLUX_API_KEY = 'test-key';

      const app = new Hono<{ Variables: { auth: AuthContext } }>();
      app.use('*', authMiddleware);
      app.post('/admin', requireServerAccess, (c) => c.json({ ok: true }));

      const res = await app.request('/admin', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key' },
      });

      expect(res.status).toBe(200);
    });

    it('blocks project-scoped key', async () => {
      const { rawKey } = createApiKey('Project Key', {
        type: 'project',
        project_ids: ['proj-1'],
      });

      const app = new Hono<{ Variables: { auth: AuthContext } }>();
      app.use('*', authMiddleware);
      app.post('/admin', requireServerAccess, (c) => c.json({ ok: true }));

      const res = await app.request('/admin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rawKey}` },
      });

      expect(res.status).toBe(401);
    });

    it('allows server-scoped key', async () => {
      const { rawKey } = createApiKey('Server Key', { type: 'server' });

      const app = new Hono<{ Variables: { auth: AuthContext } }>();
      app.use('*', authMiddleware);
      app.post('/admin', requireServerAccess, (c) => c.json({ ok: true }));

      const res = await app.request('/admin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rawKey}` },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('helper functions', () => {
    describe('hasServerAccess', () => {
      it('returns true for env key', () => {
        process.env.FLUX_API_KEY = 'test';
        expect(hasServerAccess({ keyType: 'env' })).toBe(true);
      });

      it('returns true for server key', () => {
        process.env.FLUX_API_KEY = 'test';
        expect(hasServerAccess({ keyType: 'server' })).toBe(true);
      });

      it('returns false for project key when auth required', () => {
        process.env.FLUX_API_KEY = 'test';
        expect(hasServerAccess({ keyType: 'project', projectIds: ['p1'] })).toBe(false);
      });

      it('returns true for anonymous in dev mode', () => {
        expect(hasServerAccess({ keyType: 'anonymous' })).toBe(true);
      });

      it('returns false for anonymous when auth required', () => {
        process.env.FLUX_API_KEY = 'test';
        expect(hasServerAccess({ keyType: 'anonymous' })).toBe(false);
      });
    });

    describe('canWriteProject', () => {
      it('returns true for env key', () => {
        expect(canWriteProject({ keyType: 'env' }, 'any-project')).toBe(true);
      });

      it('returns true for server key', () => {
        expect(canWriteProject({ keyType: 'server' }, 'any-project')).toBe(true);
      });

      it('returns true for project key with matching project', () => {
        const auth: AuthContext = {
          keyType: 'project',
          projectIds: ['proj-1', 'proj-2'],
        };
        expect(canWriteProject(auth, 'proj-1')).toBe(true);
      });

      it('returns false for project key without matching project', () => {
        const auth: AuthContext = {
          keyType: 'project',
          projectIds: ['proj-1'],
        };
        expect(canWriteProject(auth, 'proj-2')).toBe(false);
      });

      it('returns false for anonymous', () => {
        expect(canWriteProject({ keyType: 'anonymous' }, 'any')).toBe(false);
      });
    });

    describe('isAuthRequired', () => {
      it('returns false when no auth configured', () => {
        expect(isAuthRequired()).toBe(false);
      });

      it('returns true when env key set', () => {
        process.env.FLUX_API_KEY = 'test';
        expect(isAuthRequired()).toBe(true);
      });

      it('returns true when stored keys exist', () => {
        createApiKey('Test', { type: 'server' });
        expect(isAuthRequired()).toBe(true);
      });
    });
  });

  describe('project-scoped key cross-project restrictions', () => {
    let projectKey: string;
    let serverKey: string;

    beforeEach(() => {
      const project = createApiKey('Project Key', {
        type: 'project',
        project_ids: ['proj-1'],
      });
      projectKey = project.rawKey;

      const server = createApiKey('Server Key', { type: 'server' });
      serverKey = server.rawKey;
    });

    function createTestApp() {
      const app = new Hono<{ Variables: { auth: AuthContext } }>();
      app.use('*', authMiddleware);

      // Simulate routes with canWriteProject checks
      app.post('/api/projects/:projectId/epics', (c) => {
        const auth = c.get('auth');
        const projectId = c.req.param('projectId');
        if (!canWriteProject(auth, projectId)) {
          return c.json({ error: 'Project not found' }, 404);
        }
        return c.json({ created: true, projectId });
      });

      app.post('/api/projects/:projectId/tasks', (c) => {
        const auth = c.get('auth');
        const projectId = c.req.param('projectId');
        if (!canWriteProject(auth, projectId)) {
          return c.json({ error: 'Project not found' }, 404);
        }
        return c.json({ created: true, projectId });
      });

      app.post('/api/projects/:projectId/cleanup', (c) => {
        const auth = c.get('auth');
        const projectId = c.req.param('projectId');
        if (!canWriteProject(auth, projectId)) {
          return c.json({ error: 'Project not found' }, 404);
        }
        return c.json({ cleaned: true, projectId });
      });

      return app;
    }

    it('allows project key to create epic in own project', async () => {
      const app = createTestApp();
      const res = await app.request('/api/projects/proj-1/epics', {
        method: 'POST',
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.created).toBe(true);
    });

    it('blocks project key from creating epic in other project', async () => {
      const app = createTestApp();
      const res = await app.request('/api/projects/proj-2/epics', {
        method: 'POST',
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(404);
    });

    it('allows project key to create task in own project', async () => {
      const app = createTestApp();
      const res = await app.request('/api/projects/proj-1/tasks', {
        method: 'POST',
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(200);
    });

    it('blocks project key from creating task in other project', async () => {
      const app = createTestApp();
      const res = await app.request('/api/projects/proj-2/tasks', {
        method: 'POST',
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(404);
    });

    it('allows project key to cleanup own project', async () => {
      const app = createTestApp();
      const res = await app.request('/api/projects/proj-1/cleanup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(200);
    });

    it('blocks project key from cleaning up other project', async () => {
      const app = createTestApp();
      const res = await app.request('/api/projects/proj-2/cleanup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(404);
    });

    it('allows server key to access any project', async () => {
      const app = createTestApp();

      const res1 = await app.request('/api/projects/proj-1/epics', {
        method: 'POST',
        headers: { Authorization: `Bearer ${serverKey}` },
      });
      expect(res1.status).toBe(200);

      const res2 = await app.request('/api/projects/proj-2/tasks', {
        method: 'POST',
        headers: { Authorization: `Bearer ${serverKey}` },
      });
      expect(res2.status).toBe(200);

      const res3 = await app.request('/api/projects/any-project/cleanup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${serverKey}` },
      });
      expect(res3.status).toBe(200);
    });
  });

  describe('project-scoped key read restrictions', () => {
    let projectKey: string;
    let serverKey: string;

    // Mock data store for entities
    const epics = [
      { id: 'epic-1', project_id: 'proj-1', title: 'Epic 1' },
      { id: 'epic-2', project_id: 'proj-2', title: 'Epic 2' },
    ];
    const tasks = [
      { id: 'task-1', project_id: 'proj-1', title: 'Task 1' },
      { id: 'task-2', project_id: 'proj-2', title: 'Task 2' },
      { id: 'task-3', project_id: 'proj-1', title: 'Task 3' },
    ];

    beforeEach(() => {
      const project = createApiKey('Project Key', {
        type: 'project',
        project_ids: ['proj-1'],
      });
      projectKey = project.rawKey;

      const server = createApiKey('Server Key', { type: 'server' });
      serverKey = server.rawKey;
    });

    function createReadTestApp() {
      const app = new Hono<{ Variables: { auth: AuthContext } }>();
      app.use('*', authMiddleware);

      // Nested routes for listing by project
      app.get('/api/projects/:projectId/epics', (c) => {
        const auth = c.get('auth');
        const projectId = c.req.param('projectId');
        if (!canReadProject(auth, projectId)) {
          return c.json({ error: 'Project not found' }, 404);
        }
        return c.json(epics.filter(e => e.project_id === projectId));
      });

      app.get('/api/projects/:projectId/tasks', (c) => {
        const auth = c.get('auth');
        const projectId = c.req.param('projectId');
        if (!canReadProject(auth, projectId)) {
          return c.json({ error: 'Project not found' }, 404);
        }
        return c.json(tasks.filter(t => t.project_id === projectId));
      });

      app.get('/api/epics/:id', (c) => {
        const auth = c.get('auth');
        const epic = epics.find(e => e.id === c.req.param('id'));
        if (!epic || !canReadProject(auth, epic.project_id)) {
          return c.json({ error: 'Epic not found' }, 404);
        }
        return c.json(epic);
      });

      // Must be before /api/tasks/:id to avoid "ready" matching as :id
      app.get('/api/tasks/ready', (c) => {
        const auth = c.get('auth');
        const filtered = tasks.filter(t => canReadProject(auth, t.project_id));
        return c.json(filtered);
      });

      app.get('/api/tasks/:id', (c) => {
        const auth = c.get('auth');
        const task = tasks.find(t => t.id === c.req.param('id'));
        if (!task || !canReadProject(auth, task.project_id)) {
          return c.json({ error: 'Task not found' }, 404);
        }
        return c.json(task);
      });

      return app;
    }

    it('allows project key to read epic in own project', async () => {
      const app = createReadTestApp();
      const res = await app.request('/api/epics/epic-1', {
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe('epic-1');
    });

    it('blocks project key from reading epic in other project', async () => {
      const app = createReadTestApp();
      const res = await app.request('/api/epics/epic-2', {
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(404);
    });

    it('allows project key to read task in own project', async () => {
      const app = createReadTestApp();
      const res = await app.request('/api/tasks/task-1', {
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe('task-1');
    });

    it('blocks project key from reading task in other project', async () => {
      const app = createReadTestApp();
      const res = await app.request('/api/tasks/task-2', {
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(404);
    });

    it('filters ready tasks by project access', async () => {
      const app = createReadTestApp();
      const res = await app.request('/api/tasks/ready', {
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.length).toBe(2); // Only proj-1 tasks
      expect(body.every((t: any) => t.project_id === 'proj-1')).toBe(true);
    });

    it('allows server key to read all tasks', async () => {
      const app = createReadTestApp();
      const res = await app.request('/api/tasks/ready', {
        headers: { Authorization: `Bearer ${serverKey}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.length).toBe(3); // All tasks
    });

    it('allows project key to list epics in own project', async () => {
      const app = createReadTestApp();
      const res = await app.request('/api/projects/proj-1/epics', {
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.length).toBe(1);
      expect(body[0].id).toBe('epic-1');
    });

    it('blocks project key from listing epics in other project', async () => {
      const app = createReadTestApp();
      const res = await app.request('/api/projects/proj-2/epics', {
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(404);
    });

    it('allows project key to list tasks in own project', async () => {
      const app = createReadTestApp();
      const res = await app.request('/api/projects/proj-1/tasks', {
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.length).toBe(2);
    });

    it('blocks project key from listing tasks in other project', async () => {
      const app = createReadTestApp();
      const res = await app.request('/api/projects/proj-2/tasks', {
        headers: { Authorization: `Bearer ${projectKey}` },
      });
      expect(res.status).toBe(404);
    });
  });
});
