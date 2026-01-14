// Agent options for tasks
export type Agent = 'claude' | 'codex' | 'gemini' | 'other';

export const AGENTS: Agent[] = ['claude', 'codex', 'gemini', 'other'];

export const AGENT_CONFIG: Record<Agent, { label: string }> = {
  claude: { label: 'Claude' },
  codex: { label: 'Codex' },
  gemini: { label: 'Gemini' },
  other: { label: 'Other' },
};

// Priority levels: P0 = urgent, P1 = normal, P2 = low
export type Priority = 0 | 1 | 2;

export const PRIORITIES: Priority[] = [0, 1, 2];

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; ansi: string }> = {
  0: { label: 'P0', color: '#ef4444', ansi: '\x1b[31m' }, // red - urgent
  1: { label: 'P1', color: '#f59e0b', ansi: '\x1b[33m' }, // yellow - normal
  2: { label: 'P2', color: '#6b7280', ansi: '\x1b[90m' }, // gray - low
};

export type CommentAuthor = 'user' | 'mcp';

export type TaskComment = {
  id: string;
  body: string;
  author: CommentAuthor;
  created_at: string;
};

// Guardrail for ralph-loop integration (higher number = more critical)
export type Guardrail = {
  number: number;
  text: string;
};

// Task represents a single work item.
export type Task = {
  id: string;
  title: string;
  status: string; // e.g. "todo" | "in_progress" | "done"
  depends_on: string[];
  comments?: TaskComment[];
  epic_id?: string;
  project_id: string;
  agent?: Agent; // Optional agent assignment
  archived?: boolean; // Whether the task is archived
  priority?: Priority; // P0 = urgent, P1 = normal, P2 = low
  blocked_reason?: string; // External blocker (meeting, approval, etc.)
  acceptance_criteria?: string[]; // Observable behavioral outcomes for agent loops
  guardrails?: Guardrail[]; // Numbered instructions (higher = more critical)
  created_at?: string;
  updated_at?: string;
};

// Epic represents a grouped set of tasks.
export type Epic = {
  id: string;
  title: string;
  status: string;
  depends_on: string[];
  notes: string;
  auto: boolean;
  project_id: string;
};

// Project represents a Kanban project.
export type Project = {
  id: string;
  name: string;
  description?: string;
};

// Store is the JSON document root.
export type Store = {
  projects: Project[];
  epics: Epic[];
  tasks: Task[];
};

// Status columns for the Kanban board
export type Status = 'planning' | 'todo' | 'in_progress' | 'done';

export const STATUSES: Status[] = ['planning', 'todo', 'in_progress', 'done'];

// Status display names and colors
export const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  planning: { label: 'Planning', color: '#a855f7' },
  todo: { label: 'To Do', color: '#6b7280' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  done: { label: 'Done', color: '#22c55e' },
};

// Epic colors palette
export const EPIC_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // orange/amber
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

// ============ Webhook Types ============

// Webhook event types
export type WebhookEventType =
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'epic.created'
  | 'epic.updated'
  | 'epic.deleted'
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.status_changed'
  | 'task.archived';

export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  'project.created',
  'project.updated',
  'project.deleted',
  'epic.created',
  'epic.updated',
  'epic.deleted',
  'task.created',
  'task.updated',
  'task.deleted',
  'task.status_changed',
  'task.archived',
];

// Webhook event type labels for UI
export const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, string> = {
  'project.created': 'Project Created',
  'project.updated': 'Project Updated',
  'project.deleted': 'Project Deleted',
  'epic.created': 'Epic Created',
  'epic.updated': 'Epic Updated',
  'epic.deleted': 'Epic Deleted',
  'task.created': 'Task Created',
  'task.updated': 'Task Updated',
  'task.deleted': 'Task Deleted',
  'task.status_changed': 'Task Status Changed',
  'task.archived': 'Task Archived',
};

// Webhook configuration
export type Webhook = {
  id: string;
  name: string;
  url: string;
  secret?: string; // Optional secret for HMAC signature verification
  events: WebhookEventType[];
  enabled: boolean;
  project_id?: string; // Optional: only trigger for specific project
  created_at: string;
  updated_at: string;
};

// Webhook delivery record
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

// Webhook payload structure
export type WebhookPayload = {
  event: WebhookEventType;
  timestamp: string;
  webhook_id: string;
  data: {
    project?: Project;
    epic?: Epic;
    task?: Task;
    previous?: Partial<Project | Epic | Task>; // For update events
  };
};

// Store is the JSON document root - updated to include webhooks
export type StoreWithWebhooks = Store & {
  webhooks?: Webhook[];
  webhook_deliveries?: WebhookDelivery[];
};
