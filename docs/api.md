# API Endpoints

## Authentication

The API uses Bearer token authentication via `FLUX_API_KEY` environment variable.

- **GET/HEAD requests** are public (readonly)
- **All other methods** require `Authorization: Bearer <FLUX_API_KEY>` header
- If `FLUX_API_KEY` is not set, all requests are allowed (dev mode)

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
| GET | `/api/tasks/ready` | List ready tasks (unblocked, not done, sorted by priority) |
| GET | `/api/webhooks` | List all webhooks |
| POST | `/api/webhooks` | Create webhook |
| GET | `/api/webhooks/:id` | Get webhook |
| PATCH | `/api/webhooks/:id` | Update webhook |
| DELETE | `/api/webhooks/:id` | Delete webhook |
| POST | `/api/webhooks/:id/test` | Test webhook delivery |
| GET | `/api/webhooks/:id/deliveries` | Get delivery history |

## Task Object

Tasks support the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique task identifier |
| `title` | string | Task title (required) |
| `status` | string | Task status: `planning`, `todo`, `in_progress`, `done` |
| `project_id` | string | Project ID (required) |
| `epic_id` | string | Optional epic assignment |
| `priority` | number | Optional priority: `0` (P0-urgent), `1` (P1-normal), `2` (P2-low). Defaults to 1. |
| `depends_on` | string[] | Array of task IDs this task depends on |
| `blocked_reason` | string | Optional external blocker reason (e.g., "Waiting for API key") |
| `acceptance_criteria` | string[] | Observable outcomes for verification |
| `guardrails` | object[] | Behavioral constraints (higher number = more critical) |
| `comments` | object[] | Task comments (author, body, timestamp) |
| `archived` | boolean | Whether task is archived |
| `created_at` | string | ISO timestamp |
| `updated_at` | string | ISO timestamp |

### Priority Sorting

Tasks are sorted by priority in the following order:
1. **P0 (value: 0)** - Urgent/Critical tasks
2. **P1 (value: 1)** - Normal priority tasks (default)
3. **P2 (value: 2)** - Low priority tasks
4. **No priority** - Treated as P1

The `/api/tasks/ready` endpoint returns tasks sorted by priority (P0 first, then P1, then P2), then by creation date (older first).

### Example: Create Task with Priority

```bash
POST /api/projects/:projectId/tasks
Content-Type: application/json

{
  "title": "Fix critical security vulnerability",
  "epic_id": "abc123",
  "priority": 0,
  "acceptance_criteria": [
    "Vulnerability patched and tested",
    "Security audit passes"
  ]
}
```

### Example: Update Task Priority

```bash
PATCH /api/tasks/:taskId
Content-Type: application/json

{
  "priority": 2,
  "blocked_reason": null
}
```
