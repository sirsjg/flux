import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, writeFileSync, readFileSync, watchFile, openSync, closeSync, unlinkSync, renameSync, statSync } from 'fs';
import {
  setStorageAdapter,
  initStore,
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats,
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
  isTaskBlocked,
  cleanupProject,
  getWebhooks,
  getWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  setWebhookEventHandler,
  triggerWebhooks,
  type Store,
  type WebhookEventType,
} from '@flux/shared';
import { handleWebhookEvent, testWebhookDelivery } from './webhook-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Data file path
const DATA_DIR = join(__dirname, '../../data');
const DATA_FILE = join(DATA_DIR, 'flux.json');
const LOCK_FILE = `${DATA_FILE}.lock`;
const TMP_FILE = `${DATA_FILE}.tmp`;

// Default store data
const defaultData: Store = {
  projects: [],
  epics: [],
  tasks: [],
};

// Create file-based storage adapter
function createFileAdapter(): { read: () => void; write: () => void; data: Store } {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Initialize file if it doesn't exist
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }

  let data: Store = { ...defaultData };

  const sleep = (ms: number) => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  };

  const withFileLock = <T,>(fn: () => T): T => {
    const start = Date.now();
    while (true) {
      try {
        const fd = openSync(LOCK_FILE, 'wx');
        try {
          return fn();
        } finally {
          closeSync(fd);
          try {
            unlinkSync(LOCK_FILE);
          } catch {
            // Best-effort cleanup; stale lock handled by timeout.
          }
        }
      } catch (error: any) {
        if (error?.code !== 'EEXIST') throw error;
        if (Date.now() - start > 2000) {
          throw new Error(`Timed out waiting for data lock: ${LOCK_FILE}`);
        }
        sleep(25);
      }
    }
  };

  return {
    read() {
      withFileLock(() => {
        try {
          const content = readFileSync(DATA_FILE, 'utf-8');
          data = JSON.parse(content);
        } catch {
          data = { ...defaultData };
        }
      });
    },
    write() {
      withFileLock(() => {
        writeFileSync(TMP_FILE, JSON.stringify(data, null, 2));
        renameSync(TMP_FILE, DATA_FILE);
      });
    },
    get data() {
      return data;
    },
  };
}

// Initialize storage
const fileAdapter = createFileAdapter();
setStorageAdapter(fileAdapter);
initStore();

// Set up webhook event handler
setWebhookEventHandler(handleWebhookEvent);

// Create Hono app
const app = new Hono();

// Enable CORS for development
app.use('*', cors());

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

// Use watchFile with polling - more reliable than watch() on macOS with atomic renames
let lastMtime = 0;
try {
  lastMtime = statSync(DATA_FILE).mtimeMs;
} catch {
  // File may not exist yet
}

watchFile(DATA_FILE, { interval: 100 }, (curr) => {
  // Only trigger if modification time actually changed (avoids duplicate events)
  if (curr.mtimeMs !== lastMtime) {
    lastMtime = curr.mtimeMs;
    fileAdapter.read();  // Reload data from disk before notifying clients
    notifyDataChange();
  }
});

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

// Projects
app.get('/api/projects', (c) => {
  const projects = getProjects().map(p => ({
    ...p,
    stats: getProjectStats(p.id),
  }));
  return c.json(projects);
});

app.get('/api/projects/:id', (c) => {
  const project = getProject(c.req.param('id'));
  if (!project) return c.json({ error: 'Project not found' }, 404);
  return c.json({ ...project, stats: getProjectStats(project.id) });
});

app.post('/api/projects', async (c) => {
  const body = await c.req.json();
  const project = createProject(body.name, body.description);
  // Trigger webhook
  triggerWebhooks('project.created', { project });
  return c.json(project, 201);
});

app.patch('/api/projects/:id', async (c) => {
  const body = await c.req.json();
  const previous = getProject(c.req.param('id'));
  const project = updateProject(c.req.param('id'), body);
  if (!project) return c.json({ error: 'Project not found' }, 404);
  // Trigger webhook
  triggerWebhooks('project.updated', { project, previous }, project.id);
  return c.json(project);
});

app.delete('/api/projects/:id', (c) => {
  const project = getProject(c.req.param('id'));
  deleteProject(c.req.param('id'));
  // Trigger webhook
  if (project) {
    triggerWebhooks('project.deleted', { project }, project.id);
  }
  return c.json({ success: true });
});

// Epics
app.get('/api/projects/:projectId/epics', (c) => {
  const epics = getEpics(c.req.param('projectId'));
  return c.json(epics);
});

app.get('/api/epics/:id', (c) => {
  const epic = getEpic(c.req.param('id'));
  if (!epic) return c.json({ error: 'Epic not found' }, 404);
  return c.json(epic);
});

app.post('/api/projects/:projectId/epics', async (c) => {
  const body = await c.req.json();
  const projectId = c.req.param('projectId');
  const epic = createEpic(projectId, body.title, body.notes);
  // Trigger webhook
  triggerWebhooks('epic.created', { epic }, projectId);
  return c.json(epic, 201);
});

app.patch('/api/epics/:id', async (c) => {
  const body = await c.req.json();
  const previous = getEpic(c.req.param('id'));
  const epic = updateEpic(c.req.param('id'), body);
  if (!epic) return c.json({ error: 'Epic not found' }, 404);
  // Trigger webhook
  triggerWebhooks('epic.updated', { epic, previous }, epic.project_id);
  return c.json(epic);
});

app.delete('/api/epics/:id', (c) => {
  const epic = getEpic(c.req.param('id'));
  const success = deleteEpic(c.req.param('id'));
  if (!success) return c.json({ error: 'Epic not found' }, 404);
  // Trigger webhook
  if (epic) {
    triggerWebhooks('epic.deleted', { epic }, epic.project_id);
  }
  return c.json({ success: true });
});

// Tasks
app.get('/api/projects/:projectId/tasks', (c) => {
  const tasks = getTasks(c.req.param('projectId')).map(t => ({
    ...t,
    blocked: isTaskBlocked(t.id),
  }));
  return c.json(tasks);
});

app.get('/api/tasks/:id', (c) => {
  const task = getTask(c.req.param('id'));
  if (!task) return c.json({ error: 'Task not found' }, 404);
  return c.json({ ...task, blocked: isTaskBlocked(task.id) });
});

app.post('/api/projects/:projectId/tasks', async (c) => {
  const body = await c.req.json();
  const projectId = c.req.param('projectId');
  const task = createTask(projectId, body.title, body.epic_id, body.notes);
  // Trigger webhook
  triggerWebhooks('task.created', { task }, projectId);
  return c.json(task, 201);
});

app.patch('/api/tasks/:id', async (c) => {
  const body = await c.req.json();
  const previous = getTask(c.req.param('id'));
  const task = updateTask(c.req.param('id'), body);
  if (!task) return c.json({ error: 'Task not found' }, 404);

  // Determine which webhook events to trigger
  const events: WebhookEventType[] = ['task.updated'];

  // Check for status change
  if (previous && body.status && previous.status !== body.status) {
    events.push('task.status_changed');
  }

  // Check for archive
  if (body.archived === true && (!previous || !previous.archived)) {
    events.push('task.archived');
  }

  // Trigger webhooks
  for (const event of events) {
    triggerWebhooks(event, { task, previous }, task.project_id);
  }

  return c.json({ ...task, blocked: isTaskBlocked(task.id) });
});

app.delete('/api/tasks/:id', (c) => {
  const task = getTask(c.req.param('id'));
  const success = deleteTask(c.req.param('id'));
  if (!success) return c.json({ error: 'Task not found' }, 404);
  // Trigger webhook
  if (task) {
    triggerWebhooks('task.deleted', { task }, task.project_id);
  }
  return c.json({ success: true });
});

// Cleanup project (archive done tasks and/or delete empty epics)
app.post('/api/projects/:projectId/cleanup', async (c) => {
  const body = await c.req.json();
  const result = cleanupProject(
    c.req.param('projectId'),
    body.archiveTasks ?? true,
    body.archiveEpics ?? true
  );
  return c.json({ success: true, ...result });
});

// ============ Webhook Routes ============

// List all webhooks
app.get('/api/webhooks', (c) => {
  const webhooks = getWebhooks();
  return c.json(webhooks);
});

// Get a single webhook
app.get('/api/webhooks/:id', (c) => {
  const webhook = getWebhook(c.req.param('id'));
  if (!webhook) return c.json({ error: 'Webhook not found' }, 404);
  return c.json(webhook);
});

// Create a webhook
app.post('/api/webhooks', async (c) => {
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

// Update a webhook
app.patch('/api/webhooks/:id', async (c) => {
  const body = await c.req.json();
  const webhook = updateWebhook(c.req.param('id'), body);
  if (!webhook) return c.json({ error: 'Webhook not found' }, 404);
  return c.json(webhook);
});

// Delete a webhook
app.delete('/api/webhooks/:id', (c) => {
  const success = deleteWebhook(c.req.param('id'));
  if (!success) return c.json({ error: 'Webhook not found' }, 404);
  return c.json({ success: true });
});

// Test a webhook
app.post('/api/webhooks/:id/test', async (c) => {
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

// Get webhook deliveries
app.get('/api/webhooks/:id/deliveries', (c) => {
  const webhookId = c.req.param('id');
  const webhook = getWebhook(webhookId);
  if (!webhook) return c.json({ error: 'Webhook not found' }, 404);

  const limit = parseInt(c.req.query('limit') || '50');
  const deliveries = getWebhookDeliveries(webhookId, limit);
  return c.json(deliveries);
});

// Get all recent deliveries (admin view)
app.get('/api/webhook-deliveries', (c) => {
  const limit = parseInt(c.req.query('limit') || '50');
  const deliveries = getWebhookDeliveries(undefined, limit);
  return c.json(deliveries);
});

// Serve static files from web build (production)
const webDistPath = join(__dirname, '../../web/dist');
if (existsSync(webDistPath)) {
  app.use('/*', serveStatic({ root: webDistPath }));
}

// Start server
const port = parseInt(process.env.PORT || '3000');
console.log(`Flux server running at http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
