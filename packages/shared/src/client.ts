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
  createBlob as localCreateBlob,
  getBlob as localGetBlob,
  getBlobs as localGetBlobs,
  deleteBlob as localDeleteBlob,
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
  Blob,
  Webhook,
  WebhookDelivery,
  WebhookEventType,
  Guardrail,
  ApiKey,
  KeyScope,
} from './types.js';

// Re-export types and constants
export { PRIORITY_CONFIG, PRIORITIES };
export type { Project, Epic, Task, TaskComment, Priority, Store, Blob, Webhook, WebhookDelivery, WebhookEventType, Guardrail };

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

export async function createProject(name: string, description?: string, visibility?: 'public' | 'private'): Promise<Project> {
  if (serverUrl) {
    return http('POST', '/api/projects', { name, description, visibility });
  }
  return localCreateProject(name, description, visibility);
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

// ============ Blobs ============

export async function uploadBlob(
  content: Buffer,
  filename: string,
  mime_type: string,
  task_id?: string
): Promise<Blob> {
  if (serverUrl) {
    const formData = new FormData();
    formData.append('file', new File([content], filename, { type: mime_type }));
    if (task_id) formData.append('task_id', task_id);

    const url = `${serverUrl}/api/blobs`;
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(url, { method: 'POST', headers, body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new FluxHttpError(err.error || res.statusText, res.status, res.statusText);
    }
    return res.json();
  }
  // Local mode: use blob storage provider
  const { getBlobStorage } = await import('./blob-storage.js');
  const storage = getBlobStorage();
  if (!storage) throw new Error('Blob storage not initialized');
  const { hash, size } = storage.write(content);
  return localCreateBlob(hash, filename, mime_type, size, task_id);
}

export async function downloadBlob(id: string): Promise<{ blob: Blob; content: Buffer } | null> {
  if (serverUrl) {
    try {
      const blob = await http<Blob>('GET', `/api/blobs/${id}`);
      const url = `${serverUrl}/api/blobs/${id}/content`;
      const headers: Record<string, string> = {};
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      const content = Buffer.from(await res.arrayBuffer());
      return { blob, content };
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return null;
      throw e;
    }
  }
  const blobMeta = localGetBlob(id);
  if (!blobMeta) return null;
  const { getBlobStorage } = await import('./blob-storage.js');
  const storage = getBlobStorage();
  if (!storage) throw new Error('Blob storage not initialized');
  const content = storage.read(blobMeta.hash);
  if (!content) return null;
  return { blob: blobMeta, content };
}

export async function getBlobMetadata(id: string): Promise<Blob | undefined> {
  if (serverUrl) {
    try {
      return await http<Blob>('GET', `/api/blobs/${id}`);
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return undefined;
      throw e;
    }
  }
  return localGetBlob(id);
}

export async function getClientBlobs(filter?: { task_id?: string }): Promise<Blob[]> {
  if (serverUrl) {
    const query = filter?.task_id ? `?task_id=${filter.task_id}` : '';
    return http('GET', `/api/blobs${query}`);
  }
  return localGetBlobs(filter);
}

export async function deleteBlobClient(id: string): Promise<boolean> {
  if (serverUrl) {
    try {
      await http('DELETE', `/api/blobs/${id}`);
      return true;
    } catch (e) {
      if (e instanceof FluxHttpError && e.isNotFound) return false;
      throw e;
    }
  }
  // Local mode: remove from storage and metadata
  const blobMeta = localGetBlob(id);
  if (!blobMeta) return false;
  const { getBlobStorage } = await import('./blob-storage.js');
  const storage = getBlobStorage();
  if (storage) {
    // Only remove file if no other blob metadata references same hash
    const allBlobs = localGetBlobs();
    const otherRefs = allBlobs.filter(b => b.hash === blobMeta.hash && b.id !== id);
    if (otherRefs.length === 0) {
      storage.remove(blobMeta.hash);
    }
  }
  return localDeleteBlob(id);
}

// ============ Auth (server mode only) ============

export type ApiKeyInfo = Omit<ApiKey, 'hash'>;

export async function getAuthStatus(): Promise<{
  authenticated: boolean;
  keyType: 'server' | 'project' | 'env' | 'anonymous';
  projectIds?: string[];
}> {
  if (!serverUrl) {
    return { authenticated: true, keyType: 'env' };
  }
  return http('GET', '/api/auth/status');
}

export async function getApiKeys(): Promise<ApiKeyInfo[]> {
  if (!serverUrl) {
    throw new Error('API keys only available in server mode');
  }
  return http('GET', '/api/auth/keys');
}

export async function createApiKeyRemote(
  name: string,
  projectIds?: string[]
): Promise<{ key: string } & ApiKeyInfo> {
  if (!serverUrl) {
    throw new Error('API keys only available in server mode');
  }
  return http('POST', '/api/auth/keys', {
    name,
    project_ids: projectIds,
  });
}

export async function deleteApiKeyRemote(id: string): Promise<boolean> {
  if (!serverUrl) {
    throw new Error('API keys only available in server mode');
  }
  try {
    await http('DELETE', `/api/auth/keys/${id}`);
    return true;
  } catch (e) {
    if (e instanceof FluxHttpError && e.isNotFound) return false;
    throw e;
  }
}

// CLI auth flow
export async function initCliAuth(): Promise<{ token: string; expires_at: string }> {
  if (!serverUrl) {
    throw new Error('CLI auth only available in server mode');
  }
  return http('POST', '/api/auth/cli-init', {});
}

export async function pollCliAuth(token: string): Promise<{
  status: 'pending' | 'completed' | 'expired';
  apiKey?: string;
}> {
  if (!serverUrl) {
    throw new Error('CLI auth only available in server mode');
  }
  return http('POST', '/api/auth/cli-poll', { token });
}

export async function completeCliAuth(
  token: string,
  name: string,
  projectIds?: string[]
): Promise<{ success: boolean }> {
  if (!serverUrl) {
    throw new Error('CLI auth only available in server mode');
  }
  return http('POST', '/api/auth/cli-complete', {
    token,
    name,
    project_ids: projectIds,
  });
}
