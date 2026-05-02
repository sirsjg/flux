export type Agent = 'claude' | 'codex' | 'gemini' | 'other';
export declare const AGENTS: Agent[];
export declare const AGENT_CONFIG: Record<Agent, {
    label: string;
}>;
export type Priority = 0 | 1 | 2;
export declare const PRIORITIES: Priority[];
export declare const PRIORITY_CONFIG: Record<Priority, {
    label: string;
    color: string;
    ansi: string;
}>;
export type CommentAuthor = 'user' | 'mcp';
export type TaskComment = {
    id: string;
    body: string;
    author: CommentAuthor;
    agent_name?: string;
    created_at: string;
};
export type Guardrail = {
    id: string;
    number: number;
    text: string;
};
export type Task = {
    id: string;
    title: string;
    status: string;
    depends_on: string[];
    comments?: TaskComment[];
    epic_id?: string;
    project_id: string;
    agent?: Agent;
    archived?: boolean;
    priority?: Priority;
    blocked_reason?: string;
    acceptance_criteria?: string[];
    guardrails?: Guardrail[];
    blob_ids?: string[];
    workers?: string[];
    completed_by?: string;
    started_at?: string;
    completed_at?: string;
    created_at?: string;
    updated_at?: string;
};
export type Epic = {
    id: string;
    title: string;
    status: string;
    depends_on: string[];
    notes: string;
    auto: boolean;
    project_id: string;
};
export type ProjectVisibility = 'public' | 'private';
export type Project = {
    id: string;
    name: string;
    description?: string;
    visibility?: ProjectVisibility;
};
export type KeyScope = {
    type: 'server';
} | {
    type: 'project';
    project_ids: string[];
};
export type ApiKey = {
    id: string;
    prefix: string;
    hash: string;
    name: string;
    scope: KeyScope;
    created_at: string;
    last_used_at?: string;
};
export type CliAuthRequest = {
    token: string;
    name?: string;
    scope?: KeyScope;
    api_key?: string;
    expires_at: string;
    completed_at?: string;
};
export type Blob = {
    id: string;
    hash: string;
    filename: string;
    mime_type: string;
    size: number;
    task_id?: string;
    created_at: string;
};
export type Store = {
    projects: Project[];
    epics: Epic[];
    tasks: Task[];
    blobs?: Blob[];
};
export type Status = 'planning' | 'todo' | 'in_progress' | 'done';
export declare const STATUSES: Status[];
export declare const STATUS_CONFIG: Record<Status, {
    label: string;
    color: string;
}>;
export declare const EPIC_COLORS: string[];
export type WebhookEventType = 'project.created' | 'project.updated' | 'project.deleted' | 'epic.created' | 'epic.updated' | 'epic.deleted' | 'task.created' | 'task.updated' | 'task.deleted' | 'task.status_changed' | 'task.archived';
export declare const WEBHOOK_EVENT_TYPES: WebhookEventType[];
export declare const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, string>;
export type Webhook = {
    id: string;
    name: string;
    url: string;
    secret?: string;
    events: WebhookEventType[];
    enabled: boolean;
    project_id?: string;
    created_at: string;
    updated_at: string;
};
export type WebhookDelivery = {
    id: string;
    webhook_id: string;
    event: WebhookEventType;
    payload: WebhookPayload;
    status: 'pending' | 'success' | 'failed';
    response_code?: number;
    response_body?: string;
    error?: string;
    attempts: number;
    created_at: string;
    delivered_at?: string;
};
export type WebhookPayload = {
    event: WebhookEventType;
    timestamp: string;
    webhook_id: string;
    data: {
        project?: Project;
        epic?: Epic;
        task?: Task;
        previous?: Partial<Project | Epic | Task>;
    };
};
export type StoreWithWebhooks = Store & {
    webhooks?: Webhook[];
    webhook_deliveries?: WebhookDelivery[];
    api_keys?: ApiKey[];
    cli_auth_requests?: CliAuthRequest[];
};
