# Webhooks

Webhooks allow Flux to push real-time notifications to external services when events occur. This makes Flux a great control center for automations like notifying Slack, creating GitHub issues, updating CI status, or triggering other workflows whenever work moves on the board.

## Managing Webhooks

**Via Web UI:** Click the "Webhooks" button in the navigation bar to access the webhook management page.

**Via MCP:** Use the `create_webhook`, `list_webhooks`, `update_webhook`, and `delete_webhook` tools.

**Via API:** Use the webhook REST endpoints listed in `docs/api.md`.

## Webhook Events

| Event | Description |
|-------|-------------|
| `project.created` | A new project was created |
| `project.updated` | A project was updated |
| `project.deleted` | A project was deleted |
| `epic.created` | A new epic was created |
| `epic.updated` | An epic was updated |
| `epic.deleted` | An epic was deleted |
| `task.created` | A new task was created |
| `task.updated` | A task was updated |
| `task.deleted` | A task was deleted |
| `task.status_changed` | A task moved between columns (todo/in_progress/done) |
| `task.archived` | A task was archived |

## Webhook Payload

When an event occurs, Flux sends a POST request to your webhook URL with this JSON structure:

```json
{
  "event": "task.status_changed",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "webhook_id": "abc123",
  "data": {
    "task": {
      "id": "task123",
      "title": "Implement feature",
      "status": "done",
      "project_id": "proj456",
      "epic_id": "epic789",
      "notes": "...",
      "depends_on": []
    },
    "previous": {
      "status": "in_progress"
    }
  }
}
```

## Webhook Headers

Each webhook request includes these headers:

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `User-Agent` | `Flux-Webhook/1.0` |
| `X-Flux-Event` | The event type (e.g., `task.created`) |
| `X-Flux-Delivery` | Unique webhook ID |
| `X-Flux-Timestamp` | ISO timestamp of the event |
| `X-Flux-Signature` | HMAC-SHA256 signature (if secret configured) |

## Signature Verification

If you configure a secret for your webhook, Flux will include an `X-Flux-Signature` header with each request. The signature is computed as:

```
sha256=HMAC-SHA256(secret, request_body)
```

Example verification in Node.js:

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

## Retry Behavior

If a webhook delivery fails (non-2xx response or network error), Flux will retry up to 3 times with exponential backoff:
- 1st retry: after 1 second
- 2nd retry: after 5 seconds
- 3rd retry: after 30 seconds

## Example: Slack Integration

Create a webhook to post task updates to Slack:

1. Create a Slack Incoming Webhook at https://api.slack.com/messaging/webhooks
2. In Flux, create a webhook with:
   - URL: Your Slack webhook URL
   - Events: `task.status_changed`
3. Create a simple proxy/transformer service, or use Slack Workflow Builder to format the message

## MCP Webhook Tools

| Tool | Description |
|------|-------------|
| `list_webhooks` | List all configured webhooks |
| `create_webhook` | Create a new webhook |
| `update_webhook` | Update webhook configuration |
| `delete_webhook` | Delete a webhook |
| `list_webhook_deliveries` | View recent delivery attempts |
