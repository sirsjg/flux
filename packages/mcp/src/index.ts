#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { join } from 'path';

// Parse CLI args for transport mode
const args = process.argv.slice(2);
const httpMode = args.includes('--http');
const portArg = args.find(a => a.startsWith('--port='));
const HTTP_PORT = portArg ? parseInt(portArg.split('=')[1]) : 3001;
import {
  initClient,
  isServerMode,
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats,
  getEpics,
  getEpic,
  createEpic,
  updateEpic,
  deleteEpic,
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  addTaskComment,
  deleteTaskComment,
  isTaskBlocked,
  getReadyTasks,
  getWebhooks,
  getWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  type WebhookEventType,
} from '@flux/shared/client';
import { setStorageAdapter, initStore, STATUSES, WEBHOOK_EVENT_TYPES } from '@flux/shared';
import { createAdapter } from '@flux/shared/adapters';

// Initialize client - check for remote server mode first
const FLUX_SERVER = process.env.FLUX_SERVER;
const FLUX_API_KEY = process.env.FLUX_API_KEY;

if (FLUX_SERVER) {
  // Remote server mode
  initClient(FLUX_SERVER, FLUX_API_KEY);
  console.error(`Flux MCP using remote server: ${FLUX_SERVER}`);
} else {
  // Local storage mode
  const DATA_FILE = process.env.FLUX_DATA || join(process.cwd(), '.flux/data.json');
  const adapter = createAdapter(DATA_FILE);
  setStorageAdapter(adapter);
  initStore();
  initClient(); // Local mode
  console.error(`Flux MCP using local storage: ${DATA_FILE}`);
}

// Create MCP server
const server = new Server(
  {
    name: 'flux-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// ============ Resources ============

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const projects = await getProjects();
  const resources = [
    {
      uri: 'flux://projects',
      name: 'All Projects',
      description: 'List of all Flux projects',
      mimeType: 'application/json',
    },
  ];

  // Add individual project resources
  for (const project of projects) {
    resources.push({
      uri: `flux://projects/${project.id}`,
      name: project.name,
      description: project.description || `Project: ${project.name}`,
      mimeType: 'application/json',
    });
    resources.push({
      uri: `flux://projects/${project.id}/epics`,
      name: `${project.name} - Epics`,
      description: `Epics in ${project.name}`,
      mimeType: 'application/json',
    });
    resources.push({
      uri: `flux://projects/${project.id}/tasks`,
      name: `${project.name} - Tasks`,
      description: `Tasks in ${project.name}`,
      mimeType: 'application/json',
    });
  }

  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  // Parse URI
  if (uri === 'flux://projects') {
    const projectList = await getProjects();
    const projects = await Promise.all(
      projectList.map(async p => ({
        ...p,
        stats: await getProjectStats(p.id),
      }))
    );
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(projects, null, 2),
        },
      ],
    };
  }

  // Match flux://projects/:id
  const projectMatch = uri.match(/^flux:\/\/projects\/([^/]+)$/);
  if (projectMatch) {
    const project = await getProject(projectMatch[1]);
    if (!project) {
      throw new Error(`Project not found: ${projectMatch[1]}`);
    }
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ ...project, stats: await getProjectStats(project.id) }, null, 2),
        },
      ],
    };
  }

  // Match flux://projects/:id/epics
  const epicsMatch = uri.match(/^flux:\/\/projects\/([^/]+)\/epics$/);
  if (epicsMatch) {
    const epics = await getEpics(epicsMatch[1]);
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(epics, null, 2),
        },
      ],
    };
  }

  // Match flux://projects/:id/tasks
  const tasksMatch = uri.match(/^flux:\/\/projects\/([^/]+)\/tasks$/);
  if (tasksMatch) {
    const taskList = await getTasks(tasksMatch[1]);
    const tasks = await Promise.all(
      taskList.map(async t => ({
        ...t,
        blocked: await isTaskBlocked(t.id),
      }))
    );
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(tasks, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource URI: ${uri}`);
});

// ============ Tools ============

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Project tools
      {
        name: 'list_projects',
        description: 'List all Flux projects with their stats',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_project',
        description: 'Create a new Flux project',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Project name' },
            description: { type: 'string', description: 'Optional project description' },
          },
          required: ['name'],
        },
      },
      {
        name: 'update_project',
        description: 'Update an existing project',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID' },
            name: { type: 'string', description: 'New project name' },
            description: { type: 'string', description: 'New project description' },
          },
          required: ['project_id'],
        },
      },
      {
        name: 'delete_project',
        description: 'Delete a project and all its epics and tasks',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID to delete' },
          },
          required: ['project_id'],
        },
      },

      // Epic tools
      {
        name: 'list_epics',
        description: 'List all epics in a project',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID' },
          },
          required: ['project_id'],
        },
      },
      {
        name: 'create_epic',
        description: 'Create a new epic in a project',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID' },
            title: { type: 'string', description: 'Epic title' },
            notes: { type: 'string', description: 'Optional epic notes' },
            auto: { type: 'boolean', description: 'Optional auto flag (defaults to false)' },
          },
          required: ['project_id', 'title'],
        },
      },
      {
        name: 'update_epic',
        description: 'Update an existing epic',
        inputSchema: {
          type: 'object',
          properties: {
            epic_id: { type: 'string', description: 'Epic ID' },
            title: { type: 'string', description: 'New epic title' },
            notes: { type: 'string', description: 'New epic notes' },
            status: {
              type: 'string',
              enum: STATUSES,
              description: 'New epic status (todo, in_progress, done)',
            },
            depends_on: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs of epics this epic depends on',
            },
            auto: {
              type: 'boolean',
              description: 'Enable or disable auto for the epic',
            },
          },
          required: ['epic_id'],
        },
      },
      {
        name: 'delete_epic',
        description: 'Delete an epic (tasks will become unassigned)',
        inputSchema: {
          type: 'object',
          properties: {
            epic_id: { type: 'string', description: 'Epic ID to delete' },
          },
          required: ['epic_id'],
        },
      },

      // Task tools
      {
        name: 'list_tasks',
        description: 'List all tasks in a project with their blocked status',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID' },
            epic_id: { type: 'string', description: 'Optional: filter by epic ID' },
            status: {
              type: 'string',
              enum: STATUSES,
              description: 'Optional: filter by status',
            },
          },
          required: ['project_id'],
        },
      },
      {
        name: 'list_ready_tasks',
        description: 'List tasks that are ready to work on (not done, not blocked, sorted by priority). Use this to find actionable work.',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Optional: filter by project ID' },
          },
        },
      },
      {
        name: 'create_task',
        description: 'Create a new task in a project. Use add_task_comment to add notes.',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID' },
            title: { type: 'string', description: 'Task title' },
            epic_id: { type: 'string', description: 'Optional: assign to epic' },
            acceptance_criteria: {
              type: 'array',
              items: { type: 'string' },
              description: 'Observable behavioral outcomes for ralph-loops (e.g., "Processes <5MB in <100ms")',
            },
            guardrails: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  number: { type: 'number', description: 'Priority number (higher = more critical, e.g., 999, 9999)' },
                  text: { type: 'string', description: 'Guardrail instruction' },
                },
                required: ['number', 'text'],
              },
              description: 'Numbered instructions for ralph-loops (higher number = more critical)',
            },
          },
          required: ['project_id', 'title'],
        },
      },
      {
        name: 'update_task',
        description: 'Update an existing task (change status, title, epic, or dependencies). Use add_task_comment for notes. Tasks must be moved to "todo" before they can be started (moved to "in_progress").',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'string', description: 'Task ID' },
            title: { type: 'string', description: 'New task title' },
            status: {
              type: 'string',
              enum: STATUSES,
              description: 'New task status (planning, todo, in_progress, done). Tasks in "planning" cannot be moved directly to "in_progress".',
            },
            epic_id: { type: 'string', description: 'Assign to epic (or empty to unassign)' },
            depends_on: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs of tasks this task depends on',
            },
            blocked_reason: {
              type: ['string', 'null'],
              description: 'External blocker reason (e.g., "Waiting for vendor quote"). Set to null or empty string to clear.',
            },
            acceptance_criteria: {
              type: 'array',
              items: { type: 'string' },
              description: 'Observable behavioral outcomes for verification (e.g., "Processes <5MB in <100ms")',
            },
            guardrails: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  number: { type: 'number', description: 'Priority number (higher = more critical, e.g., 999, 9999)' },
                  text: { type: 'string', description: 'Guardrail instruction' },
                },
                required: ['number', 'text'],
              },
              description: 'Numbered behavioral constraints (higher number = more critical)',
            },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'delete_task',
        description: 'Delete a task',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'string', description: 'Task ID to delete' },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'move_task_status',
        description: 'Quickly move a task to a new status. Note: tasks must be in "todo" before they can be started (moved to "in_progress").',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'string', description: 'Task ID' },
            status: {
              type: 'string',
              enum: STATUSES,
              description: 'New status (planning, todo, in_progress, done). Tasks in "planning" cannot be moved directly to "in_progress".',
            },
          },
          required: ['task_id', 'status'],
        },
      },
      {
        name: 'add_task_comment',
        description: 'Add a comment to a task',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'string', description: 'Task ID' },
            body: { type: 'string', description: 'Comment body' },
            author: {
              type: 'string',
              enum: ['user', 'mcp'],
              description: 'Comment author type (defaults to mcp)',
            },
          },
          required: ['task_id', 'body'],
        },
      },
      {
        name: 'delete_task_comment',
        description: 'Delete a comment from a task',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'string', description: 'Task ID' },
            comment_id: { type: 'string', description: 'Comment ID' },
          },
          required: ['task_id', 'comment_id'],
        },
      },

      // Webhook tools
      {
        name: 'list_webhooks',
        description: 'List all configured webhooks',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_webhook',
        description: 'Create a new webhook to receive notifications when events occur',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Webhook name for identification' },
            url: { type: 'string', description: 'URL to send webhook POST requests to' },
            events: {
              type: 'array',
              items: { type: 'string', enum: WEBHOOK_EVENT_TYPES },
              description: 'List of events to trigger this webhook (e.g., task.created, task.status_changed)',
            },
            secret: { type: 'string', description: 'Optional secret for HMAC signature verification' },
            project_id: { type: 'string', description: 'Optional: only trigger for this project' },
          },
          required: ['name', 'url', 'events'],
        },
      },
      {
        name: 'update_webhook',
        description: 'Update an existing webhook configuration',
        inputSchema: {
          type: 'object',
          properties: {
            webhook_id: { type: 'string', description: 'Webhook ID to update' },
            name: { type: 'string', description: 'New webhook name' },
            url: { type: 'string', description: 'New URL to send webhook requests to' },
            events: {
              type: 'array',
              items: { type: 'string', enum: WEBHOOK_EVENT_TYPES },
              description: 'New list of events to trigger this webhook',
            },
            secret: { type: 'string', description: 'New secret for signature verification' },
            project_id: { type: 'string', description: 'New project filter (empty to clear)' },
            enabled: { type: 'boolean', description: 'Enable or disable the webhook' },
          },
          required: ['webhook_id'],
        },
      },
      {
        name: 'delete_webhook',
        description: 'Delete a webhook',
        inputSchema: {
          type: 'object',
          properties: {
            webhook_id: { type: 'string', description: 'Webhook ID to delete' },
          },
          required: ['webhook_id'],
        },
      },
      {
        name: 'list_webhook_deliveries',
        description: 'List recent webhook delivery attempts for a specific webhook',
        inputSchema: {
          type: 'object',
          properties: {
            webhook_id: { type: 'string', description: 'Webhook ID to get deliveries for' },
            limit: { type: 'number', description: 'Maximum number of deliveries to return (default 20)' },
          },
          required: ['webhook_id'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    // Project operations
    case 'list_projects': {
      const projectList = await getProjects();
      const projects = await Promise.all(
        projectList.map(async p => ({
          ...p,
          stats: await getProjectStats(p.id),
        }))
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
      };
    }

    case 'create_project': {
      const project = await createProject(args?.name as string, args?.description as string);
      return {
        content: [
          { type: 'text', text: `Created project "${project.name}" with ID: ${project.id}` },
        ],
      };
    }

    case 'update_project': {
      const updates: Record<string, string> = {};
      if (args?.name) updates.name = args.name as string;
      if (args?.description !== undefined) updates.description = args.description as string;
      const project = await updateProject(args?.project_id as string, updates);
      if (!project) {
        return { content: [{ type: 'text', text: 'Project not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Updated project: ${JSON.stringify(project, null, 2)}` }],
      };
    }

    case 'delete_project': {
      await deleteProject(args?.project_id as string);
      return {
        content: [{ type: 'text', text: `Deleted project ${args?.project_id}` }],
      };
    }

    // Epic operations
    case 'list_epics': {
      const epics = await getEpics(args?.project_id as string);
      return {
        content: [{ type: 'text', text: JSON.stringify(epics, null, 2) }],
      };
    }

    case 'create_epic': {
      const epic = await createEpic(
        args?.project_id as string,
        args?.title as string,
        args?.notes as string,
        args?.auto as boolean | undefined
      );
      return {
        content: [{ type: 'text', text: `Created epic "${epic.title}" with ID: ${epic.id}` }],
      };
    }

    case 'update_epic': {
      const updates: Record<string, unknown> = {};
      if (args?.title) updates.title = args.title;
      if (args?.notes !== undefined) updates.notes = args.notes;
      if (args?.status) updates.status = args.status;
      if (args?.depends_on) updates.depends_on = args.depends_on;
      if (args?.auto !== undefined) updates.auto = args.auto;
      const epic = await updateEpic(args?.epic_id as string, updates);
      if (!epic) {
        return { content: [{ type: 'text', text: 'Epic not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Updated epic: ${JSON.stringify(epic, null, 2)}` }],
      };
    }

    case 'delete_epic': {
      const success = await deleteEpic(args?.epic_id as string);
      if (!success) {
        return { content: [{ type: 'text', text: 'Epic not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Deleted epic ${args?.epic_id}` }],
      };
    }

    // Task operations
    case 'list_tasks': {
      const taskList = await getTasks(args?.project_id as string);
      let tasks = await Promise.all(
        taskList.map(async t => ({
          ...t,
          blocked: await isTaskBlocked(t.id),
        }))
      );

      // Apply filters
      if (args?.epic_id) {
        tasks = tasks.filter(t => t.epic_id === args.epic_id);
      }
      if (args?.status) {
        tasks = tasks.filter(t => t.status === args.status);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
      };
    }

    case 'list_ready_tasks': {
      const tasks = await getReadyTasks(args?.project_id as string | undefined);
      return {
        content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
      };
    }

    case 'create_task': {
      const task = await createTask(
        args?.project_id as string,
        args?.title as string,
        args?.epic_id as string,
        {
          acceptance_criteria: args?.acceptance_criteria as string[] | undefined,
          guardrails: args?.guardrails as { number: number; text: string }[] | undefined,
        }
      );
      return {
        content: [{ type: 'text', text: `Created task "${task.title}" with ID: ${task.id}` }],
      };
    }

    case 'update_task': {
      // Validate workflow: tasks in 'planning' cannot go directly to 'in_progress'
      if (args?.status === 'in_progress') {
        const currentTask = await getTask(args?.task_id as string);
        if (currentTask?.status === 'planning') {
          return {
            content: [{ type: 'text', text: 'Cannot start a task that is still in planning. Move the task to "todo" first.' }],
            isError: true,
          };
        }
      }
      const updates: Record<string, unknown> = {};
      if (args?.title) updates.title = args.title;
      if (args?.status) updates.status = args.status;
      if (args?.epic_id !== undefined) updates.epic_id = args.epic_id || undefined;
      if (args?.depends_on) updates.depends_on = args.depends_on;
      if (args?.blocked_reason !== undefined) {
        updates.blocked_reason = args.blocked_reason || undefined; // Empty string clears
      }
      if (args?.acceptance_criteria !== undefined) updates.acceptance_criteria = args.acceptance_criteria;
      if (args?.guardrails !== undefined) updates.guardrails = args.guardrails;
      const task = await updateTask(args?.task_id as string, updates);
      if (!task) {
        return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
      }
      return {
        content: [
          {
            type: 'text',
            text: `Updated task: ${JSON.stringify({ ...task, blocked: await isTaskBlocked(task.id) }, null, 2)}`,
          },
        ],
      };
    }

    case 'delete_task': {
      const success = await deleteTask(args?.task_id as string);
      if (!success) {
        return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Deleted task ${args?.task_id}` }],
      };
    }

    case 'move_task_status': {
      // Validate workflow: tasks in 'planning' cannot go directly to 'in_progress'
      if (args?.status === 'in_progress') {
        const currentTask = await getTask(args?.task_id as string);
        if (currentTask?.status === 'planning') {
          return {
            content: [{ type: 'text', text: 'Cannot start a task that is still in planning. Move the task to "todo" first.' }],
            isError: true,
          };
        }
      }
      const task = await updateTask(args?.task_id as string, { status: args?.status as string });
      if (!task) {
        return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
      }
      return {
        content: [
          { type: 'text', text: `Moved task "${task.title}" to ${args?.status}` },
        ],
      };
    }

    case 'add_task_comment': {
      const body = (args?.body as string | undefined)?.trim();
      if (!body) {
        return { content: [{ type: 'text', text: 'Comment body required' }], isError: true };
      }
      const author = args?.author === 'user' ? 'user' : 'mcp';
      const comment = await addTaskComment(args?.task_id as string, body, author);
      if (!comment) {
        return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Added comment ${comment.id}` }],
      };
    }

    case 'delete_task_comment': {
      const success = await deleteTaskComment(args?.task_id as string, args?.comment_id as string);
      if (!success) {
        return { content: [{ type: 'text', text: 'Comment not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Deleted comment ${args?.comment_id}` }],
      };
    }

    // Webhook operations
    case 'list_webhooks': {
      const webhooks = await getWebhooks();
      return {
        content: [{ type: 'text', text: JSON.stringify(webhooks, null, 2) }],
      };
    }

    case 'create_webhook': {
      const webhook = await createWebhook(
        args?.name as string,
        args?.url as string,
        args?.events as WebhookEventType[],
        {
          secret: args?.secret as string | undefined,
          project_id: args?.project_id as string | undefined,
        }
      );
      return {
        content: [
          { type: 'text', text: `Created webhook "${webhook.name}" with ID: ${webhook.id}` },
        ],
      };
    }

    case 'update_webhook': {
      const updates: Record<string, unknown> = {};
      if (args?.name) updates.name = args.name;
      if (args?.url) updates.url = args.url;
      if (args?.events) updates.events = args.events;
      if (args?.secret !== undefined) updates.secret = args.secret || undefined;
      if (args?.project_id !== undefined) updates.project_id = args.project_id || undefined;
      if (args?.enabled !== undefined) updates.enabled = args.enabled;

      const webhook = await updateWebhook(args?.webhook_id as string, updates);
      if (!webhook) {
        return { content: [{ type: 'text', text: 'Webhook not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Updated webhook: ${JSON.stringify(webhook, null, 2)}` }],
      };
    }

    case 'delete_webhook': {
      const success = await deleteWebhook(args?.webhook_id as string);
      if (!success) {
        return { content: [{ type: 'text', text: 'Webhook not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Deleted webhook ${args?.webhook_id}` }],
      };
    }

    case 'list_webhook_deliveries': {
      const limit = (args?.limit as number) || 20;
      const deliveries = await getWebhookDeliveries(args?.webhook_id as string, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(deliveries, null, 2) }],
      };
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// Start server
async function main() {
  if (httpMode) {
    // HTTP+SSE mode using Streamable HTTP transport
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    await server.connect(transport);

    // Create HTTP server using Bun
    const httpServer = Bun.serve({
      port: HTTP_PORT,
      async fetch(req) {
        const url = new URL(req.url);

        // Health check
        if (url.pathname === '/health') {
          return new Response(JSON.stringify({ status: 'ok' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // MCP endpoint
        if (url.pathname === '/mcp') {
          return transport.handleRequest(req);
        }

        return new Response('Not Found', { status: 404 });
      },
    });

    console.error(`Flux MCP server running on http://localhost:${httpServer.port}/mcp`);
  } else {
    // Default stdio mode
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Flux MCP server running on stdio');
  }
}

main().catch(console.error);
