# API Endpoints

## Authentication

The API uses Bearer token authentication. Keys come from the `FLUX_API_KEY`
environment variable and/or stored API keys created via `/api/auth/keys`.

The server runs in one of three modes:

| Mode | Condition | Behavior |
|------|-----------|----------|
| **Keys** | `FLUX_API_KEY` set or stored keys exist | GET/HEAD on public projects work anonymously; all other requests require `Authorization: Bearer <key>` |
| **Open** | No keys, `FLUX_ALLOW_ANONYMOUS=1` set | All requests allowed — only use on trusted networks |
| **Locked** | No keys, no opt-in (default) | All API requests rejected with 401 (except `GET /api/auth/status`) |

A fresh server with no configuration is **locked by default**. Set
`FLUX_API_KEY=<secret>` to enable authenticated access, or set
`FLUX_ALLOW_ANONYMOUS=1` to explicitly opt into open access.

Key scopes:

- **Server keys** (`FLUX_API_KEY` or stored server-scoped keys): full access, including webhooks, key management, and `/api/reset`
- **Project keys**: read/write limited to their `project_ids`; private projects outside that list return 404

Project visibility:

- Projects are **private by default**. A private project (and its epics, tasks,
  comments and blobs) returns 404 to unauthenticated clients, and its events are
  withheld from unauthorised SSE listeners.
- Pass `visibility: "public"` when creating or updating a project to make it
  readable without a key. Writes always require one.

Other security-related environment variables:

| Variable | Description |
|----------|-------------|
| `FLUX_ALLOW_ANONYMOUS` | Set to `1`/`true`/`yes` to allow keyless open access |
| `FLUX_CORS_ORIGINS` | Comma-separated list of additional allowed CORS origins. Localhost origins are always allowed; all others are rejected by default |
| `FLUX_MAX_BLOB_SIZE` | Max blob upload size in bytes (default 10 MB) |

All responses carry security headers (CSP, `X-Content-Type-Options`,
`X-Frame-Options`). Auth endpoints, blob uploads, and `/api/reset` are
rate-limited per client IP.

## Live Updates (SSE)

`GET /api/events` streams Server-Sent Events:

| Event | Payload | When |
|-------|---------|------|
| `connected` | `"ok"` | On connect — refresh to catch missed updates |
| `change` | `{event, project_id, project_name, title, status}` | On every API mutation. `event` is a webhook event type (`task.created`, `task.status_changed`, …) |
| `data-changed` | `{ts}` | Generic invalidation ping, e.g. when the CLI writes the data file directly |

`change` events are **scoped by auth**: clients only receive events for
projects they can read, and events without a project scope require server
access. Because `EventSource` cannot send an `Authorization` header, pass the
API key as a query parameter to receive events for private projects:

```
GET /api/events?token=<api-key>
```

The web UI uses `change` events to refresh only the affected board and to
drive opt-in browser notifications (bell icon on the board).

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project |
| PATCH | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/projects/:id/epics` | List epics |
| POST | `/api/projects/:id/epics` | Create epic |
| GET | `/api/epics/:id` | Get epic |
| PATCH | `/api/epics/:id` | Update epic |
| DELETE | `/api/epics/:id` | Delete epic |
| GET | `/api/projects/:id/tasks` | List tasks |
| POST | `/api/projects/:id/tasks` | Create task |
| GET | `/api/tasks/:id` | Get task |
| PATCH | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| GET | `/api/tasks/ready` | List ready tasks (unblocked, not done) |
| GET | `/api/webhooks` | List all webhooks |
| POST | `/api/webhooks` | Create webhook |
| GET | `/api/webhooks/:id` | Get webhook |
| PATCH | `/api/webhooks/:id` | Update webhook |
| DELETE | `/api/webhooks/:id` | Delete webhook |
| POST | `/api/webhooks/:id/test` | Test webhook delivery |
| GET | `/api/webhooks/:id/deliveries` | Get delivery history |
