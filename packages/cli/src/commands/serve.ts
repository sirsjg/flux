import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
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
  addTaskComment,
  deleteTaskComment,
  isTaskBlocked,
  cleanupProject,
  getStore,
  replaceStore,
  mergeStore,
} from '@flux/shared';
import { createAdapter } from '@flux/shared/adapters';
import { findFluxDir, readConfig } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createApp() {
  const app = new Hono();
  app.use('*', cors());

  // Projects
  app.get('/api/projects', (c) => {
    const projects = getProjects().map(p => ({ ...p, stats: getProjectStats(p.id) }));
    return c.json(projects);
  });
  app.get('/api/projects/:id', (c) => {
    const project = getProject(c.req.param('id'));
    if (!project) return c.json({ error: 'Not found' }, 404);
    return c.json({ ...project, stats: getProjectStats(project.id) });
  });
  app.post('/api/projects', async (c) => {
    const body = await c.req.json();
    return c.json(createProject(body.name, body.description), 201);
  });
  app.patch('/api/projects/:id', async (c) => {
    const body = await c.req.json();
    const project = updateProject(c.req.param('id'), body);
    if (!project) return c.json({ error: 'Not found' }, 404);
    return c.json(project);
  });
  app.delete('/api/projects/:id', (c) => {
    deleteProject(c.req.param('id'));
    return c.json({ success: true });
  });

  // Epics
  app.get('/api/projects/:projectId/epics', (c) => c.json(getEpics(c.req.param('projectId'))));
  app.get('/api/epics/:id', (c) => {
    const epic = getEpic(c.req.param('id'));
    if (!epic) return c.json({ error: 'Not found' }, 404);
    return c.json(epic);
  });
  app.post('/api/projects/:projectId/epics', async (c) => {
    const body = await c.req.json();
    return c.json(createEpic(c.req.param('projectId'), body.title, body.notes, body.auto), 201);
  });
  app.patch('/api/epics/:id', async (c) => {
    const body = await c.req.json();
    const epic = updateEpic(c.req.param('id'), body);
    if (!epic) return c.json({ error: 'Not found' }, 404);
    return c.json(epic);
  });
  app.delete('/api/epics/:id', (c) => {
    if (!deleteEpic(c.req.param('id'))) return c.json({ error: 'Not found' }, 404);
    return c.json({ success: true });
  });

  // Tasks
  app.get('/api/projects/:projectId/tasks', (c) => {
    const tasks = getTasks(c.req.param('projectId')).map(t => ({ ...t, blocked: isTaskBlocked(t.id) }));
    return c.json(tasks);
  });
  app.get('/api/tasks/:id', (c) => {
    const task = getTask(c.req.param('id'));
    if (!task) return c.json({ error: 'Not found' }, 404);
    return c.json({ ...task, blocked: isTaskBlocked(task.id) });
  });
  app.post('/api/projects/:projectId/tasks', async (c) => {
    const body = await c.req.json();
    return c.json(createTask(c.req.param('projectId'), body.title, body.epic_id), 201);
  });
  app.patch('/api/tasks/:id', async (c) => {
    const body = await c.req.json();
    const task = updateTask(c.req.param('id'), body);
    if (!task) return c.json({ error: 'Not found' }, 404);
    return c.json({ ...task, blocked: isTaskBlocked(task.id) });
  });
  app.delete('/api/tasks/:id', (c) => {
    if (!deleteTask(c.req.param('id'))) return c.json({ error: 'Not found' }, 404);
    return c.json({ success: true });
  });

  // Comments
  app.post('/api/tasks/:id/comments', async (c) => {
    const body = await c.req.json();
    const comment = addTaskComment(c.req.param('id'), body.body, body.author || 'user');
    if (!comment) return c.json({ error: 'Task not found' }, 404);
    return c.json(comment, 201);
  });
  app.delete('/api/tasks/:id/comments/:commentId', (c) => {
    if (!deleteTaskComment(c.req.param('id'), c.req.param('commentId'))) {
      return c.json({ error: 'Not found' }, 404);
    }
    return c.json({ success: true });
  });

  // Cleanup
  app.post('/api/projects/:projectId/cleanup', async (c) => {
    const body = await c.req.json();
    const result = cleanupProject(c.req.param('projectId'), body.archiveTasks ?? false, body.archiveEpics ?? false);
    return c.json(result);
  });

  // Export/Import
  app.get('/api/export', (c) => c.json(getStore()));
  app.post('/api/import', async (c) => {
    const body = await c.req.json();
    const { data, merge } = body;
    if (merge) {
      mergeStore(data);
    } else {
      replaceStore(data);
    }
    return c.json({ success: true });
  });

  return app;
}

// Check if a port is available
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// Find an available port starting from the given port
async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts - 1}`);
}

export async function serveCommand(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  // Default port 3589 = "FLUX" on phone keypad (F=3, L=5, U=8, X=9)
  const requestedPort = parseInt(flags.port as string || flags.p as string || '3589', 10);

  // Resolve data file: --data flag > config.dataFile > default
  const fluxDir = findFluxDir();
  const config = readConfig(fluxDir);
  const dataFile = (flags.data as string) ||
    (config.dataFile ? resolve(fluxDir, config.dataFile) : resolve(fluxDir, 'data.json'));

  // Find available port
  let port: number;
  try {
    port = await findAvailablePort(requestedPort);
    if (port !== requestedPort) {
      console.log(`Port ${requestedPort} in use, using ${port}`);
    }
  } catch (e: any) {
    console.error(e.message);
    process.exit(1);
  }

  // Initialize store (supports .json or .sqlite/.db)
  const adapter = createAdapter(dataFile);
  setStorageAdapter(adapter);
  initStore();

  const app = createApp();

  // Try to serve static files from web dist
  const webDistPaths = [
    join(__dirname, '../../../web/dist'),  // dev: relative to cli/src/commands
    join(__dirname, '../../web/dist'),     // built: relative to cli/dist
    join(process.cwd(), 'packages/web/dist'), // monorepo root
  ];

  let webDistPath: string | null = null;
  for (const p of webDistPaths) {
    if (existsSync(join(p, 'index.html'))) {
      webDistPath = p;
      break;
    }
  }

  if (webDistPath) {
    app.use('/*', serveStatic({ root: webDistPath }));
    app.get('/', serveStatic({ path: join(webDistPath, 'index.html') }));
  } else {
    app.get('/', (c) => c.text('Web UI not found. API available at /api/*'));
  }

  console.log(`Starting server on http://localhost:${port}`);
  console.log(`Data file: ${dataFile}`);
  if (webDistPath) {
    console.log(`Web UI: ${webDistPath}`);
  } else {
    console.log('Web UI: not found (API only mode)');
  }
  console.log('');
  console.log('Press Ctrl+C to stop');

  serve({ fetch: app.fetch, port });
}
