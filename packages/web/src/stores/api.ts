import type { Task, Epic, Project, Webhook, WebhookDelivery, WebhookEventType, TaskComment, CommentAuthor } from '@flux/shared';
import { ProjectSchema } from '../schemas';
import { z } from 'zod';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

// Project metadata computed by server
export interface ProjectMeta {
  aiStatus: 'Idle' | 'Running' | 'Blocked' | 'Failing';
  risk: 'Green' | 'Amber' | 'Red';
  primaryPhase: 'Shaping' | 'Betting' | 'Active' | 'Shipped';
  lanes: {
    shaping: number;
    betting: number;
    active: number;
    shipped: number;
  };
  activeBets: number;
  lastEvent: string;
  thrash: {
    cuts: number;
    retries: number;
  };
  blockers: {
    count: number;
    reason?: string;
  };
}

// Project with stats and computed metadata from API
export interface ProjectWithStats extends Project {
  stats: { total: number; done: number };
  meta: ProjectMeta;
}

// Task with blocked status from API
export interface TaskWithBlocked extends Task {
  blocked: boolean;
}

// ============ Project Operations ============

export async function getProjects(): Promise<ProjectWithStats[]> {
  const res = await fetch(`${API_BASE}/projects`);
  const data = await res.json() as unknown;

  // Validate with Zod schema (including meta field from API)
  const ProjectMetaSchema = z.object({
    aiStatus: z.enum(['Idle', 'Running', 'Blocked', 'Failing']),
    risk: z.enum(['Green', 'Amber', 'Red']),
    primaryPhase: z.enum(['Shaping', 'Betting', 'Active', 'Shipped']),
    lanes: z.object({
      shaping: z.number(),
      betting: z.number(),
      active: z.number(),
      shipped: z.number(),
    }),
    activeBets: z.number(),
    lastEvent: z.string(),
    thrash: z.object({
      cuts: z.number(),
      retries: z.number(),
    }),
    blockers: z.object({
      count: z.number(),
      reason: z.string().optional(),
    }),
  });

  const ProjectWithStatsSchema = ProjectSchema.extend({
    stats: z.object({ total: z.number(), done: z.number() }),
    meta: ProjectMetaSchema,
  });
  return z.array(ProjectWithStatsSchema).parse(data);
}

export async function getProject(id: string): Promise<ProjectWithStats | null> {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  if (!res.ok) return null;
  return res.json() as Promise<ProjectWithStats>;
}

export async function createProject(name: string, description?: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  return res.json() as Promise<Project>;
}

export async function updateProject(id: string, updates: Partial<Omit<Project, 'id'>>): Promise<Project | null> {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  return res.json() as Promise<Project>;
}

export async function deleteProject(id: string): Promise<void> {
  await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
}

// ============ Epic Operations ============

export async function getEpics(projectId: string): Promise<Epic[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/epics`);
  return res.json() as Promise<Epic[]>;
}

export async function getEpic(id: string): Promise<Epic | null> {
  const res = await fetch(`${API_BASE}/epics/${id}`);
  if (!res.ok) return null;
  return res.json() as Promise<Epic>;
}

export async function createEpic(projectId: string, title: string, notes?: string): Promise<Epic> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/epics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, notes }),
  });
  return res.json() as Promise<Epic>;
}

export async function updateEpic(id: string, updates: Partial<Omit<Epic, 'id'>>): Promise<Epic | null> {
  const res = await fetch(`${API_BASE}/epics/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  return res.json() as Promise<Epic>;
}

export async function deleteEpic(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/epics/${id}`, { method: 'DELETE' });
  return res.ok;
}

// ============ Task Operations ============

export async function getTasks(projectId: string): Promise<TaskWithBlocked[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`);
  return res.json() as Promise<TaskWithBlocked[]>;
}

export async function getTask(id: string): Promise<TaskWithBlocked | null> {
  const res = await fetch(`${API_BASE}/tasks/${id}`);
  if (!res.ok) return null;
  return res.json() as Promise<TaskWithBlocked>;
}

export async function createTask(
  projectId: string,
  title: string,
  epicId?: string
): Promise<Task> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, epic_id: epicId }),
  });
  return res.json() as Promise<Task>;
}

export async function updateTask(id: string, updates: Partial<Omit<Task, 'id'>>): Promise<TaskWithBlocked | null> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  return res.json() as Promise<TaskWithBlocked>;
}

export async function deleteTask(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function addTaskComment(
  id: string,
  body: string,
  author?: CommentAuthor
): Promise<TaskComment> {
  const res = await fetch(`${API_BASE}/tasks/${id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, author }),
  });
  return res.json() as Promise<TaskComment>;
}

export async function deleteTaskComment(id: string, commentId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/tasks/${id}/comments/${commentId}`, { method: 'DELETE' });
  return res.ok;
}

export async function cleanupProject(
  projectId: string,
  archiveTasks: boolean,
  archiveEpics: boolean
): Promise<{ success: boolean; archivedTasks: number; deletedEpics: number }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/cleanup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archiveTasks, archiveEpics }),
  });
  return res.json() as Promise<{ success: boolean; archivedTasks: number; deletedEpics: number }>;
}

export async function resetDatabase(): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/reset`, { method: 'POST' });
  return res.json() as Promise<{ success: boolean }>;
}

// ============ Webhook Operations ============

export async function getWebhooks(): Promise<Webhook[]> {
  const res = await fetch(`${API_BASE}/webhooks`);
  return res.json() as Promise<Webhook[]>;
}

export async function getWebhook(id: string): Promise<Webhook | null> {
  const res = await fetch(`${API_BASE}/webhooks/${id}`);
  if (!res.ok) return null;
  return res.json() as Promise<Webhook>;
}

export async function createWebhook(
  name: string,
  url: string,
  events: WebhookEventType[],
  options?: { secret?: string; project_id?: string; enabled?: boolean }
): Promise<Webhook> {
  const res = await fetch(`${API_BASE}/webhooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, url, events, ...options }),
  });
  return res.json() as Promise<Webhook>;
}

export async function updateWebhook(
  id: string,
  updates: Partial<Omit<Webhook, 'id' | 'created_at'>>
): Promise<Webhook | null> {
  const res = await fetch(`${API_BASE}/webhooks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  return res.json() as Promise<Webhook>;
}

export async function deleteWebhook(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/webhooks/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function testWebhook(id: string): Promise<{
  success: boolean;
  status_code?: number;
  response?: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/webhooks/${id}/test`, { method: 'POST' });
  return res.json() as Promise<{
    success: boolean;
    status_code?: number;
    response?: string;
    error?: string;
  }>;
}

export async function getWebhookDeliveries(webhookId: string, limit = 50): Promise<WebhookDelivery[]> {
  const res = await fetch(`${API_BASE}/webhooks/${webhookId}/deliveries?limit=${limit}`);
  return res.json() as Promise<WebhookDelivery[]>;
}
