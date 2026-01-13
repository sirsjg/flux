import { createHmac } from 'crypto';
import type { Webhook, WebhookPayload, WebhookEventType } from '@flux/shared';
import {
  createWebhookDelivery,
  updateWebhookDelivery,
  getWebhookDeliveries,
} from '@flux/shared';

// Webhook delivery configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 30000]; // 1s, 5s, 30s
const DELIVERY_TIMEOUT = 10000; // 10 seconds

// Generate HMAC signature for payload
function generateSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

// Deliver a webhook payload
async function deliverWebhook(
  webhook: Webhook,
  payload: WebhookPayload
): Promise<{ success: boolean; statusCode?: number; body?: string; error?: string }> {
  const payloadString = JSON.stringify(payload);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Flux-Webhook/1.0',
    'X-Flux-Event': payload.event,
    'X-Flux-Delivery': payload.webhook_id,
    'X-Flux-Timestamp': payload.timestamp,
  };

  // Add signature if secret is configured
  if (webhook.secret) {
    headers['X-Flux-Signature'] = `sha256=${generateSignature(payloadString, webhook.secret)}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT);

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const body = await response.text();

    return {
      success: response.ok,
      statusCode: response.status,
      body: body.substring(0, 1000), // Limit response body size
    };
  } catch (error) {
    clearTimeout(timeoutId);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Retry delivery with exponential backoff
async function deliverWithRetry(
  webhook: Webhook,
  payload: WebhookPayload,
  deliveryId: string,
  attempt: number = 0
): Promise<void> {
  const result = await deliverWebhook(webhook, payload);

  updateWebhookDelivery(deliveryId, {
    attempts: attempt + 1,
    response_code: result.statusCode,
    response_body: result.body,
    error: result.error,
  });

  if (result.success) {
    updateWebhookDelivery(deliveryId, {
      status: 'success',
      delivered_at: new Date().toISOString(),
    });
    return;
  }

  // Check if we should retry
  if (attempt < MAX_RETRIES - 1) {
    const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];

    setTimeout(() => {
      deliverWithRetry(webhook, payload, deliveryId, attempt + 1);
    }, delay);
  } else {
    // Max retries reached, mark as failed
    updateWebhookDelivery(deliveryId, {
      status: 'failed',
    });
  }
}

// Main webhook event handler
export async function handleWebhookEvent(
  event: WebhookEventType,
  payload: WebhookPayload,
  webhook: Webhook
): Promise<void> {
  // Create delivery record
  const delivery = createWebhookDelivery(webhook.id, event, payload);

  // Start delivery (async, don't await)
  deliverWithRetry(webhook, payload, delivery.id).catch(error => {
    console.error(`Webhook delivery error for ${webhook.id}:`, error);
    updateWebhookDelivery(delivery.id, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  });
}

// Get recent deliveries for a webhook
export function getRecentDeliveries(webhookId?: string, limit: number = 50) {
  return getWebhookDeliveries(webhookId, limit);
}

// Test a webhook by sending a test event
export async function testWebhookDelivery(webhook: Webhook): Promise<{
  success: boolean;
  statusCode?: number;
  body?: string;
  error?: string;
}> {
  const testPayload: WebhookPayload = {
    event: 'task.created',
    timestamp: new Date().toISOString(),
    webhook_id: webhook.id,
    data: {
      task: {
        id: 'test-task-id',
        title: 'Test Task',
        status: 'todo',
        depends_on: [],
        comments: [{ id: 'test', body: 'This is a test webhook delivery', author: 'user', created_at: new Date().toISOString() }],
        project_id: 'test-project-id',
      },
    },
  };

  return deliverWebhook(webhook, testPayload);
}
