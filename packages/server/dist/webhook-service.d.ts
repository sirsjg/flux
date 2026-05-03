import type { Webhook, WebhookPayload, WebhookEventType } from '@flux/shared';
export declare function handleWebhookEvent(event: WebhookEventType, payload: WebhookPayload, webhook: Webhook): Promise<void>;
export declare function getRecentDeliveries(webhookId?: string, limit?: number): import("@flux/shared").WebhookDelivery[];
export declare function testWebhookDelivery(webhook: Webhook): Promise<{
    success: boolean;
    statusCode?: number;
    body?: string;
    error?: string;
}>;
