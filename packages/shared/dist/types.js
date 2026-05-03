export const AGENTS = ['claude', 'codex', 'gemini', 'other'];
export const AGENT_CONFIG = {
    claude: { label: 'Claude' },
    codex: { label: 'Codex' },
    gemini: { label: 'Gemini' },
    other: { label: 'Other' },
};
export const PRIORITIES = [0, 1, 2];
export const PRIORITY_CONFIG = {
    0: { label: 'P0', color: '#ef4444', ansi: '\x1b[31m' }, // red - urgent
    1: { label: 'P1', color: '#f59e0b', ansi: '\x1b[33m' }, // yellow - normal
    2: { label: 'P2', color: '#6b7280', ansi: '\x1b[90m' }, // gray - low
};
export const STATUSES = ['planning', 'todo', 'in_progress', 'done'];
// Status display names and colors
export const STATUS_CONFIG = {
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
export const WEBHOOK_EVENT_TYPES = [
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
export const WEBHOOK_EVENT_LABELS = {
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
