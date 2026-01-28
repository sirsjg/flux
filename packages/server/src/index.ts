import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, watchFile, statSync, readFileSync } from 'fs';
import {
  setStorageAdapter,
  initStore,
  resetStore,
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats,
  getProjectContext,
  updateProjectContext,
  addProjectContextNote,
  getEpics,
  getEpic,
  createEpic,
  updateEpic,
  deleteEpic,
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  addTaskComment,
  deleteTaskComment,
  isTaskBlocked,
  getReadyTasks,
  cleanupProject,
  getWebhooks,
  getWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  setWebhookEventHandler,
  triggerWebhooks,
  getApiKeys,
  createApiKey,
  deleteApiKey,
  createCliAuthRequest,
  completeCliAuthRequest,
  pollCliAuthRequest,
  cleanupExpiredAuthRequests,
  setAuthFunctions,
  createBlob,
  getBlob as getStoreBlob,
  getBlobs as getStoreBlobs,
  deleteBlob as deleteStoreBlob,
  type WebhookEventType,
  type KeyScope,
} from '@flux/shared';
import { generateKey, generateTempToken, validateKey, encrypt, decrypt } from '@flux/shared/auth';
import { findFluxDir, loadEnvLocal, readConfig, resolveDataPath } from '@flux/shared/config';
import { createAdapter } from '@flux/shared/adapters';
import { createFilesystemBlobStorage, setBlobStorage, getBlobStorage } from '@flux/shared/blob-storage';
import { handleWebhookEvent, testWebhookDelivery } from './webhook-service.js';
import { authMiddleware, filterProjects, canReadProject, canWriteProject, requireServerAccess, type AuthContext } from './middleware/auth.js';
import { rateLimit } from './middleware/rate-limit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const buildInfo = {
  sha: process.env.BUILD_SHA ?? process.env.GIT_SHA ?? 'dev',
  time: process.env.BUILD_TIME?.trim() || new Date().toISOString(),
};

// Initialize storage - use same config resolution as CLI
const fluxDir = findFluxDir();
loadEnvLocal(fluxDir);
const config = readConfig(fluxDir);
const DATA_FILE = resolveDataPath(fluxDir, config);

const adapter = createAdapter(DATA_FILE);
setStorageAdapter(adapter);
setAuthFunctions({ generateKey, generateTempToken, validateKey, encrypt, decrypt });
initStore();

// Initialize blob storage
const blobsDir = join(fluxDir, 'blobs');
setBlobStorage(createFilesystemBlobStorage(blobsDir));

console.log(`Flux server using: ${DATA_FILE}`);

// Set up webhook event handler
setWebhookEventHandler(handleWebhookEvent);

// Validate task fields (acceptance_criteria, guardrails)
function validateTaskFields(body: Record<string, unknown>): { error?: string } {
  if (body.acceptance_criteria !== undefined) {
    if (!Array.isArray(body.acceptance_criteria)) {
      return { error: 'acceptance_criteria must be an array' };
    }
    if (body.acceptance_criteria.some((c: unknown) => typeof c !== 'string' || !(c as string).trim())) {
      return { error: 'acceptance_criteria must contain non-empty strings' };
    }
  }
  if (body.guardrails !== undefined) {
    if (!Array.isArray(body.guardrails)) {
      return { error: 'guardrails must be an array' };
    }
    for (const g of body.guardrails as unknown[]) {
      const gr = g as Record<string, unknown>;
      if (typeof gr.number !== 'number' || gr.number <= 0 || !Number.isInteger(gr.number)) {
        return { error: 'guardrail number must be a positive integer' };
      }
      if (typeof gr.text !== 'string' || !gr.text.trim()) {
        return { error: 'guardrail text must be a non-empty string' };
      }
    }
  }
  return {};
}

// Create Hono app with auth context
const app = new Hono<{ Variables: { auth: AuthContext } }>();

// Enable CORS for development
app.use('*', cors());

// Auth middleware (readonly public, writes require FLUX_API_KEY)
app.use('/api/*', authMiddleware);

// Health check endpoint (for load balancers/monitoring)
app.get('/health', (c) => c.json({ status: 'ok' }));

// ============ Live Update Events (SSE) ============
const sseClients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const sseEncoder = new TextEncoder();
let heartbeatInterval: NodeJS.Timeout | null = null;
let fileChangeTimeout: NodeJS.Timeout | null = null;

const broadcastSse = (event: string, data: unknown) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = sseEncoder.encode(payload);
  for (const controller of sseClients) {
    try {
      controller.enqueue(encoded);
    } catch {
      sseClients.delete(controller);
    }
  }
};

const startHeartbeat = () => {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    const payload = sseEncoder.encode(': keep-alive\n\n');
    for (const controller of sseClients) {
      try {
        controller.enqueue(payload);
      } catch {
        sseClients.delete(controller);
      }
    }
    if (sseClients.size === 0 && heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }, 20000);
};

const notifyDataChange = () => {
  if (fileChangeTimeout) {
    clearTimeout(fileChangeTimeout);
  }
  fileChangeTimeout = setTimeout(() => {
    broadcastSse('data-changed', { ts: Date.now() });
  }, 75);
};

// Watch JSON file for external changes (e.g., CLI updates)
const getMtime = (filePath: string): number => {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
};

let lastMtime = getMtime(DATA_FILE);
let lastWalMtime = getMtime(DATA_FILE + '-wal');

const handleFileChange = () => {
  const nextMtime = getMtime(DATA_FILE);
  const nextWalMtime = getMtime(DATA_FILE + '-wal');
  if (nextMtime !== lastMtime || nextWalMtime !== lastWalMtime) {
    lastMtime = nextMtime;
    lastWalMtime = nextWalMtime;
    adapter.read();
    notifyDataChange();
  }
};

watchFile(DATA_FILE, { interval: 100 }, handleFileChange);
// Also watch SQLite WAL file for changes (WAL mode writes here first)
watchFile(DATA_FILE + '-wal', { interval: 100 }, handleFileChange);

app.get('/api/events', () => {
  let clientController: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      clientController = controller;
      sseClients.add(controller);
      controller.enqueue(sseEncoder.encode('event: connected\ndata: "ok"\n\n'));
      startHeartbeat();
    },
    cancel() {
      if (clientController) {
        sseClients.delete(clientController);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});

// ============ API Routes ============
app.get('/version', (c) => {
  return c.json(buildInfo);
});

// Projects
app.get('/api/projects', (c) => {
  const auth = c.get('auth');
  const projects = filterProjects(auth).map(p => ({
    ...p,
    stats: getProjectStats(p.id),
  }));
  return c.json(projects);
});

app.get('/api/projects/:id', (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('id');
  const project = getProject(projectId);
  // Return 404 for both non-existent and private projects (hide existence)
  if (!project || !canReadProject(auth, projectId)) {
    return c.json({ error: 'Project not found' }, 404);
  }
  return c.json({ ...project, stats: getProjectStats(project.id) });
});

app.post('/api/projects', requireServerAccess, async (c) => {
  const body = await c.req.json();
  const project = createProject(body.name, body.description, body.visibility);
  triggerWebhooks('project.created', { project });
  return c.json(project, 201);
});

app.patch('/api/projects/:id', requireServerAccess, async (c) => {
  const body = await c.req.json();
  const previous = getProject(c.req.param('id'));
  const project = updateProject(c.req.param('id'), body);
  if (!project) return c.json({ error: 'Project not found' }, 404);
  triggerWebhooks('project.updated', { project, previous }, project.id);
  return c.json(project);
});

app.delete('/api/projects/:id', requireServerAccess, (c) => {
  const project = getProject(c.req.param('id'));
  deleteProject(c.req.param('id'));
  if (project) {
    triggerWebhooks('project.deleted', { project }, project.id);
  }
  return c.json({ success: true });
});

// Project Context
app.get('/api/projects/:id/context', (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('id');
  if (!canReadProject(auth, projectId)) {
    return c.json({ error: 'Project not found' }, 404);
  }
  const context = getProjectContext(projectId);
  return c.json(context || {});
});

app.put('/api/projects/:id/context', async (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('id');
  if (!canWriteProject(auth, projectId)) {
    return c.json({ error: 'Project not found' }, 404);
  }
  const body = await c.req.json();
  const project = updateProjectContext(projectId, {
    problem: body.problem,
    businessRules: body.businessRules,
    notes: body.notes,
  });
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  return c.json(project);
});

app.post('/api/projects/:id/context/note', async (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('id');
  if (!canWriteProject(auth, projectId)) {
    return c.json({ error: 'Project not found' }, 404);
  }
  const body = await c.req.json();
  const project = addProjectContextNote(projectId, body.note);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  return c.json(project);
});

// Epics
app.get('/api/projects/:projectId/epics', (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('projectId');
  if (!canReadProject(auth, projectId)) {
    return c.json({ error: 'Project not found' }, 404);
  }
  const epics = getEpics(projectId);
  return c.json(epics);
});

app.get('/api/epics/:id', (c) => {
  const auth = c.get('auth');
  const epic = getEpic(c.req.param('id'));
  if (!epic || !canReadProject(auth, epic.project_id)) {
    return c.json({ error: 'Epic not found' }, 404);
  }
  return c.json(epic);
});

app.post('/api/projects/:projectId/epics', async (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('projectId');
  if (!canWriteProject(auth, projectId)) {
    return c.json({ error: 'Project not found' }, 404);
  }
  const body = await c.req.json();
  const epic = createEpic(projectId, body.title, body.notes, body.auto);
  // Trigger webhook
  triggerWebhooks('epic.created', { epic }, projectId);
  return c.json(epic, 201);
});

app.patch('/api/epics/:id', async (c) => {
  const auth = c.get('auth');
  const epicId = c.req.param('id');
  const previous = getEpic(epicId);
  if (!previous) return c.json({ error: 'Epic not found' }, 404);
  if (!canWriteProject(auth, previous.project_id)) {
    return c.json({ error: 'Epic not found' }, 404); // Hide existence
  }
  const body = await c.req.json();
  const epic = updateEpic(epicId, body);
  if (!epic) return c.json({ error: 'Epic not found' }, 404);
  triggerWebhooks('epic.updated', { epic, previous }, epic.project_id);
  return c.json(epic);
});

app.delete('/api/epics/:id', (c) => {
  const auth = c.get('auth');
  const epicId = c.req.param('id');
  const epic = getEpic(epicId);
  if (!epic) return c.json({ error: 'Epic not found' }, 404);
  if (!canWriteProject(auth, epic.project_id)) {
    return c.json({ error: 'Epic not found' }, 404);
  }
  const success = deleteEpic(epicId);
  if (!success) return c.json({ error: 'Epic not found' }, 404);
  triggerWebhooks('epic.deleted', { epic }, epic.project_id);
  return c.json({ success: true });
});

// Tasks
app.get('/api/projects/:projectId/tasks', (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('projectId');
  if (!canReadProject(auth, projectId)) {
    return c.json({ error: 'Project not found' }, 404);
  }
  const tasks = getTasks(projectId).map(t => ({
    ...t,
    blocked: isTaskBlocked(t.id),
  }));
  return c.json(tasks);
});

app.get('/api/tasks/:id', (c) => {
  const auth = c.get('auth');
  const task = getTask(c.req.param('id'));
  if (!task || !canReadProject(auth, task.project_id)) {
    return c.json({ error: 'Task not found' }, 404);
  }
  return c.json({ ...task, blocked: isTaskBlocked(task.id) });
});

app.post('/api/tasks/:id/comments', async (c) => {
  const auth = c.get('auth');
  const taskId = c.req.param('id');
  const task = getTask(taskId);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (!canWriteProject(auth, task.project_id)) {
    return c.json({ error: 'Task not found' }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const commentBody = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!commentBody) return c.json({ error: 'Comment body required' }, 400);
  const author = body?.author === 'mcp' ? 'mcp' : 'user';
  const comment = addTaskComment(taskId, commentBody, author);
  if (!comment) return c.json({ error: 'Task not found' }, 404);
  return c.json(comment, 201);
});

app.delete('/api/tasks/:id/comments/:commentId', (c) => {
  const auth = c.get('auth');
  const taskId = c.req.param('id');
  const task = getTask(taskId);
  if (!task) return c.json({ error: 'Comment not found' }, 404);
  if (!canWriteProject(auth, task.project_id)) {
    return c.json({ error: 'Comment not found' }, 404);
  }
  const commentId = c.req.param('commentId');
  const deleted = deleteTaskComment(taskId, commentId);
  if (!deleted) return c.json({ error: 'Comment not found' }, 404);
  return c.json({ success: true });
});

app.post('/api/projects/:projectId/tasks', async (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('projectId');
  if (!canWriteProject(auth, projectId)) {
    return c.json({ error: 'Project not found' }, 404);
  }
  const body = await c.req.json();
  const validation = validateTaskFields(body);
  if (validation.error) return c.json({ error: validation.error }, 400);
  const task = createTask(projectId, body.title, body.epic_id, {
    priority: body.priority,
    depends_on: body.depends_on,
    acceptance_criteria: body.acceptance_criteria,
    guardrails: body.guardrails,
  });
  // Trigger webhook
  triggerWebhooks('task.created', { task }, projectId);
  return c.json(task, 201);
});

app.patch('/api/tasks/:id', async (c) => {
  const auth = c.get('auth');
  const taskId = c.req.param('id');
  const previous = getTask(taskId);
  if (!previous) return c.json({ error: 'Task not found' }, 404);
  if (!canWriteProject(auth, previous.project_id)) {
    return c.json({ error: 'Task not found' }, 404);
  }
  const body = await c.req.json();
  const validation = validateTaskFields(body);
  if (validation.error) return c.json({ error: validation.error }, 400);
  const task = updateTask(taskId, body);
  if (!task) return c.json({ error: 'Task not found' }, 404);

  // Determine which webhook events to trigger
  const events: WebhookEventType[] = ['task.updated'];
  if (body.status && previous.status !== body.status) {
    events.push('task.status_changed');
  }
  if (body.archived === true && !previous.archived) {
    events.push('task.archived');
  }
  for (const event of events) {
    triggerWebhooks(event, { task, previous }, task.project_id);
  }

  return c.json({ ...task, blocked: isTaskBlocked(task.id) });
});

app.delete('/api/tasks/:id', (c) => {
  const auth = c.get('auth');
  const taskId = c.req.param('id');
  const task = getTask(taskId);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (!canWriteProject(auth, task.project_id)) {
    return c.json({ error: 'Task not found' }, 404);
  }
  const success = deleteTask(taskId);
  if (!success) return c.json({ error: 'Task not found' }, 404);
  triggerWebhooks('task.deleted', { task }, task.project_id);
  return c.json({ success: true });
});

// Ready tasks (unblocked, not done, sorted by priority)
app.get('/api/tasks/ready', (c) => {
  const auth = c.get('auth');
  const projectId = c.req.query('project_id');
  const tasks = getReadyTasks(projectId).filter(t => canReadProject(auth, t.project_id));
  return c.json(tasks);
});

// Cleanup project (archive done tasks and/or delete empty epics)
app.post('/api/projects/:projectId/cleanup', async (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('projectId');
  if (!canWriteProject(auth, projectId)) {
    return c.json({ error: 'Project not found' }, 404);
  }
  const body = await c.req.json();
  const result = cleanupProject(projectId, body.archiveTasks ?? true, body.archiveEpics ?? true);
  return c.json({ success: true, ...result });
});

// Reset database (wipe all data)
app.post('/api/reset', requireServerAccess, (c) => {
  resetStore();
  return c.json({ success: true });
});

// ============ Blob Routes ============

const MAX_BLOB_SIZE = parseInt(process.env.FLUX_MAX_BLOB_SIZE || '') || 10 * 1024 * 1024; // 10MB default

app.post('/api/blobs', async (c) => {
  const auth = c.get('auth');
  const contentType = c.req.header('content-type') || '';

  if (!contentType.includes('multipart/form-data')) {
    return c.json({ error: 'Multipart form data required' }, 400);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const taskId = formData.get('task_id') as string | null;

  if (!file) {
    return c.json({ error: 'File required' }, 400);
  }

  if (file.size > MAX_BLOB_SIZE) {
    return c.json({ error: `File too large (max ${MAX_BLOB_SIZE} bytes)` }, 413);
  }

  // Check task access if task_id provided
  if (taskId) {
    const task = getTask(taskId);
    if (!task || !canWriteProject(auth, task.project_id)) {
      return c.json({ error: 'Task not found' }, 404);
    }
  }

  const storage = getBlobStorage();
  if (!storage) {
    return c.json({ error: 'Blob storage not initialized' }, 500);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { hash, size } = storage.write(buffer);
  const blob = createBlob(hash, file.name, file.type || 'application/octet-stream', size, taskId || undefined);

  notifyDataChange();
  return c.json(blob, 201);
});

app.get('/api/blobs', (c) => {
  const auth = c.get('auth');
  const taskId = c.req.query('task_id');
  let blobs = getStoreBlobs(taskId ? { task_id: taskId } : undefined);

  // Filter by task access
  if (taskId) {
    const task = getTask(taskId);
    if (!task || !canReadProject(auth, task.project_id)) {
      return c.json([], 200);
    }
  }

  return c.json(blobs);
});

app.get('/api/blobs/:id', (c) => {
  const auth = c.get('auth');
  const blob = getStoreBlob(c.req.param('id'));
  if (!blob) return c.json({ error: 'Blob not found' }, 404);

  // Check access via task
  if (blob.task_id) {
    const task = getTask(blob.task_id);
    if (task && !canReadProject(auth, task.project_id)) {
      return c.json({ error: 'Blob not found' }, 404);
    }
  }

  return c.json(blob);
});

app.get('/api/blobs/:id/content', (c) => {
  const auth = c.get('auth');
  const blob = getStoreBlob(c.req.param('id'));
  if (!blob) return c.json({ error: 'Blob not found' }, 404);

  // Check access via task
  if (blob.task_id) {
    const task = getTask(blob.task_id);
    if (task && !canReadProject(auth, task.project_id)) {
      return c.json({ error: 'Blob not found' }, 404);
    }
  }

  const storage = getBlobStorage();
  if (!storage) return c.json({ error: 'Blob storage not initialized' }, 500);

  const content = storage.read(blob.hash);
  if (!content) return c.json({ error: 'Blob content not found' }, 404);

  return new Response(content, {
    headers: {
      'Content-Type': blob.mime_type,
      'Content-Disposition': `attachment; filename="${blob.filename}"`,
      'Content-Length': blob.size.toString(),
    },
  });
});

app.delete('/api/blobs/:id', (c) => {
  const auth = c.get('auth');
  const blob = getStoreBlob(c.req.param('id'));
  if (!blob) return c.json({ error: 'Blob not found' }, 404);

  // Check access via task
  if (blob.task_id) {
    const task = getTask(blob.task_id);
    if (task && !canWriteProject(auth, task.project_id)) {
      return c.json({ error: 'Blob not found' }, 404);
    }
  }

  const storage = getBlobStorage();
  if (storage) {
    // Only remove file if no other blob references same hash
    const allBlobs = getStoreBlobs();
    const otherRefs = allBlobs.filter(b => b.hash === blob.hash && b.id !== blob.id);
    if (otherRefs.length === 0) {
      storage.remove(blob.hash);
    }
  }

  deleteStoreBlob(blob.id);
  notifyDataChange();
  return c.json({ success: true });
});

// ============ Webhook Routes ============
// All webhook routes require server access (admin-only)

app.get('/api/webhooks', requireServerAccess, (c) => {
  return c.json(getWebhooks());
});

app.get('/api/webhooks/:id', requireServerAccess, (c) => {
  const webhook = getWebhook(c.req.param('id'));
  if (!webhook) return c.json({ error: 'Webhook not found' }, 404);
  return c.json(webhook);
});

app.post('/api/webhooks', requireServerAccess, async (c) => {
  const body = await c.req.json();
  if (!body.name || !body.url || !body.events || !Array.isArray(body.events)) {
    return c.json({ error: 'Missing required fields: name, url, events' }, 400);
  }
  const webhook = createWebhook(body.name, body.url, body.events, {
    secret: body.secret,
    project_id: body.project_id,
    enabled: body.enabled,
  });
  return c.json(webhook, 201);
});

app.patch('/api/webhooks/:id', requireServerAccess, async (c) => {
  const body = await c.req.json();
  const webhook = updateWebhook(c.req.param('id'), body);
  if (!webhook) return c.json({ error: 'Webhook not found' }, 404);
  return c.json(webhook);
});

app.delete('/api/webhooks/:id', requireServerAccess, (c) => {
  const success = deleteWebhook(c.req.param('id'));
  if (!success) return c.json({ error: 'Webhook not found' }, 404);
  return c.json({ success: true });
});

app.post('/api/webhooks/:id/test', requireServerAccess, async (c) => {
  const webhook = getWebhook(c.req.param('id'));
  if (!webhook) return c.json({ error: 'Webhook not found' }, 404);
  const result = await testWebhookDelivery(webhook);
  return c.json({
    success: result.success,
    status_code: result.statusCode,
    response: result.body,
    error: result.error,
  });
});

app.get('/api/webhooks/:id/deliveries', requireServerAccess, (c) => {
  const webhookId = c.req.param('id');
  const webhook = getWebhook(webhookId);
  if (!webhook) return c.json({ error: 'Webhook not found' }, 404);
  const limit = parseInt(c.req.query('limit') || '50');
  return c.json(getWebhookDeliveries(webhookId, limit));
});

app.get('/api/webhook-deliveries', requireServerAccess, (c) => {
  const limit = parseInt(c.req.query('limit') || '50');
  return c.json(getWebhookDeliveries(undefined, limit));
});

// ============ Auth Routes ============

// Rate limit auth endpoints: 10 requests per minute for init/poll, 5 for key creation
const authRateLimit = rateLimit({ windowMs: 60000, maxRequests: 10 });
const keyCreateRateLimit = rateLimit({ windowMs: 60000, maxRequests: 5 });

// Check if auth is required (for web UI to show login prompt)
app.get('/api/auth/status', (c) => {
  const auth = c.get('auth');
  return c.json({
    authenticated: auth.keyType !== 'anonymous',
    keyType: auth.keyType,
    projectIds: auth.projectIds,
  });
});

// List API keys
app.get('/api/auth/keys', requireServerAccess, (c) => {
  const keys = getApiKeys().map(k => ({
    id: k.id,
    prefix: k.prefix,
    name: k.name,
    scope: k.scope,
    created_at: k.created_at,
    last_used_at: k.last_used_at,
  }));
  return c.json(keys);
});

// Create API key
app.post('/api/auth/keys', requireServerAccess, keyCreateRateLimit, async (c) => {
  const body = await c.req.json();
  if (!body.name) {
    return c.json({ error: 'Name required' }, 400);
  }
  if (body.project_ids !== undefined) {
    if (!Array.isArray(body.project_ids) || body.project_ids.length === 0) {
      return c.json({ error: 'project_ids must be a non-empty array' }, 400);
    }
  }
  const scope: KeyScope = body.project_ids
    ? { type: 'project', project_ids: body.project_ids }
    : { type: 'server' };
  const { rawKey, apiKey } = createApiKey(body.name, scope);
  return c.json({
    key: rawKey,
    id: apiKey.id,
    prefix: apiKey.prefix,
    name: apiKey.name,
    scope: apiKey.scope,
    created_at: apiKey.created_at,
  }, 201);
});

// Delete API key
app.delete('/api/auth/keys/:id', requireServerAccess, (c) => {
  const success = deleteApiKey(c.req.param('id'));
  if (!success) return c.json({ error: 'Key not found' }, 404);
  return c.json({ success: true });
});

// CLI auth flow: Start auth request
app.post('/api/auth/cli-init', authRateLimit, (c) => {
  cleanupExpiredAuthRequests();
  const request = createCliAuthRequest();
  return c.json({ token: request.token, expires_at: request.expires_at });
});

// CLI auth flow: Poll for completion
app.post('/api/auth/cli-poll', authRateLimit, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.token) return c.json({ error: 'Token required' }, 400);
  const result = pollCliAuthRequest(body.token);
  return c.json(result);
});

// CLI auth flow: Complete from web
app.post('/api/auth/cli-complete', requireServerAccess, async (c) => {
  const body = await c.req.json();
  if (!body.token || !body.name) {
    return c.json({ error: 'Token and name required' }, 400);
  }
  if (body.project_ids !== undefined) {
    if (!Array.isArray(body.project_ids) || body.project_ids.length === 0) {
      return c.json({ error: 'project_ids must be a non-empty array' }, 400);
    }
  }
  const scope: KeyScope = body.project_ids
    ? { type: 'project', project_ids: body.project_ids }
    : { type: 'server' };
  const result = completeCliAuthRequest(body.token, body.name, scope);
  if (!result) {
    return c.json({ error: 'Invalid or expired token' }, 400);
  }
  return c.json({ success: true });
});

// API 404 handler - must be before SPA fallback
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

// Serve static files from web build (production)
const webDistPath = join(__dirname, '../../web/dist');
if (existsSync(webDistPath)) {
  const indexPath = join(webDistPath, 'index.html');
  const indexHtml = existsSync(indexPath) ? readFileSync(indexPath, 'utf-8') : null;
  // Hoist serveStatic handler outside request loop for performance
  const staticHandler = serveStatic({ root: webDistPath });
  // Whitelist of known static file extensions (avoid false positives like /projects/v2.0)
  const staticExtensions = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map|json|webp|webm|mp4|mp3|pdf)$/i;

  // Custom SPA-aware static file serving
  // Check if file exists before serving, otherwise fall through to SPA handler
  app.use('/*', async (c, next) => {
    const path = c.req.path;

    // Skip API routes (already handled above)
    if (path.startsWith('/api/')) {
      return next();
    }

    // Check if this is a request for a static file (has known extension)
    if (staticExtensions.test(path)) {
      const filePath = join(webDistPath, path);
      // Security: prevent path traversal attacks
      if (!filePath.startsWith(webDistPath + '/')) {
        return c.notFound();
      }
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        return staticHandler(c, next);
      }
      // File with extension not found - return 404
      return c.notFound();
    }

    // No static extension - this is a SPA route, serve index.html
    if (indexHtml) {
      return c.html(indexHtml);
    }

    return next();
  });
}

// Start server
const port = parseInt(process.env.PORT || '3000');
console.log(`Flux server running at http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
