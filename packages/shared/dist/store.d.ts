import type { Task, Epic, Project, Store, Blob, Webhook, WebhookDelivery, WebhookEventType, WebhookPayload, Priority, CommentAuthor, TaskComment, Guardrail, ApiKey, KeyScope, CliAuthRequest } from './types.js';
type AuthFunctions = {
    generateKey: () => {
        key: string;
        prefix: string;
        hash: string;
    };
    generateTempToken: () => string;
    validateKey: (key: string, storedHash: string) => boolean;
    encrypt: (value: string, password: string) => string;
    decrypt: (encrypted: string, password: string) => string | null;
};
export declare function setAuthFunctions(fns: AuthFunctions): void;
export interface StorageAdapter {
    read(): void;
    write(): void;
    data: Store;
}
export declare function setStorageAdapter(adapter: StorageAdapter): void;
export declare function getStorageAdapter(): StorageAdapter;
export declare function initStore(): Store;
export declare function resetStore(): void;
export declare function getStore(): Store;
/**
 * Insert a task directly, preserving its existing ID.
 * Used by sync to replicate entities from remote nodes.
 * Throws if a task with the same ID already exists.
 */
export declare function insertTask(task: Task): void;
/**
 * Insert an epic directly, preserving its existing ID.
 * Used by sync to replicate entities from remote nodes.
 * Throws if an epic with the same ID already exists.
 */
export declare function insertEpic(epic: Epic): void;
/**
 * Insert a project directly, preserving its existing ID.
 * Used by sync to replicate entities from remote nodes.
 * Throws if a project with the same ID already exists.
 */
export declare function insertProject(project: Project): void;
export declare function replaceStore(data: Store): void;
export declare function mergeStore(data: Store): void;
export declare function getProjects(): Project[];
export declare function getProject(id: string): Project | undefined;
export declare function createProject(name: string, description?: string, visibility?: 'public' | 'private'): Project;
export declare function updateProject(id: string, updates: Partial<Omit<Project, 'id'>>): Project | undefined;
export declare function deleteProject(id: string): void;
export declare function getProjectStats(projectId: string): {
    total: number;
    done: number;
};
export declare function getEpics(projectId: string): Epic[];
export declare function getAllEpics(): Epic[];
export declare function getEpic(id: string): Epic | undefined;
export declare function createEpic(projectId: string, title: string, notes?: string, auto?: boolean): Epic;
export declare function updateEpic(id: string, updates: Partial<Omit<Epic, 'id'>>): Epic | undefined;
export declare function deleteEpic(id: string): boolean;
export declare function getTasks(projectId: string): Task[];
export declare function getAllTasks(): Task[];
export declare function getTask(id: string): Task | undefined;
export declare function getTasksByEpic(projectId: string, epicId: string | undefined): Task[];
export declare function getTasksByStatus(projectId: string, status: string): Task[];
export declare function createTask(projectId: string, title: string, epicId?: string, options?: {
    priority?: Priority;
    depends_on?: string[];
    acceptance_criteria?: string[];
    guardrails?: Guardrail[];
}): Task;
export declare function updateTask(id: string, updates: Partial<Omit<Task, 'id'>>): Task | undefined;
export declare function deleteTask(id: string): boolean;
export declare function addTaskComment(taskId: string, body: string, author: CommentAuthor, agentName?: string): TaskComment | undefined;
export declare function deleteTaskComment(taskId: string, commentId: string): boolean;
export declare function wouldCreateCycle(taskId: string, newDeps: string[]): boolean;
export declare function addDependency(taskId: string, dependsOnId: string): boolean;
export declare function removeDependency(taskId: string, dependsOnId: string): boolean;
export declare function isTaskBlocked(taskId: string): boolean;
export declare function getReadyTasks(projectId?: string): Task[];
export declare function archiveDoneTasks(projectId: string): number;
export declare function archiveEmptyEpics(projectId: string): number;
export declare function cleanupProject(projectId: string, archiveTasks: boolean, archiveEpics: boolean): {
    archivedTasks: number;
    deletedEpics: number;
};
export declare function createBlob(hash: string, filename: string, mime_type: string, size: number, task_id?: string): Blob;
export declare function getBlob(id: string): Blob | undefined;
export declare function getBlobByHash(hash: string): Blob | undefined;
export declare function getBlobs(filter?: {
    task_id?: string;
}): Blob[];
export declare function deleteBlob(id: string): boolean;
export declare function attachBlobToTask(blobId: string, taskId: string): boolean;
export declare function detachBlobFromTask(blobId: string, taskId: string): boolean;
export declare function getWebhooks(): Webhook[];
export declare function getWebhook(id: string): Webhook | undefined;
export declare function getWebhooksByProject(projectId: string): Webhook[];
export declare function createWebhook(name: string, url: string, events: WebhookEventType[], options?: {
    secret?: string;
    project_id?: string;
    enabled?: boolean;
}): Webhook;
export declare function updateWebhook(id: string, updates: Partial<Omit<Webhook, 'id' | 'created_at'>>): Webhook | undefined;
export declare function deleteWebhook(id: string): boolean;
export declare function testWebhook(id: string): Webhook | undefined;
export declare function getWebhookDeliveries(webhookId?: string, limit?: number): WebhookDelivery[];
export declare function createWebhookDelivery(webhookId: string, event: WebhookEventType, payload: WebhookPayload): WebhookDelivery;
export declare function updateWebhookDelivery(id: string, updates: Partial<Omit<WebhookDelivery, 'id' | 'webhook_id' | 'event' | 'payload' | 'created_at'>>): WebhookDelivery | undefined;
export declare function cleanupOldDeliveries(maxAge?: number): number;
export type WebhookEventHandler = (event: WebhookEventType, payload: WebhookPayload, webhook: Webhook) => Promise<void>;
export declare function setWebhookEventHandler(handler: WebhookEventHandler | null): void;
export declare function getWebhookEventHandler(): WebhookEventHandler | null;
export declare function triggerWebhooks(event: WebhookEventType, data: WebhookPayload['data'], projectId?: string): Promise<void>;
export declare function getApiKeys(): ApiKey[];
export declare function getApiKey(id: string): ApiKey | undefined;
/**
 * Create a new API key
 * Returns the raw key (shown once to user) and the stored key record
 */
export declare function createApiKey(name: string, scope: KeyScope): {
    rawKey: string;
    apiKey: ApiKey;
};
export declare function deleteApiKey(id: string): boolean;
/**
 * Validate an API key and return the key record if valid
 * Also updates last_used_at timestamp (throttled to once per minute)
 */
export declare function validateApiKey(rawKey: string): ApiKey | undefined;
/**
 * Check if any API keys are configured
 */
export declare function hasApiKeys(): boolean;
export declare function createCliAuthRequest(): CliAuthRequest;
export declare function getCliAuthRequest(token: string): CliAuthRequest | undefined;
export declare function completeCliAuthRequest(token: string, name: string, scope: KeyScope): {
    rawKey: string;
    apiKey: ApiKey;
} | undefined;
export declare function pollCliAuthRequest(token: string): {
    status: 'pending' | 'completed' | 'expired';
    apiKey?: string;
};
export declare function cleanupExpiredAuthRequests(): number;
export {};
