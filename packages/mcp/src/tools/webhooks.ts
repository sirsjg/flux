import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
} from '@flux/shared/client';
import { webhookDeliverySchema, webhookEventSchema, webhookSchema } from '../schemas.js';
import { errorResult, structuredResult, textResult } from './util.js';

export function registerWebhookTools(server: McpServer): void {
  server.registerTool(
    'list_webhooks',
    {
      title: 'List Webhooks',
      description: 'List all configured webhooks',
      inputSchema: {},
      outputSchema: { webhooks: z.array(webhookSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const webhooks = await getWebhooks();
      return structuredResult({ webhooks });
    }
  );

  server.registerTool(
    'create_webhook',
    {
      title: 'Create Webhook',
      description: 'Create a new webhook to receive notifications when events occur',
      inputSchema: {
        name: z.string().describe('Webhook name for identification'),
        url: z.string().describe('URL to send webhook POST requests to'),
        events: z
          .array(webhookEventSchema)
          .describe('List of events to trigger this webhook (e.g., task.created, task.status_changed)'),
        secret: z.string().optional().describe('Optional secret for HMAC signature verification'),
        project_id: z.string().optional().describe('Optional: only trigger for this project'),
      },
      outputSchema: { webhook: webhookSchema },
      annotations: { openWorldHint: false },
    },
    async ({ name, url, events, secret, project_id }) => {
      const webhook = await createWebhook(name, url, events, { secret, project_id });
      return structuredResult({ webhook }, `Created webhook "${webhook.name}" with ID: ${webhook.id}`);
    }
  );

  server.registerTool(
    'update_webhook',
    {
      title: 'Update Webhook',
      description: 'Update an existing webhook configuration',
      inputSchema: {
        webhook_id: z.string().describe('Webhook ID to update'),
        name: z.string().optional().describe('New webhook name'),
        url: z.string().optional().describe('New URL to send webhook requests to'),
        events: z.array(webhookEventSchema).optional().describe('New list of events to trigger this webhook'),
        secret: z.string().optional().describe('New secret for signature verification (empty to clear)'),
        project_id: z.string().optional().describe('New project filter (empty to clear)'),
        enabled: z.boolean().optional().describe('Enable or disable the webhook'),
      },
      outputSchema: { webhook: webhookSchema },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ webhook_id, name, url, events, secret, project_id, enabled }) => {
      const updates: Record<string, unknown> = {};
      if (name) updates.name = name;
      if (url) updates.url = url;
      if (events) updates.events = events;
      if (secret !== undefined) updates.secret = secret || undefined;
      if (project_id !== undefined) updates.project_id = project_id || undefined;
      if (enabled !== undefined) updates.enabled = enabled;
      const webhook = await updateWebhook(webhook_id, updates);
      if (!webhook) return errorResult('Webhook not found');
      return structuredResult({ webhook }, `Updated webhook: ${JSON.stringify(webhook, null, 2)}`);
    }
  );

  server.registerTool(
    'delete_webhook',
    {
      title: 'Delete Webhook',
      description: 'Delete a webhook',
      inputSchema: {
        webhook_id: z.string().describe('Webhook ID to delete'),
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ webhook_id }) => {
      const success = await deleteWebhook(webhook_id);
      if (!success) return errorResult('Webhook not found');
      return textResult(`Deleted webhook ${webhook_id}`);
    }
  );

  server.registerTool(
    'list_webhook_deliveries',
    {
      title: 'List Webhook Deliveries',
      description: 'List recent webhook delivery attempts for a specific webhook',
      inputSchema: {
        webhook_id: z.string().describe('Webhook ID to get deliveries for'),
        limit: z.number().optional().describe('Maximum number of deliveries to return (default 20)'),
      },
      outputSchema: { deliveries: z.array(webhookDeliverySchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ webhook_id, limit }) => {
      const deliveries = await getWebhookDeliveries(webhook_id, limit || 20);
      return structuredResult({ deliveries });
    }
  );
}
