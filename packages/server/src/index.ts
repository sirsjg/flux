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
  type WebhookEventType,
} from '@flux/shared';
import { findFluxDir, loadEnvLocal, readConfig, resolveDataPath } from '@flux/shared/config';
import { createAdapter, createAdapterFromConfig } from '@flux/shared/adapters';
import { handleWebhookEvent, testWebhookDelivery } from './webhook-service.js';
import { authMiddleware } from './middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const buildInfo = {
  sha: process.env.BUILD_SHA ?? process.env.GIT_SHA ?? 'dev',
  time: process.env.BUILD_TIME?.trim() || new Date().toISOString(),
};

// Initialize storage - use same config resolution as CLI
const fluxDir = findFluxDir();
loadEnvLocal(fluxDir);
const config = readConfig(fluxDir);

// Check if new storage config exists, otherwise fall back to legacy file-based config
let adapter;
let DATA_FILE: string | undefined;

if (config.storage) {
  // New provider-based configuration
  adapter = createAdapterFromConfig(config.storage);
  console.log(`Flux server using: ${config.storage.provider} (${config.storage.connectionString})`);
  // No DATA_FILE for cloud providers (realtime subscriptions handle updates)
} else {
  // Legacy file-based configuration
  DATA_FILE = resolveDataPath(fluxDir, config);
  adapter = createAdapter(DATA_FILE);
  console.log(`Flux server using: ${DATA_FILE}`);
}

setStorageAdapter(adapter);
initStore();

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

// Create Hono app
const app = new Hono();

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

// Watch file for external changes (e.g., CLI updates) - only for legacy file-based storage
// Cloud providers use realtime subscriptions instead
if (DATA_FILE) {
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
    const nextMtime = getMtime(DATA_FILE!);
    const nextWalMtime = getMtime(DATA_FILE! + '-wal');
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
}

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

// Helper: Compute project metadata (lanes, blockers, lastEvent)
function computeProjectMeta(projectId: string) {
  const epics = getEpics(projectId);
  const tasks = getTasks(projectId);

  // Compute lanes from epic statuses
  const lanes = {
    shaping: epics.filter(e => e.status === 'planning').length,
    betting: epics.filter(e => e.status === 'todo').length,
    active: epics.filter(e => e.status === 'in_progress').length,
    shipped: epics.filter(e => e.status === 'done').length,
  };

  // Compute blockers
  const blockedTasks = tasks.filter(t => t.blocked_reason);
  const blockers = {
    count: blockedTasks.length,
    reason: blockedTasks[0]?.blocked_reason || undefined,
  };

  // Compute last event from task updates
  const sortedTasks = tasks
    .filter(t => t.updated_at)
    .sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime());

  const lastEventTime = sortedTasks[0]?.updated_at;
  const lastEvent = lastEventTime ? formatRelativeTime(lastEventTime) : 'No activity';

  return { lanes, blockers, lastEvent };
}

// Helper: Format relative time (e.g., "2h ago")
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
}

// Projects
app.get('/api/projects', (c) => {
  const projects = getProjects().map(p => {
    const stats = getProjectStats(p.id);
    const computed = computeProjectMeta(p.id);

    return {
      ...p,
      stats,
      meta: {
        aiStatus: p.ai_status || 'Idle',
        risk: p.risk_level || 'Green',
        primaryPhase: p.primary_phase || 'Shaping',
        lanes: computed.lanes,
        activeBets: computed.lanes.active,
        lastEvent: computed.lastEvent,
        thrash: {
          cuts: p.thrash_cuts || 0,
          retries: p.thrash_retries || 0,
        },
        blockers: computed.blockers,
      },
    };
  });
  return c.json(projects);
});

app.get('/api/projects/:id', (c) => {
  const project = getProject(c.req.param('id'));
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const stats = getProjectStats(project.id);
  const computed = computeProjectMeta(project.id);

  return c.json({
    ...project,
    stats,
    meta: {
      aiStatus: project.ai_status || 'Idle',
      risk: project.risk_level || 'Green',
      primaryPhase: project.primary_phase || 'Shaping',
      lanes: computed.lanes,
      activeBets: computed.lanes.active,
      lastEvent: computed.lastEvent,
      thrash: {
        cuts: project.thrash_cuts || 0,
        retries: project.thrash_retries || 0,
      },
      blockers: computed.blockers,
    },
  });
});

app.post('/api/projects', async (c) => {
  const body = await c.req.json();
  const project = await createProject(body.name, body.description);
  // Trigger webhook
  triggerWebhooks('project.created', { project });
  return c.json(project, 201);
});

app.patch('/api/projects/:id', async (c) => {
  const body = await c.req.json();

  // Validate metadata enums if provided
  if (body.ai_status && !['Idle', 'Running', 'Blocked', 'Failing'].includes(body.ai_status)) {
    return c.json({ error: 'Invalid ai_status. Must be one of: Idle, Running, Blocked, Failing' }, 400);
  }
  if (body.risk_level && !['Green', 'Amber', 'Red'].includes(body.risk_level)) {
    return c.json({ error: 'Invalid risk_level. Must be one of: Green, Amber, Red' }, 400);
  }
  if (body.primary_phase && !['Shaping', 'Betting', 'Active', 'Shipped'].includes(body.primary_phase)) {
    return c.json({ error: 'Invalid primary_phase. Must be one of: Shaping, Betting, Active, Shipped' }, 400);
  }

  const previous = getProject(c.req.param('id'));
  const project = await updateProject(c.req.param('id'), body);
  if (!project) return c.json({ error: 'Project not found' }, 404);
  // Trigger webhook
  triggerWebhooks('project.updated', { project, previous }, project.id);
  return c.json(project);
});

app.delete('/api/projects/:id', async (c) => {
  const project = getProject(c.req.param('id'));
  await deleteProject(c.req.param('id'));
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
  const epic = await createEpic(projectId, body.title, body.notes, body.auto);
  // Trigger webhook
  triggerWebhooks('epic.created', { epic }, projectId);
  return c.json(epic, 201);
});

app.patch('/api/epics/:id', async (c) => {
  const body = await c.req.json();
  const previous = getEpic(c.req.param('id'));
  const epic = await updateEpic(c.req.param('id'), body);
  if (!epic) return c.json({ error: 'Epic not found' }, 404);
  // Trigger webhook
  triggerWebhooks('epic.updated', { epic, previous }, epic.project_id);
  return c.json(epic);
});

app.delete('/api/epics/:id', async (c) => {
  const epic = getEpic(c.req.param('id'));
  const success = await deleteEpic(c.req.param('id'));
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

app.post('/api/tasks/:id/comments', async (c) => {
  const taskId = c.req.param('id');
  const task = getTask(taskId);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  const body = await c.req.json().catch(() => null);
  const commentBody = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!commentBody) return c.json({ error: 'Comment body required' }, 400);
  const author = body?.author === 'mcp' ? 'mcp' : 'user';
  const comment = await addTaskComment(taskId, commentBody, author);
  if (!comment) return c.json({ error: 'Task not found' }, 404);
  return c.json(comment, 201);
});

app.delete('/api/tasks/:id/comments/:commentId', async (c) => {
  const taskId = c.req.param('id');
  const commentId = c.req.param('commentId');
  const deleted = await deleteTaskComment(taskId, commentId);
  if (!deleted) return c.json({ error: 'Comment not found' }, 404);
  return c.json({ success: true });
});

app.post('/api/projects/:projectId/tasks', async (c) => {
  const body = await c.req.json();
  const validation = validateTaskFields(body);
  if (validation.error) return c.json({ error: validation.error }, 400);
  const projectId = c.req.param('projectId');
  const task = await createTask(projectId, body.title, body.epic_id, {
    priority: body.priority,
    type: body.type,
    depends_on: body.depends_on,
    acceptance_criteria: body.acceptance_criteria,
    guardrails: body.guardrails,
  });
  // Trigger webhook
  triggerWebhooks('task.created', { task }, projectId);
  return c.json(task, 201);
});

app.patch('/api/tasks/:id', async (c) => {
  const body = await c.req.json();
  const validation = validateTaskFields(body);
  if (validation.error) return c.json({ error: validation.error }, 400);
  const previous = getTask(c.req.param('id'));
  const task = await updateTask(c.req.param('id'), body);
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

app.delete('/api/tasks/:id', async (c) => {
  const task = getTask(c.req.param('id'));
  const success = await deleteTask(c.req.param('id'));
  if (!success) return c.json({ error: 'Task not found' }, 404);
  // Trigger webhook
  if (task) {
    triggerWebhooks('task.deleted', { task }, task.project_id);
  }
  return c.json({ success: true });
});

// Ready tasks (unblocked, not done, sorted by priority)
app.get('/api/tasks/ready', (c) => {
  const projectId = c.req.query('project_id');
  const tasks = getReadyTasks(projectId);
  return c.json(tasks);
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

// Reset database (wipe all data)
app.post('/api/reset', (c) => {
  resetStore();
  return c.json({ success: true });
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
        // Add aggressive no-cache headers to force fresh loads
        c.header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
        c.header('Pragma', 'no-cache');
        c.header('Expires', '0');
        return staticHandler(c, next);
      }
      // File with extension not found - return 404
      return c.notFound();
    }

    // No static extension - this is a SPA route, serve index.html
    if (indexHtml) {
      // Add no-cache headers for HTML to ensure latest bundle refs
      c.header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      c.header('Pragma', 'no-cache');
      c.header('Expires', '0');
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
