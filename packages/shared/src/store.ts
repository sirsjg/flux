import type { Task, Epic, Project, Store, Webhook, WebhookDelivery, WebhookEventType, WebhookPayload, StoreWithWebhooks, Priority, CommentAuthor, TaskComment, Guardrail, ApiKey, KeyScope, CliAuthRequest, PRD, Requirement, Phase } from './types.js';

// Auth functions injected at runtime (server-side only, uses Node crypto)
type AuthFunctions = {
  generateKey: () => { key: string; prefix: string; hash: string };
  generateTempToken: () => string;
  validateKey: (key: string, storedHash: string) => boolean;
  encrypt: (value: string, password: string) => string;
  decrypt: (encrypted: string, password: string) => string | null;
};

let authFunctions: AuthFunctions | null = null;

export function setAuthFunctions(fns: AuthFunctions): void {
  authFunctions = fns;
}

function requireAuth(): AuthFunctions {
  if (!authFunctions) {
    throw new Error('Auth functions not initialized. Call setAuthFunctions first (server-side only).');
  }
  return authFunctions;
}

// Storage adapter interface - can be localStorage or file-based
export interface StorageAdapter {
  read(): void;
  write(): void;
  data: Store;
}

let db: StorageAdapter;

// Generate a short unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Ensure guardrails have IDs (for MCP/API input that may omit them)
function ensureGuardrailIds(guardrails?: Guardrail[]): Guardrail[] | undefined {
  if (!guardrails) return undefined;
  return guardrails.map(g => g.id ? g : { ...g, id: generateId() });
}

// Set the storage adapter (called once at app startup)
export function setStorageAdapter(adapter: StorageAdapter): void {
  db = adapter;
}

// Get current storage adapter
export function getStorageAdapter(): StorageAdapter {
  return db;
}

// Initialize the store
export function initStore(): Store {
  if (!db) throw new Error('Storage adapter not set. Call setStorageAdapter first.');
  db.read();

  // Migrate from old single-project structure if needed
  const data = db.data as any;
  let needsWrite = false;

  if (!Array.isArray(data.projects)) {
    data.projects = [];
    needsWrite = true;
    // Migrate old project if it exists
    if (data.project) {
      const oldProject = data.project;
      data.projects.push(oldProject);
      // Update tasks and epics with project_id
      if (Array.isArray(data.tasks)) {
        data.tasks.forEach((t: any) => { t.project_id = oldProject.id; });
      }
      if (Array.isArray(data.epics)) {
        data.epics.forEach((e: any) => { e.project_id = oldProject.id; });
      }
      delete data.project;
    }
  }

  // Ensure arrays exist
  if (!Array.isArray(data.tasks)) {
    data.tasks = [];
    needsWrite = true;
  }
  if (!Array.isArray(data.epics)) {
    data.epics = [];
    needsWrite = true;
  }

  // Migrate epics: ensure auto field exists
  data.epics.forEach((epic: any) => {
    if (epic.auto === undefined) {
      epic.auto = false;
      needsWrite = true;
    }
  });

  // Migrate tasks: convert legacy notes to comments
  data.tasks.forEach((t: any) => {
    // Handle array notes (very old format)
    if (Array.isArray(t.notes)) {
      t.notes = t.notes.join('\n\n');
      needsWrite = true;
    }
    // Convert string notes to a comment
    if (typeof t.notes === 'string' && t.notes.trim()) {
      if (!t.comments) t.comments = [];
      t.comments.unshift({
        id: generateId(),
        body: t.notes,
        author: 'user',
        created_at: t.created_at || new Date().toISOString(),
      });
      needsWrite = true;
    }
    // Remove notes field
    if ('notes' in t) {
      delete t.notes;
      needsWrite = true;
    }
  });

  if (needsWrite) db.write();

  return db.data;
}

export function resetStore(): void {
  if (!db) throw new Error('Storage adapter not set. Call setStorageAdapter first.');
  db.data.projects = [];
  db.data.epics = [];
  db.data.tasks = [];
  const data = db.data as StoreWithWebhooks;
  data.webhooks = [];
  data.webhook_deliveries = [];
  db.write();
}

export function getStore(): Store {
  if (!db) throw new Error('Storage adapter not set. Call setStorageAdapter first.');
  return {
    projects: [...(db.data.projects || [])],
    epics: [...(db.data.epics || [])],
    tasks: [...(db.data.tasks || [])],
  };
}

export function replaceStore(data: Store): void {
  if (!db) throw new Error('Storage adapter not set. Call setStorageAdapter first.');
  db.data.projects = data.projects || [];
  db.data.epics = data.epics || [];
  db.data.tasks = data.tasks || [];
  db.write();
}

export function mergeStore(data: Store): void {
  if (!db) throw new Error('Storage adapter not set. Call setStorageAdapter first.');
  // Merge by adding items that don't exist (by id)
  const existingProjectIds = new Set(db.data.projects.map(p => p.id));
  const existingEpicIds = new Set(db.data.epics.map(e => e.id));
  const existingTaskIds = new Set(db.data.tasks.map(t => t.id));

  for (const p of data.projects || []) {
    if (!existingProjectIds.has(p.id)) db.data.projects.push(p);
  }
  for (const e of data.epics || []) {
    if (!existingEpicIds.has(e.id)) db.data.epics.push(e);
  }
  for (const t of data.tasks || []) {
    if (!existingTaskIds.has(t.id)) db.data.tasks.push(t);
  }
  db.write();
}

// ============ Project Operations ============

export function getProjects(): Project[] {
  return [...(db.data.projects || [])];
}

export function getProject(id: string): Project | undefined {
  return (db.data.projects || []).find(p => p.id === id);
}

export function createProject(name: string, description?: string, visibility?: 'public' | 'private'): Project {
  const project: Project = {
    id: generateId(),
    name,
    description,
    visibility,
  };
  if (!db.data.projects) db.data.projects = [];
  db.data.projects.push(project);
  db.write();
  return project;
}

export function updateProject(id: string, updates: Partial<Omit<Project, 'id'>>): Project | undefined {
  const index = db.data.projects.findIndex(p => p.id === id);
  if (index === -1) return undefined;
  db.data.projects[index] = { ...db.data.projects[index], ...updates };
  db.write();
  return db.data.projects[index];
}

export function deleteProject(id: string): void {
  const index = db.data.projects.findIndex(p => p.id === id);
  if (index === -1) return;
  db.data.projects.splice(index, 1);
  // Remove all epics and tasks for this project
  db.data.epics = db.data.epics.filter(e => e.project_id !== id);
  db.data.tasks = db.data.tasks.filter(t => t.project_id !== id);
  db.write();
}

export function getProjectStats(projectId: string): { total: number; done: number } {
  const tasks = db.data.tasks.filter(t => t.project_id === projectId && !t.archived);
  return {
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
  };
}

// ============ Epic Operations ============

export function getEpics(projectId: string): Epic[] {
  return [...db.data.epics.filter(e => e.project_id === projectId)];
}

export function getAllEpics(): Epic[] {
  return [...db.data.epics];
}

export function getEpic(id: string): Epic | undefined {
  return db.data.epics.find(e => e.id === id);
}

export function createEpic(
  projectId: string,
  title: string,
  notes: string = '',
  auto: boolean = false
): Epic {
  const epic: Epic = {
    id: generateId(),
    title,
    status: 'planning',
    depends_on: [],
    notes,
    auto,
    project_id: projectId,
  };
  db.data.epics.push(epic);
  db.write();
  return epic;
}

export function updateEpic(id: string, updates: Partial<Omit<Epic, 'id'>>): Epic | undefined {
  const index = db.data.epics.findIndex(e => e.id === id);
  if (index === -1) return undefined;
  db.data.epics[index] = { ...db.data.epics[index], ...updates };
  db.write();
  return db.data.epics[index];
}

export function deleteEpic(id: string): boolean {
  const index = db.data.epics.findIndex(e => e.id === id);
  if (index === -1) return false;
  db.data.epics.splice(index, 1);
  // Remove epic_id from tasks that belonged to this epic
  db.data.tasks.forEach(task => {
    if (task.epic_id === id) {
      task.epic_id = undefined;
    }
  });
  db.write();
  return true;
}

// ============ PRD Operations ============

export function updateEpicPRD(epicId: string, prd: PRD): Epic | undefined {
  const index = db.data.epics.findIndex(e => e.id === epicId);
  if (index === -1) return undefined;
  db.data.epics[index].prd = {
    ...prd,
    updatedAt: new Date().toISOString(),
  };
  db.write();
  return db.data.epics[index];
}

export function getEpicPRD(epicId: string): PRD | undefined {
  const epic = db.data.epics.find(e => e.id === epicId);
  return epic?.prd;
}

export function deleteEpicPRD(epicId: string): boolean {
  const index = db.data.epics.findIndex(e => e.id === epicId);
  if (index === -1) return false;
  delete db.data.epics[index].prd;
  db.write();
  return true;
}

// Get task with full PRD context (for agents)
export type TaskWithContext = {
  task: Task;
  linkedRequirements: Requirement[];
  phase: Phase | undefined;
  epicPrd: PRD | undefined;
};

export function getTaskWithContext(taskId: string): TaskWithContext | undefined {
  const task = db.data.tasks.find(t => t.id === taskId);
  if (!task) return undefined;

  let linkedRequirements: Requirement[] = [];
  let phase: Phase | undefined;
  let epicPrd: PRD | undefined;

  if (task.epic_id) {
    const epic = db.data.epics.find(e => e.id === task.epic_id);
    if (epic?.prd) {
      epicPrd = epic.prd;
      // Get linked requirements
      if (task.requirement_ids?.length) {
        linkedRequirements = epic.prd.requirements.filter(r =>
          task.requirement_ids!.includes(r.id)
        );
      }
      // Get phase
      if (task.phase_id) {
        phase = epic.prd.phases.find(p => p.id === task.phase_id);
      }
    }
  }

  return { task, linkedRequirements, phase, epicPrd };
}

// PRD coverage: which requirements have tasks?
export type RequirementCoverage = {
  requirementId: string;
  requirement: Requirement;
  taskCount: number;
  tasks: { id: string; title: string; status: string }[];
  covered: boolean;
};

export function getPRDCoverage(epicId: string): RequirementCoverage[] {
  const epic = db.data.epics.find(e => e.id === epicId);
  if (!epic?.prd) return [];

  const tasksInEpic = db.data.tasks.filter(t => t.epic_id === epicId && !t.archived);

  return epic.prd.requirements.map(req => {
    const linkedTasks = tasksInEpic.filter(t =>
      t.requirement_ids?.includes(req.id)
    );
    return {
      requirementId: req.id,
      requirement: req,
      taskCount: linkedTasks.length,
      tasks: linkedTasks.map(t => ({ id: t.id, title: t.title, status: t.status })),
      covered: linkedTasks.length > 0,
    };
  });
}

// Link task to requirements
export function linkTaskToRequirements(taskId: string, requirementIds: string[]): Task | undefined {
  const index = db.data.tasks.findIndex(t => t.id === taskId);
  if (index === -1) return undefined;
  db.data.tasks[index].requirement_ids = requirementIds;
  db.data.tasks[index].updated_at = new Date().toISOString();
  db.write();
  return db.data.tasks[index];
}

// Link task to phase
export function linkTaskToPhase(taskId: string, phaseId: string | undefined): Task | undefined {
  const index = db.data.tasks.findIndex(t => t.id === taskId);
  if (index === -1) return undefined;
  db.data.tasks[index].phase_id = phaseId;
  db.data.tasks[index].updated_at = new Date().toISOString();
  db.write();
  return db.data.tasks[index];
}

// Get epic context for PRD generation (brownfield: tasks → PRD)
export type EpicForPRDGeneration = {
  epic: { id: string; title: string; notes: string };
  tasks: {
    id: string;
    title: string;
    status: string;
    acceptance_criteria?: string[];
    guardrails?: Guardrail[];
    depends_on: string[];
  }[];
};

export function getEpicForPRDGeneration(epicId: string): EpicForPRDGeneration | undefined {
  const epic = db.data.epics.find(e => e.id === epicId);
  if (!epic) return undefined;

  const tasks = db.data.tasks
    .filter(t => t.epic_id === epicId && !t.archived)
    .map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      acceptance_criteria: t.acceptance_criteria,
      guardrails: t.guardrails,
      depends_on: t.depends_on,
    }));

  return {
    epic: { id: epic.id, title: epic.title, notes: epic.notes },
    tasks,
  };
}

// ============ Task Operations ============

export function getTasks(projectId: string): Task[] {
  return [...db.data.tasks.filter(t => t.project_id === projectId && !t.archived)];
}

export function getAllTasks(): Task[] {
  return [...db.data.tasks];
}

export function getTask(id: string): Task | undefined {
  return db.data.tasks.find(t => t.id === id);
}

export function getTasksByEpic(projectId: string, epicId: string | undefined): Task[] {
  return db.data.tasks.filter(t => t.project_id === projectId && t.epic_id === epicId);
}

export function getTasksByStatus(projectId: string, status: string): Task[] {
  return db.data.tasks.filter(t => t.project_id === projectId && t.status === status);
}

export function createTask(
  projectId: string,
  title: string,
  epicId?: string,
  options?: { priority?: Priority; depends_on?: string[]; acceptance_criteria?: string[]; guardrails?: Guardrail[] }
): Task {
  const now = new Date().toISOString();
  const id = generateId();
  // Validate dependencies exist (can't have cycles for new task, but deps should exist)
  const depends_on = options?.depends_on ?? [];
  for (const depId of depends_on) {
    if (!db.data.tasks.find(t => t.id === depId)) {
      throw new Error(`Dependency not found: ${depId}`);
    }
  }
  const task: Task = {
    id,
    title,
    status: 'planning',
    depends_on,
    comments: [],
    epic_id: epicId,
    project_id: projectId,
    priority: options?.priority,
    acceptance_criteria: options?.acceptance_criteria,
    guardrails: ensureGuardrailIds(options?.guardrails),
    created_at: now,
    updated_at: now,
  };
  db.data.tasks.push(task);
  db.write();
  return task;
}

export function updateTask(id: string, updates: Partial<Omit<Task, 'id'>>): Task | undefined {
  const index = db.data.tasks.findIndex(t => t.id === id);
  if (index === -1) return undefined;
  // Validate dependencies
  if (updates.depends_on) {
    for (const depId of updates.depends_on) {
      if (!db.data.tasks.find(t => t.id === depId)) {
        throw new Error(`Dependency not found: ${depId}`);
      }
    }
    if (wouldCreateCycle(id, updates.depends_on)) {
      throw new Error('Circular dependency detected');
    }
  }
  const processedUpdates = {
    ...updates,
    guardrails: updates.guardrails !== undefined ? ensureGuardrailIds(updates.guardrails) : undefined,
  };
  db.data.tasks[index] = {
    ...db.data.tasks[index],
    ...processedUpdates,
    updated_at: new Date().toISOString(),
  };
  db.write();
  return db.data.tasks[index];
}

export function deleteTask(id: string): boolean {
  const index = db.data.tasks.findIndex(t => t.id === id);
  if (index === -1) return false;
  db.data.tasks.splice(index, 1);
  // Remove this task from any depends_on arrays
  db.data.tasks.forEach(task => {
    const depIndex = task.depends_on.indexOf(id);
    if (depIndex !== -1) {
      task.depends_on.splice(depIndex, 1);
    }
  });
  db.write();
  return true;
}

// ============ Verification Operations ============

export function setTaskVerify(taskId: string, command: string | undefined): Task | undefined {
  const index = db.data.tasks.findIndex(t => t.id === taskId);
  if (index === -1) return undefined;
  db.data.tasks[index].verify = command;
  db.data.tasks[index].updated_at = new Date().toISOString();
  db.write();
  return db.data.tasks[index];
}

export function setTaskVerifyResult(
  taskId: string,
  passed: boolean,
  output: string
): Task | undefined {
  const index = db.data.tasks.findIndex(t => t.id === taskId);
  if (index === -1) return undefined;
  db.data.tasks[index].verifyResult = {
    passed,
    output,
    checkedAt: new Date().toISOString(),
  };
  db.data.tasks[index].updated_at = new Date().toISOString();
  db.write();
  return db.data.tasks[index];
}

// ============ Comment Operations ============

export function addTaskComment(
  taskId: string,
  body: string,
  author: CommentAuthor
): TaskComment | undefined {
  const task = db.data.tasks.find(t => t.id === taskId);
  if (!task) return undefined;
  const comment: TaskComment = {
    id: generateId(),
    body,
    author,
    created_at: new Date().toISOString(),
  };
  if (!task.comments) task.comments = [];
  task.comments.push(comment);
  db.write();
  return comment;
}

export function deleteTaskComment(taskId: string, commentId: string): boolean {
  const task = db.data.tasks.find(t => t.id === taskId);
  if (!task?.comments) return false;
  const index = task.comments.findIndex(comment => comment.id === commentId);
  if (index === -1) return false;
  task.comments.splice(index, 1);
  db.write();
  return true;
}

// ============ Dependency Operations ============

// Check if adding dependencies would create a cycle
export function wouldCreateCycle(taskId: string, newDeps: string[]): boolean {
  const visited = new Set<string>();
  const checkCycle = (id: string): boolean => {
    if (id === taskId) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const task = db.data.tasks.find(t => t.id === id);
    if (!task) return false;
    return task.depends_on.some(depId => checkCycle(depId));
  };
  return newDeps.some(depId => checkCycle(depId));
}

export function addDependency(taskId: string, dependsOnId: string): boolean {
  const task = db.data.tasks.find(t => t.id === taskId);
  if (!task) return false;
  if (!db.data.tasks.find(t => t.id === dependsOnId)) return false;
  if (task.depends_on.includes(dependsOnId)) return true;
  if (wouldCreateCycle(taskId, [dependsOnId])) return false;
  task.depends_on.push(dependsOnId);
  db.write();
  return true;
}

export function removeDependency(taskId: string, dependsOnId: string): boolean {
  const task = db.data.tasks.find(t => t.id === taskId);
  if (!task) return false;
  const index = task.depends_on.indexOf(dependsOnId);
  if (index === -1) return false;
  task.depends_on.splice(index, 1);
  db.write();
  return true;
}

export function isTaskBlocked(taskId: string): boolean {
  const task = db.data.tasks.find(t => t.id === taskId);
  if (!task) return false;
  // External blocker takes precedence
  if (task.blocked_reason) return true;
  // Dependency-based blocking
  if (task.depends_on.length === 0) return false;
  return task.depends_on.some(depId => {
    const dep = db.data.tasks.find(t => t.id === depId);
    return dep && dep.status !== 'done';
  });
}

// Get ready tasks: unblocked, not done, not archived, sorted by priority
export function getReadyTasks(projectId?: string): Task[] {
  let tasks = db.data.tasks.filter(t => !t.archived && t.status !== 'done');
  if (projectId) {
    tasks = tasks.filter(t => t.project_id === projectId);
  }
  // Filter out blocked tasks
  tasks = tasks.filter(t => !isTaskBlocked(t.id));
  // Sort by priority (P0 first, then P1, then P2, then undefined)
  tasks.sort((a, b) => {
    const pa = a.priority ?? 2;
    const pb = b.priority ?? 2;
    return pa - pb;
  });
  return tasks;
}

// ============ Archive Operations ============

export function archiveDoneTasks(projectId: string): number {
  let count = 0;
  db.data.tasks.forEach(task => {
    if (task.project_id === projectId && task.status === 'done' && !task.archived) {
      task.archived = true;
      count++;
    }
  });
  if (count > 0) {
    db.write();
  }
  return count;
}

export function archiveEmptyEpics(projectId: string): number {
  let count = 0;
  const epicIdsToDelete: string[] = [];

  db.data.epics.forEach(epic => {
    if (epic.project_id === projectId) {
      // Check if epic has any non-archived tasks
      const hasActiveTasks = db.data.tasks.some(
        task => task.epic_id === epic.id && !task.archived
      );
      if (!hasActiveTasks) {
        epicIdsToDelete.push(epic.id);
        count++;
      }
    }
  });

  if (epicIdsToDelete.length > 0) {
    db.data.epics = db.data.epics.filter(e => !epicIdsToDelete.includes(e.id));
    db.write();
  }

  return count;
}

export function cleanupProject(projectId: string, archiveTasks: boolean, archiveEpics: boolean): { archivedTasks: number; deletedEpics: number } {
  let archivedTasks = 0;
  let deletedEpics = 0;

  if (archiveTasks) {
    archivedTasks = archiveDoneTasks(projectId);
  }

  if (archiveEpics) {
    deletedEpics = archiveEmptyEpics(projectId);
  }

  return { archivedTasks, deletedEpics };
}

// ============ Webhook Operations ============

// Get typed data accessor
function getWebhookData(): StoreWithWebhooks {
  return db.data as StoreWithWebhooks;
}

// Ensure webhooks arrays exist
function ensureWebhooksArrays(): void {
  const data = getWebhookData();
  if (!data.webhooks) data.webhooks = [];
  if (!data.webhook_deliveries) data.webhook_deliveries = [];
}

export function getWebhooks(): Webhook[] {
  ensureWebhooksArrays();
  return [...(getWebhookData().webhooks || [])];
}

export function getWebhook(id: string): Webhook | undefined {
  ensureWebhooksArrays();
  return getWebhookData().webhooks?.find(w => w.id === id);
}

export function getWebhooksByProject(projectId: string): Webhook[] {
  ensureWebhooksArrays();
  return (getWebhookData().webhooks || []).filter(
    w => !w.project_id || w.project_id === projectId
  );
}

export function createWebhook(
  name: string,
  url: string,
  events: WebhookEventType[],
  options?: { secret?: string; project_id?: string; enabled?: boolean }
): Webhook {
  ensureWebhooksArrays();
  const now = new Date().toISOString();
  const webhook: Webhook = {
    id: generateId(),
    name,
    url,
    events,
    enabled: options?.enabled ?? true,
    secret: options?.secret,
    project_id: options?.project_id,
    created_at: now,
    updated_at: now,
  };
  getWebhookData().webhooks!.push(webhook);
  db.write();
  return webhook;
}

export function updateWebhook(
  id: string,
  updates: Partial<Omit<Webhook, 'id' | 'created_at'>>
): Webhook | undefined {
  ensureWebhooksArrays();
  const webhooks = getWebhookData().webhooks!;
  const index = webhooks.findIndex(w => w.id === id);
  if (index === -1) return undefined;
  webhooks[index] = {
    ...webhooks[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  db.write();
  return webhooks[index];
}

export function deleteWebhook(id: string): boolean {
  ensureWebhooksArrays();
  const data = getWebhookData();
  const index = data.webhooks!.findIndex(w => w.id === id);
  if (index === -1) return false;
  data.webhooks!.splice(index, 1);
  // Also remove any delivery records for this webhook
  data.webhook_deliveries = data.webhook_deliveries!.filter(d => d.webhook_id !== id);
  db.write();
  return true;
}

export function testWebhook(id: string): Webhook | undefined {
  return getWebhook(id);
}

// ============ Webhook Delivery Operations ============

export function getWebhookDeliveries(webhookId?: string, limit: number = 50): WebhookDelivery[] {
  ensureWebhooksArrays();
  let deliveries = [...(getWebhookData().webhook_deliveries || [])];
  if (webhookId) {
    deliveries = deliveries.filter(d => d.webhook_id === webhookId);
  }
  // Sort by created_at descending (most recent first)
  deliveries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return deliveries.slice(0, limit);
}

export function createWebhookDelivery(
  webhookId: string,
  event: WebhookEventType,
  payload: WebhookPayload
): WebhookDelivery {
  ensureWebhooksArrays();
  const delivery: WebhookDelivery = {
    id: generateId(),
    webhook_id: webhookId,
    event,
    payload,
    status: 'pending',
    attempts: 0,
    created_at: new Date().toISOString(),
  };
  getWebhookData().webhook_deliveries!.push(delivery);
  db.write();
  return delivery;
}

export function updateWebhookDelivery(
  id: string,
  updates: Partial<Omit<WebhookDelivery, 'id' | 'webhook_id' | 'event' | 'payload' | 'created_at'>>
): WebhookDelivery | undefined {
  ensureWebhooksArrays();
  const deliveries = getWebhookData().webhook_deliveries!;
  const index = deliveries.findIndex(d => d.id === id);
  if (index === -1) return undefined;
  deliveries[index] = { ...deliveries[index], ...updates };
  db.write();
  return deliveries[index];
}

export function cleanupOldDeliveries(maxAge: number = 7 * 24 * 60 * 60 * 1000): number {
  ensureWebhooksArrays();
  const data = getWebhookData();
  const cutoff = new Date(Date.now() - maxAge).toISOString();
  const originalCount = data.webhook_deliveries!.length;
  data.webhook_deliveries = data.webhook_deliveries!.filter(d => d.created_at > cutoff);
  const removed = originalCount - data.webhook_deliveries.length;
  if (removed > 0) {
    db.write();
  }
  return removed;
}

// ============ Webhook Triggering ============

// Webhook event handler type
export type WebhookEventHandler = (
  event: WebhookEventType,
  payload: WebhookPayload,
  webhook: Webhook
) => Promise<void>;

// Global webhook event handler (set by server)
let webhookEventHandler: WebhookEventHandler | null = null;

export function setWebhookEventHandler(handler: WebhookEventHandler | null): void {
  webhookEventHandler = handler;
}

export function getWebhookEventHandler(): WebhookEventHandler | null {
  return webhookEventHandler;
}

// Trigger webhooks for an event
export async function triggerWebhooks(
  event: WebhookEventType,
  data: WebhookPayload['data'],
  projectId?: string
): Promise<void> {
  if (!webhookEventHandler) return;

  ensureWebhooksArrays();
  const webhooks = getWebhookData().webhooks || [];

  // Find matching webhooks
  const matchingWebhooks = webhooks.filter(w => {
    if (!w.enabled) return false;
    if (!w.events.includes(event)) return false;
    if (w.project_id && projectId && w.project_id !== projectId) return false;
    return true;
  });

  // Trigger each webhook
  for (const webhook of matchingWebhooks) {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      webhook_id: webhook.id,
      data,
    };

    try {
      await webhookEventHandler(event, payload, webhook);
    } catch (error) {
      console.error(`Failed to trigger webhook ${webhook.id}:`, error);
    }
  }
}

// ============ API Key Operations ============

function ensureApiKeysArrays(): void {
  const data = getWebhookData();
  if (!data.api_keys) data.api_keys = [];
  if (!data.cli_auth_requests) data.cli_auth_requests = [];
}

export function getApiKeys(): ApiKey[] {
  ensureApiKeysArrays();
  return [...(getWebhookData().api_keys || [])];
}

export function getApiKey(id: string): ApiKey | undefined {
  ensureApiKeysArrays();
  return getWebhookData().api_keys?.find(k => k.id === id);
}

/**
 * Create a new API key
 * Returns the raw key (shown once to user) and the stored key record
 */
export function createApiKey(
  name: string,
  scope: KeyScope
): { rawKey: string; apiKey: ApiKey } {
  ensureApiKeysArrays();
  const { key, prefix, hash } = requireAuth().generateKey();
  const apiKey: ApiKey = {
    id: generateId(),
    prefix,
    hash,
    name,
    scope,
    created_at: new Date().toISOString(),
  };
  getWebhookData().api_keys!.push(apiKey);
  db.write();
  return { rawKey: key, apiKey };
}

export function deleteApiKey(id: string): boolean {
  ensureApiKeysArrays();
  const data = getWebhookData();
  const index = data.api_keys!.findIndex(k => k.id === id);
  if (index === -1) return false;
  data.api_keys!.splice(index, 1);
  db.write();
  return true;
}

const LAST_USED_UPDATE_INTERVAL_MS = 60000; // Update last_used_at at most once per minute

/**
 * Validate an API key and return the key record if valid
 * Also updates last_used_at timestamp (throttled to once per minute)
 */
export function validateApiKey(rawKey: string): ApiKey | undefined {
  ensureApiKeysArrays();
  const { validateKey } = requireAuth();
  const keys = getWebhookData().api_keys || [];
  for (const key of keys) {
    if (validateKey(rawKey, key.hash)) {
      // Throttle last_used_at updates to reduce disk I/O
      const now = Date.now();
      const lastUsed = key.last_used_at ? new Date(key.last_used_at).getTime() : 0;
      if (now - lastUsed > LAST_USED_UPDATE_INTERVAL_MS) {
        key.last_used_at = new Date().toISOString();
        db.write();
      }
      return key;
    }
  }
  return undefined;
}

/**
 * Check if any API keys are configured
 */
export function hasApiKeys(): boolean {
  ensureApiKeysArrays();
  return (getWebhookData().api_keys?.length || 0) > 0;
}

// ============ CLI Auth Request Operations ============

const CLI_AUTH_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function createCliAuthRequest(): CliAuthRequest {
  ensureApiKeysArrays();
  const request: CliAuthRequest = {
    token: requireAuth().generateTempToken(),
    expires_at: new Date(Date.now() + CLI_AUTH_EXPIRY_MS).toISOString(),
  };
  getWebhookData().cli_auth_requests!.push(request);
  db.write();
  return request;
}

export function getCliAuthRequest(token: string): CliAuthRequest | undefined {
  ensureApiKeysArrays();
  const requests = getWebhookData().cli_auth_requests || [];
  return requests.find(r => r.token === token);
}

export function completeCliAuthRequest(
  token: string,
  name: string,
  scope: KeyScope
): { rawKey: string; apiKey: ApiKey } | undefined {
  ensureApiKeysArrays();
  const data = getWebhookData();
  const request = data.cli_auth_requests?.find(r => r.token === token);
  if (!request) return undefined;
  if (new Date(request.expires_at) < new Date()) return undefined;
  if (request.completed_at) return undefined;

  const { rawKey, apiKey } = createApiKey(name, scope);
  request.name = name;
  request.scope = scope;
  // Encrypt the key with the temp token so it's not stored in plaintext
  request.api_key = requireAuth().encrypt(rawKey, token);
  request.completed_at = new Date().toISOString();
  db.write();
  return { rawKey, apiKey };
}

export function pollCliAuthRequest(token: string): { status: 'pending' | 'completed' | 'expired'; apiKey?: string } {
  ensureApiKeysArrays();
  const request = getCliAuthRequest(token);
  if (!request) return { status: 'expired' };
  if (new Date(request.expires_at) < new Date()) return { status: 'expired' };
  if (request.completed_at && request.api_key) {
    // Decrypt the key using the temp token
    const apiKey = requireAuth().decrypt(request.api_key, token);
    if (!apiKey) return { status: 'expired' }; // Decrypt failed
    return { status: 'completed', apiKey };
  }
  return { status: 'pending' };
}

export function cleanupExpiredAuthRequests(): number {
  ensureApiKeysArrays();
  const data = getWebhookData();
  const now = new Date();
  const cutoff = new Date(now.getTime() - CLI_AUTH_EXPIRY_MS * 2); // Keep completed for 2x expiry
  const original = data.cli_auth_requests?.length || 0;
  data.cli_auth_requests = data.cli_auth_requests?.filter(r => {
    if (r.completed_at) {
      return new Date(r.completed_at) > cutoff;
    }
    return new Date(r.expires_at) > now;
  });
  const removed = original - (data.cli_auth_requests?.length || 0);
  if (removed > 0) db.write();
  return removed;
}
