import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  setStorageAdapter,
  initStore,
  createApiKey,
  createProject,
  createEpic,
  createTask,
  getTask,
  getTasks,
  setAuthFunctions,
  type StoreWithWebhooks,
  type KeyScope,
} from '@flux/shared';
import {
  generateKey,
  generateTempToken,
  validateKey,
  encrypt,
  decrypt,
} from '@flux/shared/auth';

// The server module builds the Hono app at import time. Import it lazily so
// the storage adapter installed in beforeEach is the one the app reads from.
let app: import('hono').Hono;

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

/** Issue a request against the app with an optional bearer token. */
function req(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<Response> {
  return app.request(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/**
 * The server rejects anonymous writes once any key exists, so every
 * write-path test presents a token. `beforeEach` wipes the store, so each
 * test creates the key it needs.
 */
function serverKey(): string {
  return createApiKey('test-key', { type: 'server' }).rawKey;
}

describe('PATCH /api/tasks/:id — move task between projects', () => {
  const originalEnv = process.env.FLUX_API_KEY;
  const originalAllowAnonymous = process.env.FLUX_ALLOW_ANONYMOUS;

  beforeAll(async () => {
    setAuthFunctions({ generateKey, generateTempToken, validateKey, encrypt, decrypt });
    const mod = await import('../src/index.js');
    app = mod.app as unknown as import('hono').Hono;
  });

  beforeEach(() => {
    delete process.env.FLUX_API_KEY;
    delete process.env.FLUX_ALLOW_ANONYMOUS;
    setStorageAdapter(createAdapter());
    initStore();
  });

  afterAll(() => {
    if (originalEnv) process.env.FLUX_API_KEY = originalEnv;
    else delete process.env.FLUX_API_KEY;
    if (originalAllowAnonymous) process.env.FLUX_ALLOW_ANONYMOUS = originalAllowAnonymous;
    else delete process.env.FLUX_ALLOW_ANONYMOUS;
  });

  /** Create a project-scoped API key for the given projects. */
  function makeKey(scope: KeyScope): string {
    return createApiKey('test-key', scope).rawKey;
  }

  describe('happy path', () => {
    it('moves the task to the target project', async () => {
      const a = createProject('Project A');
      const b = createProject('Project B');
      const task = createTask(a.id, 'Move me');

      const res = await req('PATCH', `/api/tasks/${task.id}`, { project_id: b.id }, serverKey());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.project_id).toBe(b.id);
      expect(getTask(task.id)?.project_id).toBe(b.id);
    });

    it('preserves title, status, priority, description and acceptance criteria', async () => {
      const a = createProject('Project A');
      const b = createProject('Project B');
      const task = createTask(a.id, 'Keep my data', undefined, {
        priority: 0,
        description: 'Context that matters',
        acceptance_criteria: ['Criterion 1', 'Criterion 2'],
      });

      const res = await req('PATCH', `/api/tasks/${task.id}`, { project_id: b.id }, serverKey());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.title).toBe('Keep my data');
      expect(body.status).toBe('planning');
      expect(body.priority).toBe(0);
      expect(body.description).toBe('Context that matters');
      expect(body.acceptance_criteria).toEqual(['Criterion 1', 'Criterion 2']);
    });

    it('removes the task from the source project and adds it to the target', async () => {
      const a = createProject('Project A');
      const b = createProject('Project B');
      const task = createTask(a.id, 'Move me');
      createTask(a.id, 'Stays behind');

      const res = await req('PATCH', `/api/tasks/${task.id}`, { project_id: b.id }, serverKey());

      expect(res.status).toBe(200);
      expect(getTasks(a.id).map(t => t.id)).not.toContain(task.id);
      expect(getTasks(b.id).map(t => t.id)).toContain(task.id);
    });

    it('keeps dependencies intact across the move', async () => {
      const a = createProject('Project A');
      const b = createProject('Project B');
      const blocker = createTask(a.id, 'Blocker');
      const task = createTask(a.id, 'Dependent', undefined, { depends_on: [blocker.id] });

      const res = await req('PATCH', `/api/tasks/${task.id}`, { project_id: b.id }, serverKey());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.depends_on).toEqual([blocker.id]);
    });

    it('is a no-op when project_id is unchanged', async () => {
      const a = createProject('Project A');
      const task = createTask(a.id, 'Stay put');

      const res = await req('PATCH', `/api/tasks/${task.id}`, { project_id: a.id }, serverKey());

      expect(res.status).toBe(200);
      expect(getTask(task.id)?.project_id).toBe(a.id);
    });

    it('treats a null project_id as "keep current project"', async () => {
      const a = createProject('Project A');
      const task = createTask(a.id, 'Stay put');

      const res = await req('PATCH', `/api/tasks/${task.id}`, { project_id: null }, serverKey());

      expect(res.status).toBe(200);
      expect(getTask(task.id)?.project_id).toBe(a.id);
    });
  });

  describe('authorization', () => {
    it('returns 403 when the caller cannot write to the target project', async () => {
      const a = createProject('Project A');
      const b = createProject('Project B');
      const task = createTask(a.id, 'Move me');
      // Key scoped to A only — it may not write into B.
      const key = makeKey({ type: 'project', project_ids: [a.id] });

      const res = await req(
        'PATCH',
        `/api/tasks/${task.id}`,
        { project_id: b.id },
        key
      );

      expect(res.status).toBe(403);
      // The task must not have moved.
      expect(getTask(task.id)?.project_id).toBe(a.id);
    });

    it('allows a project-scoped key that has access to both projects', async () => {
      const a = createProject('Project A');
      const b = createProject('Project B');
      const task = createTask(a.id, 'Move me');
      const key = makeKey({ type: 'project', project_ids: [a.id, b.id] });

      const res = await req('PATCH', `/api/tasks/${task.id}`, { project_id: b.id }, key);

      expect(res.status).toBe(200);
      expect(getTask(task.id)?.project_id).toBe(b.id);
    });

    it('allows a server-scoped key to move between any two projects', async () => {
      const a = createProject('Project A');
      const b = createProject('Project B');
      const task = createTask(a.id, 'Move me');
      const key = makeKey({ type: 'server' });

      const res = await req('PATCH', `/api/tasks/${task.id}`, { project_id: b.id }, key);

      expect(res.status).toBe(200);
      expect(getTask(task.id)?.project_id).toBe(b.id);
    });

    it('returns 404 when the caller has no access to the source project', async () => {
      const a = createProject('Project A');
      const b = createProject('Project B');
      const task = createTask(a.id, 'Move me');
      const key = makeKey({ type: 'project', project_ids: [b.id] });

      const res = await req('PATCH', `/api/tasks/${task.id}`, { project_id: b.id }, key);

      expect(res.status).toBe(404);
      expect(getTask(task.id)?.project_id).toBe(a.id);
    });

    it('returns 401 with no token when keys are configured', async () => {
      const a = createProject('Project A');
      const b = createProject('Project B');
      const task = createTask(a.id, 'Move me');
      makeKey({ type: 'server' });

      const res = await req('PATCH', `/api/tasks/${task.id}`, { project_id: b.id });

      expect(res.status).toBe(401);
      expect(getTask(task.id)?.project_id).toBe(a.id);
    });
  });

  describe('target project validation', () => {
    it('returns 404 when the target project does not exist', async () => {
      const a = createProject('Project A');
      const task = createTask(a.id, 'Move me');

      const res = await req(
        'PATCH',
        `/api/tasks/${task.id}`,
        { project_id: 'no-such-project' },
        serverKey()
      );

      expect(res.status).toBe(404);
      expect(getTask(task.id)?.project_id).toBe(a.id);
    });
  });

  describe('epic integrity (locked decision: reject with 409)', () => {
    it('returns 409 when the task belongs to an epic in another project', async () => {
      const a = createProject('Project A');
      const b = createProject('Project B');
      const epic = createEpic(a.id, 'Epic in A');
      const task = createTask(a.id, 'Task under epic', epic.id);

      const res = await req('PATCH', `/api/tasks/${task.id}`, { project_id: b.id }, serverKey());

      expect(res.status).toBe(409);
      // The task must not have moved.
      expect(getTask(task.id)?.project_id).toBe(a.id);
    });

    it('allows the move when the epic belongs to the target project', async () => {
      const a = createProject('Project A');
      const b = createProject('Project B');
      const epic = createEpic(b.id, 'Epic in B');
      const task = createTask(a.id, 'Task under epic', epic.id);

      const res = await req('PATCH', `/api/tasks/${task.id}`, { project_id: b.id }, serverKey());

      expect(res.status).toBe(200);
      expect(getTask(task.id)?.project_id).toBe(b.id);
    });

    it('allows the move when the task has no epic', async () => {
      const a = createProject('Project A');
      const b = createProject('Project B');
      const task = createTask(a.id, 'No epic');

      const res = await req('PATCH', `/api/tasks/${task.id}`, { project_id: b.id }, serverKey());

      expect(res.status).toBe(200);
      expect(getTask(task.id)?.project_id).toBe(b.id);
    });

    // The client sends field changes and the move in one PATCH (a save is
    // atomic). The guard must evaluate the epic the task will have AFTER the
    // update, not the one it had before — a combined unassign + move must
    // succeed rather than 409 on the epic about to be removed.
    it('succeeds when epic_id is cleared in the same PATCH as the move', async () => {
      const a = createProject('Project A');
      const b = createProject('Project B');
      const epic = createEpic(a.id, 'Epic in A');
      const task = createTask(a.id, 'Task under epic', epic.id);

      const res = await req(
        'PATCH',
        `/api/tasks/${task.id}`,
        { epic_id: null, project_id: b.id },
        serverKey()
      );

      expect(res.status).toBe(200);
      expect(getTask(task.id)?.project_id).toBe(b.id);
      expect(getTask(task.id)?.epic_id).toBeUndefined();
    });

    it('still returns 409 when the PATCH assigns an epic from a third project while moving', async () => {
      const a = createProject('Project A');
      const b = createProject('Project B');
      const c = createProject('Project C');
      const epicInC = createEpic(c.id, 'Epic in C');
      const task = createTask(a.id, 'Task without epic');

      // The epic is chosen for the task in the same request as the move.
      // The post-update epic (C's) differs from the target (B), so the move
      // is still rejected even though the task had no epic before the update.
      const res = await req(
        'PATCH',
        `/api/tasks/${task.id}`,
        { epic_id: epicInC.id, project_id: b.id },
        serverKey()
      );

      expect(res.status).toBe(409);
      expect(getTask(task.id)?.project_id).toBe(a.id);
    });

    it('treats an explicit null epic_id as a clear and stores it as absent', async () => {
      const a = createProject('Project A');
      const epic = createEpic(a.id, 'Epic in A');
      const task = createTask(a.id, 'Task under epic', epic.id);

      const res = await req('PATCH', `/api/tasks/${task.id}`, { epic_id: null }, serverKey());

      expect(res.status).toBe(200);
      const stored = getTask(task.id)!;
      expect(stored.epic_id).toBeUndefined();
      // A persisted null would survive the JSON round trip and break strict
      // equality checks in clients that compare against undefined.
      const roundTripped = JSON.parse(JSON.stringify(stored));
      expect('epic_id' in roundTripped).toBe(false);
    });

    it('does not reject a same-project epic reassignment on an unchanged move', async () => {
      const a = createProject('Project A');
      const epic1 = createEpic(a.id, 'First epic');
      const epic2 = createEpic(a.id, 'Second epic');
      const task = createTask(a.id, 'Task', epic1.id);

      const res = await req(
        'PATCH',
        `/api/tasks/${task.id}`,
        { epic_id: epic2.id, project_id: a.id },
        serverKey()
      );

      expect(res.status).toBe(200);
      expect(getTask(task.id)?.epic_id).toBe(epic2.id);
    });
  });
});
