/**
 * Flux client - abstracts local store vs HTTP server
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
  PRIORITY_CONFIG,
  PRIORITIES,
  type Project,
  type Epic,
  type Task,
  type TaskComment,
  type Priority,
} from '@flux/shared';

// Re-export constants
export { PRIORITY_CONFIG, PRIORITIES, type Priority };

// Client state
let serverUrl: string | null = null;

export function initClient(server?: string): void {
  serverUrl = server || null;
}

export function isServerMode(): boolean {
  return serverUrl !== null;
}

// HTTP helper
async function http<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${serverUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
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
    } catch {
      return undefined;
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
    } catch {
      return undefined;
    }
  }
  return localUpdateProject(id, updates);
}

export async function deleteProject(id: string): Promise<boolean> {
  if (serverUrl) {
    try {
      await http('DELETE', `/api/projects/${id}`);
      return true;
    } catch {
      return false;
    }
  }
  return localDeleteProject(id);
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
    } catch {
      return undefined;
    }
  }
  return localGetEpic(id);
}

export async function createEpic(projectId: string, title: string, notes?: string): Promise<Epic> {
  if (serverUrl) {
    return http('POST', `/api/projects/${projectId}/epics`, { title, notes });
  }
  return localCreateEpic(projectId, title, notes);
}

export async function updateEpic(id: string, updates: Partial<Epic>): Promise<Epic | undefined> {
  if (serverUrl) {
    try {
      return await http('PATCH', `/api/epics/${id}`, updates);
    } catch {
      return undefined;
    }
  }
  return localUpdateEpic(id, updates);
}

export async function deleteEpic(id: string): Promise<boolean> {
  if (serverUrl) {
    try {
      await http('DELETE', `/api/epics/${id}`);
      return true;
    } catch {
      return false;
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
    } catch {
      return undefined;
    }
  }
  return localGetTask(id);
}

export async function createTask(
  projectId: string,
  title: string,
  epicId?: string,
  options?: { priority?: Priority }
): Promise<Task> {
  if (serverUrl) {
    return http('POST', `/api/projects/${projectId}/tasks`, {
      title,
      epic_id: epicId,
      priority: options?.priority,
    });
  }
  return localCreateTask(projectId, title, epicId, options);
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
  if (serverUrl) {
    try {
      return await http('PATCH', `/api/tasks/${id}`, updates);
    } catch {
      return undefined;
    }
  }
  return localUpdateTask(id, updates);
}

export async function deleteTask(id: string): Promise<boolean> {
  if (serverUrl) {
    try {
      await http('DELETE', `/api/tasks/${id}`);
      return true;
    } catch {
      return false;
    }
  }
  return localDeleteTask(id);
}

export async function isTaskBlocked(id: string): Promise<boolean> {
  if (serverUrl) {
    // Server includes blocked status in task response
    const task = await getTask(id);
    return (task as any)?.blocked ?? false;
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
    } catch {
      return undefined;
    }
  }
  return localAddTaskComment(taskId, body, author);
}

export async function deleteTaskComment(taskId: string, commentId: string): Promise<boolean> {
  if (serverUrl) {
    try {
      await http('DELETE', `/api/tasks/${taskId}/comments/${commentId}`);
      return true;
    } catch {
      return false;
    }
  }
  return localDeleteTaskComment(taskId, commentId);
}

// Ready tasks (unblocked, not done, sorted by priority)
export async function getReadyTasks(projectId?: string): Promise<Task[]> {
  if (serverUrl) {
    // Fetch all projects' tasks and filter client-side
    const projects = await getProjects();
    const targetProjects = projectId
      ? projects.filter(p => p.id === projectId)
      : projects;

    const allTasks: Task[] = [];
    for (const p of targetProjects) {
      const tasks = await getTasks(p.id);
      allTasks.push(...tasks);
    }

    // Filter: not done, not archived, not blocked
    const ready = allTasks.filter(t =>
      t.status !== 'done' &&
      !t.archived &&
      !(t as any).blocked
    );

    // Sort by priority
    ready.sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));
    return ready;
  }
  return localGetReadyTasks(projectId);
}
