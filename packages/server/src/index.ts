import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, writeFileSync, readFileSync, watch } from 'fs';
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
  type Store,
} from '@flux/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Data file path
const DATA_DIR = join(__dirname, '../../data');
const DATA_FILE = join(DATA_DIR, 'flux.json');

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

  return {
    read() {
      try {
        const content = readFileSync(DATA_FILE, 'utf-8');
        data = JSON.parse(content);
      } catch {
        data = { ...defaultData };
      }
    },
    write() {
      writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
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

watch(DATA_FILE, () => {
  fileAdapter.read();  // Reload data from disk before notifying clients
  notifyDataChange();
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
  return c.json(project, 201);
});

app.patch('/api/projects/:id', async (c) => {
  const body = await c.req.json();
  const project = updateProject(c.req.param('id'), body);
  if (!project) return c.json({ error: 'Project not found' }, 404);
  return c.json(project);
});

app.delete('/api/projects/:id', (c) => {
  deleteProject(c.req.param('id'));
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
  const epic = createEpic(c.req.param('projectId'), body.title, body.notes);
  return c.json(epic, 201);
});

app.patch('/api/epics/:id', async (c) => {
  const body = await c.req.json();
  const epic = updateEpic(c.req.param('id'), body);
  if (!epic) return c.json({ error: 'Epic not found' }, 404);
  return c.json(epic);
});

app.delete('/api/epics/:id', (c) => {
  const success = deleteEpic(c.req.param('id'));
  if (!success) return c.json({ error: 'Epic not found' }, 404);
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
  const task = createTask(c.req.param('projectId'), body.title, body.epic_id, body.notes);
  return c.json(task, 201);
});

app.patch('/api/tasks/:id', async (c) => {
  const body = await c.req.json();
  const task = updateTask(c.req.param('id'), body);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  return c.json({ ...task, blocked: isTaskBlocked(task.id) });
});

app.delete('/api/tasks/:id', (c) => {
  const success = deleteTask(c.req.param('id'));
  if (!success) return c.json({ error: 'Task not found' }, 404);
  return c.json({ success: true });
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
