/**
 * Flux client - abstracts local store vs HTTP server
 * Used by CLI, MCP, and other consumers
 */

import {
  getProjects as localGetProjects,
  getProject as localGetProject,
  createProject as localCreateProject,
  updateProject as localUpdateProject,
  deleteProject as localDeleteProject,
  getProjectStats as localGetProjectStats,
  getEpics as localGetEpics,
  getEpic as localGetEpic,
  createEpic as localCreateEpic,
  updateEpic as localUpdateEpic,
  deleteEpic as localDeleteEpic,
  getTasks as localGetTasks,
  getTask as localGetTask,
  createTask as localCreateTask,
  updateTask as localUpdateTask,
  deleteTask as localDeleteTask,
  isTaskBlocked as localIsTaskBlocked,
  addTaskComment as localAddTaskComment,
  deleteTaskComment as localDeleteTaskComment,
  getReadyTasks as localGetReadyTasks,
  getStore as localGetStore,
  replaceStore as localReplaceStore,
  mergeStore as localMergeStore,
  getWebhooks as localGetWebhooks,
  getWebhook as localGetWebhook,
  createWebhook as localCreateWebhook,
  updateWebhook as localUpdateWebhook,
  deleteWebhook as localDeleteWebhook,
  getWebhookDeliveries as localGetWebhookDeliveries,
  PRIORITY_CONFIG,
  PRIORITIES,
} from './index.js';

import type {
  Project,
  Epic,
  Task,
  TaskComment,
  Priority,
  Store,
  Webhook,
  WebhookDelivery,
  WebhookEventType,
  Guardrail,
} from './types.js';

// Re-export types and constants
export { PRIORITY_CONFIG, PRIORITIES };
export type { Project, Epic, Task, TaskComment, Priority, Store, Webhook, WebhookDelivery, WebhookEventType, Guardrail };

// Server response includes computed blocked field
type TaskWithBlocked = Task & { blocked: boolean };

// Typed HTTP error for better error discrimination
export class FluxHttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string
  ) {
    super(message);
    this.name = 'FluxHttpError';
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

// Client state
let serverUrl: string | null = null;
let apiKey: string | null = null;

export function initClient(server?: string, key?: string): void {
  serverUrl = server || null;
  apiKey = key || null;
}

export function isServerMode(): boolean {
  return serverUrl !== null;
}

export function getServerUrl(): string | null {
  return serverUrl;
}

// HTTP helper
async function http<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${serverUrl}${path}`;
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new FluxHttpError(err.error || res.statusText, res.status, res.statusText);
  }
  return res.json();
}

// Projects
export async function getProjects(): Promise<Project[]> {
  if (serverUrl) {
    return http('GET', '/api/projects');
  }
  return localGetProjects();
}

export async function getProject(id: string): Promise<Project | undefined> {
  if (serverUrl) {
    try {
      return await http('GET', `/api/projects/${id}`);
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return undefined;
      throw e;
    }
  }
  return localGetProject(id);
}

export async function createProject(name: string, description?: string): Promise<Project> {
  if (serverUrl) {
    return http('POST', '/api/projects', { name, description });
  }
  return localCreateProject(name, description);
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
  if (serverUrl) {
    try {
      return await http('PATCH', `/api/projects/${id}`, updates);
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return undefined;
      throw e;
    }
  }
  return localUpdateProject(id, updates);
}

export async function deleteProject(id: string): Promise<boolean> {
  if (serverUrl) {
    try {
      await http('DELETE', `/api/projects/${id}`);
      return true;
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return false;
      throw e;
    }
  }
  localDeleteProject(id);
  return true;
}

export async function getProjectStats(id: string): Promise<{ total: number; done: number }> {
  if (serverUrl) {
    const project = await http<Project & { stats: { total: number; done: number } }>('GET', `/api/projects/${id}`);
    return project.stats || { total: 0, done: 0 };
  }
  return localGetProjectStats(id);
}

// Epics
export async function getEpics(projectId: string): Promise<Epic[]> {
  if (serverUrl) {
    return http('GET', `/api/projects/${projectId}/epics`);
  }
  return localGetEpics(projectId);
}

export async function getEpic(id: string): Promise<Epic | undefined> {
  if (serverUrl) {
    try {
      return await http('GET', `/api/epics/${id}`);
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return undefined;
      throw e;
    }
  }
  return localGetEpic(id);
}

export async function createEpic(projectId: string, title: string, notes?: string, auto?: boolean): Promise<Epic> {
  if (serverUrl) {
    return http('POST', `/api/projects/${projectId}/epics`, { title, notes, auto });
  }
  return localCreateEpic(projectId, title, notes, auto);
}

export async function updateEpic(id: string, updates: Partial<Epic>): Promise<Epic | undefined> {
  if (serverUrl) {
    try {
      return await http('PATCH', `/api/epics/${id}`, updates);
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return undefined;
      throw e;
    }
  }
  return localUpdateEpic(id, updates);
}

export async function deleteEpic(id: string): Promise<boolean> {
  if (serverUrl) {
    try {
      await http('DELETE', `/api/epics/${id}`);
      return true;
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return false;
      throw e;
    }
  }
  return localDeleteEpic(id);
}

// Tasks
export async function getTasks(projectId: string): Promise<Task[]> {
  if (serverUrl) {
    return http('GET', `/api/projects/${projectId}/tasks`);
  }
  return localGetTasks(projectId);
}

export async function getTask(id: string): Promise<Task | undefined> {
  if (serverUrl) {
    try {
      return await http('GET', `/api/tasks/${id}`);
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return undefined;
      throw e;
    }
  }
  return localGetTask(id);
}

export async function createTask(
  projectId: string,
  title: string,
  epicId?: string,
  options?: { priority?: Priority; depends_on?: string[]; acceptance_criteria?: string[]; guardrails?: Guardrail[] }
): Promise<Task> {
  if (serverUrl) {
    return http('POST', `/api/projects/${projectId}/tasks`, {
      title,
      epic_id: epicId,
      priority: options?.priority,
      depends_on: options?.depends_on,
      acceptance_criteria: options?.acceptance_criteria,
      guardrails: options?.guardrails,
    });
  }
  return localCreateTask(projectId, title, epicId, options);
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
  if (serverUrl) {
    try {
      return await http('PATCH', `/api/tasks/${id}`, updates);
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return undefined;
      throw e;
    }
  }
  return localUpdateTask(id, updates);
}

export async function deleteTask(id: string): Promise<boolean> {
  if (serverUrl) {
    try {
      await http('DELETE', `/api/tasks/${id}`);
      return true;
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return false;
      throw e;
    }
  }
  return localDeleteTask(id);
}

export async function isTaskBlocked(id: string): Promise<boolean> {
  if (serverUrl) {
    try {
      const task = await http<TaskWithBlocked>('GET', `/api/tasks/${id}`);
      return task.blocked;
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return false;
      throw e;
    }
  }
  return localIsTaskBlocked(id);
}

// Comments
export async function addTaskComment(
  taskId: string,
  body: string,
  author: 'user' | 'mcp' = 'user'
): Promise<TaskComment | undefined> {
  if (serverUrl) {
    try {
      return await http('POST', `/api/tasks/${taskId}/comments`, { body, author });
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return undefined;
      throw e;
    }
  }
  return localAddTaskComment(taskId, body, author);
}

export async function deleteTaskComment(taskId: string, commentId: string): Promise<boolean> {
  if (serverUrl) {
    try {
      await http('DELETE', `/api/tasks/${taskId}/comments/${commentId}`);
      return true;
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return false;
      throw e;
    }
  }
  return localDeleteTaskComment(taskId, commentId);
}

// Ready tasks (unblocked, not done, sorted by priority)
export async function getReadyTasks(projectId?: string): Promise<Task[]> {
  if (serverUrl) {
    const query = projectId ? `?project_id=${projectId}` : '';
    return http('GET', `/api/tasks/ready${query}`);
  }
  return localGetReadyTasks(projectId);
}

// Export all data
export async function exportAll(): Promise<Store> {
  if (serverUrl) {
    return http('GET', '/api/export');
  }
  return localGetStore();
}

// Import data (replace or merge)
export async function importAll(data: Store, merge: boolean = false): Promise<void> {
  if (serverUrl) {
    await http('POST', '/api/import', { data, merge });
    return;
  }
  if (merge) {
    localMergeStore(data);
  } else {
    localReplaceStore(data);
  }
}

// Webhooks
export async function getWebhooks(): Promise<Webhook[]> {
  if (serverUrl) {
    return http('GET', '/api/webhooks');
  }
  return localGetWebhooks();
}

export async function getWebhook(id: string): Promise<Webhook | undefined> {
  if (serverUrl) {
    try {
      return await http('GET', `/api/webhooks/${id}`);
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return undefined;
      throw e;
    }
  }
  return localGetWebhook(id);
}

export async function createWebhook(
  name: string,
  url: string,
  events: WebhookEventType[],
  options?: { secret?: string; project_id?: string }
): Promise<Webhook> {
  if (serverUrl) {
    return http('POST', '/api/webhooks', { name, url, events, ...options });
  }
  return localCreateWebhook(name, url, events, options);
}

export async function updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook | undefined> {
  if (serverUrl) {
    try {
      return await http('PATCH', `/api/webhooks/${id}`, updates);
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return undefined;
      throw e;
    }
  }
  return localUpdateWebhook(id, updates);
}

export async function deleteWebhook(id: string): Promise<boolean> {
  if (serverUrl) {
    try {
      await http('DELETE', `/api/webhooks/${id}`);
      return true;
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return false;
      throw e;
    }
  }
  return localDeleteWebhook(id);
}

export async function getWebhookDeliveries(webhookId: string, limit?: number): Promise<WebhookDelivery[]> {
  if (serverUrl) {
    const query = limit ? `?limit=${limit}` : '';
    return http('GET', `/api/webhooks/${webhookId}/deliveries${query}`);
  }
  return localGetWebhookDeliveries(webhookId, limit);
}
