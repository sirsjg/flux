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

// Task types: task, bug, feature, refactor, docs, chore
export type TaskType = 'task' | 'bug' | 'feature' | 'refactor' | 'docs' | 'chore';

export const TASK_TYPES: TaskType[] = ['task', 'bug', 'feature', 'refactor', 'docs', 'chore'];

export const TASK_TYPE_CONFIG: Record<TaskType, { label: string; color: string; symbol: string; icon: string }> = {
  task: { label: 'Task', color: 'gray', symbol: '◆', icon: 'CheckCircleIcon' },
  bug: { label: 'Bug', color: 'red', symbol: '⚠', icon: 'ExclamationTriangleIcon' },
  feature: { label: 'Feature', color: 'purple', symbol: '★', icon: 'SparklesIcon' },
  refactor: { label: 'Refactor', color: 'blue', symbol: '⟳', icon: 'ArrowPathIcon' },
  docs: { label: 'Docs', color: 'green', symbol: '📄', icon: 'DocumentTextIcon' },
  chore: { label: 'Chore', color: 'amber', symbol: '⚙', icon: 'WrenchScrewdriverIcon' },
};

export type CommentAuthor = 'user' | 'mcp';

export type TaskComment = {
  id: string;
  body: string;
  author: CommentAuthor;
  created_at: string;
};

// Guardrail for agent loop integration (higher number = more critical)
export type Guardrail = {
  id: string;
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
  type?: TaskType; // Task type: task, bug, feature, refactor, docs, chore (defaults to 'task')
  blocked_reason?: string; // External blocker (meeting, approval, etc.)
  acceptance_criteria?: string[]; // Observable behavioral outcomes for verification
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

  // Shape-Up metadata (matching UI exactly)
  ai_status?: 'Idle' | 'Running' | 'Blocked' | 'Failing';
  risk_level?: 'Green' | 'Amber' | 'Red';
  primary_phase?: 'Shaping' | 'Betting' | 'Active' | 'Shipped';
  thrash_cuts?: number;
  thrash_retries?: number;

  created_at?: string;
  updated_at?: string;
};

// Store is the JSON document root.
export type Store = {
  projects: Project[];
  epics: Epic[];
  tasks: Task[];
};

// ============ Storage Provider Types ============

// Universal Schema Definition
// All storage providers use this schema:
// - Single entry (id = 'main')
// - data field containing the full Store object
// - updated_at timestamp (optional, provider-specific)
export type UniversalStoreSchema = {
  id: 'main';
  data: Store;
  updated_at?: string | number;
};

// Storage Provider Types
export type StorageProviderType =
  | 'sqlite'    // Local SQLite database
  | 'json'      // Local JSON file
  | 'supabase'; // Supabase (PostgreSQL)

export type StorageProviderConfig = {
  provider: StorageProviderType;
  connectionString: string;  // File path, connection string, or URL
  options?: Record<string, any>;  // Provider-specific options
};

// ============ Status Types ============

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
