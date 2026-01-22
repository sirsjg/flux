import type {
  Task, Epic, Project, Webhook, WebhookDelivery, WebhookEventType, TaskComment, CommentAuthor, KeyScope,
  PRD, Requirement, Phase, VerifyResult
} from '@flux/shared';
import { getToken } from './auth';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

// Create fetch wrapper with auth headers
function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}

// Project with stats from API
export interface ProjectWithStats extends Project {
  stats: { total: number; done: number };
}

// Task with blocked status from API
export interface TaskWithBlocked extends Task {
  blocked: boolean;
}

// ============ Project Operations ============

export async function getProjects(): Promise<ProjectWithStats[]> {
  const res = await authFetch(`${API_BASE}/projects`);
  return res.json();
}

export async function getProject(id: string): Promise<ProjectWithStats | null> {
  const res = await authFetch(`${API_BASE}/projects/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createProject(name: string, description?: string): Promise<Project> {
  const res = await authFetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  return res.json();
}

export async function updateProject(id: string, updates: Partial<Omit<Project, 'id'>>): Promise<Project | null> {
  const res = await authFetch(`${API_BASE}/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
}

// ============ Epic Operations ============

export async function getEpics(projectId: string): Promise<Epic[]> {
  const res = await authFetch(`${API_BASE}/projects/${projectId}/epics`);
  return res.json();
}

export async function getEpic(id: string): Promise<Epic | null> {
  const res = await authFetch(`${API_BASE}/epics/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createEpic(projectId: string, title: string, notes?: string): Promise<Epic> {
  const res = await authFetch(`${API_BASE}/projects/${projectId}/epics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, notes }),
  });
  return res.json();
}

export async function updateEpic(id: string, updates: Partial<Omit<Epic, 'id'>>): Promise<Epic | null> {
  const res = await authFetch(`${API_BASE}/epics/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteEpic(id: string): Promise<boolean> {
  const res = await authFetch(`${API_BASE}/epics/${id}`, { method: 'DELETE' });
  return res.ok;
}

// ============ Task Operations ============

export async function getTasks(projectId: string): Promise<TaskWithBlocked[]> {
  const res = await authFetch(`${API_BASE}/projects/${projectId}/tasks`);
  return res.json();
}

export async function getTask(id: string): Promise<TaskWithBlocked | null> {
  const res = await authFetch(`${API_BASE}/tasks/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createTask(
  projectId: string,
  title: string,
  epicId?: string
): Promise<Task> {
  const res = await authFetch(`${API_BASE}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, epic_id: epicId }),
  });
  return res.json();
}

export async function updateTask(id: string, updates: Partial<Omit<Task, 'id'>>): Promise<TaskWithBlocked | null> {
  const res = await authFetch(`${API_BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteTask(id: string): Promise<boolean> {
  const res = await authFetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function addTaskComment(
  id: string,
  body: string,
  author?: CommentAuthor
): Promise<TaskComment> {
  const res = await authFetch(`${API_BASE}/tasks/${id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, author }),
  });
  return res.json();
}

export async function deleteTaskComment(id: string, commentId: string): Promise<boolean> {
  const res = await authFetch(`${API_BASE}/tasks/${id}/comments/${commentId}`, { method: 'DELETE' });
  return res.ok;
}

export async function cleanupProject(
  projectId: string,
  archiveTasks: boolean,
  archiveEpics: boolean
): Promise<{ success: boolean; archivedTasks: number; deletedEpics: number }> {
  const res = await authFetch(`${API_BASE}/projects/${projectId}/cleanup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archiveTasks, archiveEpics }),
  });
  return res.json();
}

export async function resetDatabase(): Promise<{ success: boolean }> {
  const res = await authFetch(`${API_BASE}/reset`, { method: 'POST' });
  return res.json();
}

// ============ Webhook Operations ============

export async function getWebhooks(): Promise<Webhook[]> {
  const res = await authFetch(`${API_BASE}/webhooks`);
  return res.json();
}

export async function getWebhook(id: string): Promise<Webhook | null> {
  const res = await authFetch(`${API_BASE}/webhooks/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createWebhook(
  name: string,
  url: string,
  events: WebhookEventType[],
  options?: { secret?: string; project_id?: string; enabled?: boolean }
): Promise<Webhook> {
  const res = await authFetch(`${API_BASE}/webhooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, url, events, ...options }),
  });
  return res.json();
}

export async function updateWebhook(
  id: string,
  updates: Partial<Omit<Webhook, 'id' | 'created_at'>>
): Promise<Webhook | null> {
  const res = await authFetch(`${API_BASE}/webhooks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteWebhook(id: string): Promise<boolean> {
  const res = await authFetch(`${API_BASE}/webhooks/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function testWebhook(id: string): Promise<{
  success: boolean;
  status_code?: number;
  response?: string;
  error?: string;
}> {
  const res = await authFetch(`${API_BASE}/webhooks/${id}/test`, { method: 'POST' });
  return res.json();
}

export async function getWebhookDeliveries(webhookId: string, limit: number = 50): Promise<WebhookDelivery[]> {
  const res = await authFetch(`${API_BASE}/webhooks/${webhookId}/deliveries?limit=${limit}`);
  return res.json();
}

// ============ Auth Operations ============

export interface AuthStatus {
  authenticated: boolean;
  keyType: 'server' | 'project' | 'env' | 'anonymous';
  projectIds?: string[];
}

export interface ApiKeyInfo {
  id: string;
  prefix: string;
  name: string;
  scope: KeyScope;
  created_at: string;
  last_used_at?: string;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const res = await authFetch(`${API_BASE}/auth/status`);
  return res.json();
}

export async function getApiKeys(): Promise<ApiKeyInfo[]> {
  const res = await authFetch(`${API_BASE}/auth/keys`);
  if (!res.ok) return [];
  return res.json();
}

export async function createApiKey(
  name: string,
  projectIds?: string[]
): Promise<{ key: string } & ApiKeyInfo> {
  const res = await authFetch(`${API_BASE}/auth/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, project_ids: projectIds }),
  });
  return res.json();
}

export async function deleteApiKey(id: string): Promise<boolean> {
  const res = await authFetch(`${API_BASE}/auth/keys/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function completeCliAuth(
  token: string,
  name: string,
  projectIds?: string[]
): Promise<{ success: boolean }> {
  const res = await authFetch(`${API_BASE}/auth/cli-complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, name, project_ids: projectIds }),
  });
  return res.json();
}

// ============ PRD Operations ============

export interface TaskContext {
  task: TaskWithBlocked;
  linkedRequirements: Requirement[];
  phase: Phase | null;
  epicPrd: PRD | null;
}

export interface RequirementCoverage {
  requirement: Requirement;
  taskIds: string[];
}

export async function getEpicPRD(epicId: string): Promise<PRD | null> {
  const res = await authFetch(`${API_BASE}/epics/${epicId}/prd`);
  if (!res.ok) return null;
  return res.json();
}

export async function updateEpicPRD(epicId: string, prd: Partial<PRD>): Promise<Epic | null> {
  const res = await authFetch(`${API_BASE}/epics/${epicId}/prd`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prd),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteEpicPRD(epicId: string): Promise<boolean> {
  const res = await authFetch(`${API_BASE}/epics/${epicId}/prd`, { method: 'DELETE' });
  return res.ok;
}

export async function getTaskContext(taskId: string): Promise<TaskContext | null> {
  const res = await authFetch(`${API_BASE}/tasks/${taskId}/context`);
  if (!res.ok) return null;
  return res.json();
}

export async function linkTaskToRequirements(taskId: string, requirementIds: string[]): Promise<TaskWithBlocked | null> {
  const res = await authFetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requirement_ids: requirementIds }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function linkTaskToPhase(taskId: string, phaseId: string | null): Promise<TaskWithBlocked | null> {
  const res = await authFetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase_id: phaseId }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getPRDCoverage(epicId: string): Promise<RequirementCoverage[]> {
  const res = await authFetch(`${API_BASE}/epics/${epicId}/prd/coverage`);
  if (!res.ok) return [];
  return res.json();
}

// ============ Verification Operations ============

export async function setTaskVerify(taskId: string, command: string | null): Promise<TaskWithBlocked | null> {
  const res = await authFetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verify: command }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function runTaskVerify(taskId: string): Promise<VerifyResult> {
  const res = await authFetch(`${API_BASE}/tasks/${taskId}/verify`, { method: 'POST' });
  return res.json();
}
