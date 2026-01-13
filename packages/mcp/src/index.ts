#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { join } from 'path';
import {
  setStorageAdapter,
  initStore,
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
  getWebhooks,
  getWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  STATUSES,
  WEBHOOK_EVENT_TYPES,
  type WebhookEventType,
} from '@flux/shared';
import { createAdapter } from '@flux/shared/adapters';

// Data file path - configurable via FLUX_DATA env var
const DATA_FILE = process.env.FLUX_DATA || join(process.cwd(), '.flux/data.json');

// Initialize storage
const adapter = createAdapter(DATA_FILE);
setStorageAdapter(adapter);
initStore();

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
  const projects = getProjects();
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
    const projects = getProjects().map(p => ({
      ...p,
      stats: getProjectStats(p.id),
    }));
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
    const project = getProject(projectMatch[1]);
    if (!project) {
      throw new Error(`Project not found: ${projectMatch[1]}`);
    }
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ ...project, stats: getProjectStats(project.id) }, null, 2),
        },
      ],
    };
  }

  // Match flux://projects/:id/epics
  const epicsMatch = uri.match(/^flux:\/\/projects\/([^/]+)\/epics$/);
  if (epicsMatch) {
    const epics = getEpics(epicsMatch[1]);
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
    const tasks = getTasks(tasksMatch[1]).map(t => ({
      ...t,
      blocked: isTaskBlocked(t.id),
    }));
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
        name: 'create_task',
        description: 'Create a new task in a project. Use add_task_comment to add notes.',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID' },
            title: { type: 'string', description: 'Task title' },
            epic_id: { type: 'string', description: 'Optional: assign to epic' },
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

  // Re-read data to get latest state (in case web app made changes)
  adapter.read();

  switch (name) {
    // Project operations
    case 'list_projects': {
      const projects = getProjects().map(p => ({
        ...p,
        stats: getProjectStats(p.id),
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
      };
    }

    case 'create_project': {
      const project = createProject(args?.name as string, args?.description as string);
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
      const project = updateProject(args?.project_id as string, updates);
      if (!project) {
        return { content: [{ type: 'text', text: 'Project not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Updated project: ${JSON.stringify(project, null, 2)}` }],
      };
    }

    case 'delete_project': {
      deleteProject(args?.project_id as string);
      return {
        content: [{ type: 'text', text: `Deleted project ${args?.project_id}` }],
      };
    }

    // Epic operations
    case 'list_epics': {
      const epics = getEpics(args?.project_id as string);
      return {
        content: [{ type: 'text', text: JSON.stringify(epics, null, 2) }],
      };
    }

    case 'create_epic': {
      const epic = createEpic(
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
      const epic = updateEpic(args?.epic_id as string, updates);
      if (!epic) {
        return { content: [{ type: 'text', text: 'Epic not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Updated epic: ${JSON.stringify(epic, null, 2)}` }],
      };
    }

    case 'delete_epic': {
      const success = deleteEpic(args?.epic_id as string);
      if (!success) {
        return { content: [{ type: 'text', text: 'Epic not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Deleted epic ${args?.epic_id}` }],
      };
    }

    // Task operations
    case 'list_tasks': {
      let tasks = getTasks(args?.project_id as string).map(t => ({
        ...t,
        blocked: isTaskBlocked(t.id),
      }));

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

    case 'create_task': {
      const task = createTask(
        args?.project_id as string,
        args?.title as string,
        args?.epic_id as string
      );
      return {
        content: [{ type: 'text', text: `Created task "${task.title}" with ID: ${task.id}` }],
      };
    }

    case 'update_task': {
      // Validate workflow: tasks in 'planning' cannot go directly to 'in_progress'
      if (args?.status === 'in_progress') {
        const currentTask = getTask(args?.task_id as string);
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
      const task = updateTask(args?.task_id as string, updates);
      if (!task) {
        return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
      }
      return {
        content: [
          {
            type: 'text',
            text: `Updated task: ${JSON.stringify({ ...task, blocked: isTaskBlocked(task.id) }, null, 2)}`,
          },
        ],
      };
    }

    case 'delete_task': {
      const success = deleteTask(args?.task_id as string);
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
        const currentTask = getTask(args?.task_id as string);
        if (currentTask?.status === 'planning') {
          return {
            content: [{ type: 'text', text: 'Cannot start a task that is still in planning. Move the task to "todo" first.' }],
            isError: true,
          };
        }
      }
      const task = updateTask(args?.task_id as string, { status: args?.status as string });
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
      const comment = addTaskComment(args?.task_id as string, body, author);
      if (!comment) {
        return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Added comment ${comment.id}` }],
      };
    }

    case 'delete_task_comment': {
      const success = deleteTaskComment(args?.task_id as string, args?.comment_id as string);
      if (!success) {
        return { content: [{ type: 'text', text: 'Comment not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Deleted comment ${args?.comment_id}` }],
      };
    }

    // Webhook operations
    case 'list_webhooks': {
      const webhooks = getWebhooks();
      return {
        content: [{ type: 'text', text: JSON.stringify(webhooks, null, 2) }],
      };
    }

    case 'create_webhook': {
      const webhook = createWebhook(
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

      const webhook = updateWebhook(args?.webhook_id as string, updates);
      if (!webhook) {
        return { content: [{ type: 'text', text: 'Webhook not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Updated webhook: ${JSON.stringify(webhook, null, 2)}` }],
      };
    }

    case 'delete_webhook': {
      const success = deleteWebhook(args?.webhook_id as string);
      if (!success) {
        return { content: [{ type: 'text', text: 'Webhook not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Deleted webhook ${args?.webhook_id}` }],
      };
    }

    case 'list_webhook_deliveries': {
      const limit = (args?.limit as number) || 20;
      const deliveries = getWebhookDeliveries(args?.webhook_id as string, limit);
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Flux MCP server running on stdio');
}

main().catch(console.error);
