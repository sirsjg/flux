/**
 * Flux client - abstracts local store vs HTTP server
 * Used by CLI, MCP, and other consumers
 */
import { PRIORITY_CONFIG, PRIORITIES } from './index.js';
import type { Project, Epic, Task, TaskComment, Priority, Store, Blob, Webhook, WebhookDelivery, WebhookEventType, Guardrail, ApiKey } from './types.js';
export { PRIORITY_CONFIG, PRIORITIES };
export type { Project, Epic, Task, TaskComment, Priority, Store, Blob, Webhook, WebhookDelivery, WebhookEventType, Guardrail };
export declare class FluxHttpError extends Error {
    status: number;
    statusText: string;
    constructor(message: string, status: number, statusText: string);
    get isNotFound(): boolean;
    get isUnauthorized(): boolean;
}
export declare function initClient(server?: string, key?: string): void;
export declare function isServerMode(): boolean;
export declare function getServerUrl(): string | null;
export declare function getProjects(): Promise<Project[]>;
export declare function getProject(id: string): Promise<Project | undefined>;
export declare function createProject(name: string, description?: string, visibility?: 'public' | 'private'): Promise<Project>;
export declare function updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
export declare function deleteProject(id: string): Promise<boolean>;
export declare function getProjectStats(id: string): Promise<{
    total: number;
    done: number;
}>;
export declare function getEpics(projectId: string): Promise<Epic[]>;
export declare function getEpic(id: string): Promise<Epic | undefined>;
export declare function createEpic(projectId: string, title: string, notes?: string, auto?: boolean): Promise<Epic>;
export declare function updateEpic(id: string, updates: Partial<Epic>): Promise<Epic | undefined>;
export declare function deleteEpic(id: string): Promise<boolean>;
export declare function getTasks(projectId: string): Promise<Task[]>;
export declare function getTask(id: string): Promise<Task | undefined>;
export declare function createTask(projectId: string, title: string, epicId?: string, options?: {
    priority?: Priority;
    depends_on?: string[];
    acceptance_criteria?: string[];
    guardrails?: Guardrail[];
}): Promise<Task>;
export declare function updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined>;
export declare function deleteTask(id: string): Promise<boolean>;
export declare function isTaskBlocked(id: string): Promise<boolean>;
export declare function addTaskComment(taskId: string, body: string, author?: 'user' | 'mcp', agentName?: string): Promise<TaskComment | undefined>;
export declare function deleteTaskComment(taskId: string, commentId: string): Promise<boolean>;
export declare function getReadyTasks(projectId?: string): Promise<Task[]>;
export declare function exportAll(): Promise<Store>;
export declare function importAll(data: Store, merge?: boolean): Promise<void>;
export declare function getWebhooks(): Promise<Webhook[]>;
export declare function getWebhook(id: string): Promise<Webhook | undefined>;
export declare function createWebhook(name: string, url: string, events: WebhookEventType[], options?: {
    secret?: string;
    project_id?: string;
}): Promise<Webhook>;
export declare function updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook | undefined>;
export declare function deleteWebhook(id: string): Promise<boolean>;
export declare function getWebhookDeliveries(webhookId: string, limit?: number): Promise<WebhookDelivery[]>;
export declare function uploadBlob(content: Buffer, filename: string, mime_type: string, task_id?: string): Promise<Blob>;
export declare function downloadBlob(id: string): Promise<{
    blob: Blob;
    content: Buffer;
} | null>;
export declare function getBlobMetadata(id: string): Promise<Blob | undefined>;
export declare function getClientBlobs(filter?: {
    task_id?: string;
}): Promise<Blob[]>;
export declare function deleteBlobClient(id: string): Promise<boolean>;
export type ApiKeyInfo = Omit<ApiKey, 'hash'>;
export declare function getAuthStatus(): Promise<{
    authenticated: boolean;
    keyType: 'server' | 'project' | 'env' | 'anonymous';
    projectIds?: string[];
}>;
export declare function getApiKeys(): Promise<ApiKeyInfo[]>;
export declare function createApiKeyRemote(name: string, projectIds?: string[]): Promise<{
    key: string;
} & ApiKeyInfo>;
export declare function deleteApiKeyRemote(id: string): Promise<boolean>;
export declare function initCliAuth(): Promise<{
    token: string;
    expires_at: string;
}>;
export declare function pollCliAuth(token: string): Promise<{
    status: 'pending' | 'completed' | 'expired';
    apiKey?: string;
}>;
export declare function completeCliAuth(token: string, name: string, projectIds?: string[]): Promise<{
    success: boolean;
}>;
