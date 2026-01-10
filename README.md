# Flux &middot; [![CI](https://github.com/sirsjg/flux/actions/workflows/ci.yml/badge.svg)](https://github.com/sirsjg/flux/actions/workflows/ci.yml) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) ![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat&logo=typescript&logoColor=white) ![Preact](https://img.shields.io/badge/Preact-673ab8?style=flat&logo=preact&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js_21+-339933?style=flat&logo=node.js&logoColor=white) ![pnpm](https://img.shields.io/badge/pnpm-f69220?style=flat&logo=pnpm&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2496ed?style=flat&logo=docker&logoColor=white) ![MCP](https://img.shields.io/badge/MCP-enabled-f59e0b?style=flat)

> Flux is a **completely open, hackable, unopinionated task management engine**.

<p align="center">
  <img src="./docs/kibo-mascot.png" width="220" />
</p>

Flux is your ultimate task management sidekick – a lightning-fast Kanban board that lets humans, AI agents, and automations team up to crush chaos. With built-in MCP (Model Context Protocol) integration, your LLMs can jump in and run the show: creating tasks, updating statuses, and keeping everything in sync. No more rigid workflows or SaaS lock-in – just pure, flexible productivity magic! ✨

Why settle for boring task trackers when you can enter the Flux Zone? Inspired by the wild energy of a flux capacitor (hello, Back to the Future fans!), this open-source gem decouples tasks from execution, making it the perfect playground for developers, teams, and AI enthusiasts. Ready to go viral? Star this repo and let's make task management fun again! ⭐

![Demo](./docs/demo.gif)

## Why Flux? Because Chaos is So Last Year 😎

Ever felt like your projects are a tangled mess of tools, bots, and half-baked ideas? Flux fixes that by being:

- **Execution-Agnostic**: Tasks live here, but how they get done? That's up to you – manual, API, webhooks, or let Claude/GPT take the wheel.
- **AI-Powered Awesomeness**: Hook up your LLMs via MCP and watch them automate the mundane. "Hey AI, create a task for fixing that bug!" – Done. 🤖
- **Simple & Speedy**: Single-file SQLite backend, drag-and-drop UI, real-time updates. No bloat, just flow.

Flux isn't just another Kanban board – it's the open-source engine for the future of work. Developers love it because it's hackable, extensible, and screams "build on me!" If you're tinkering with AI agents or just need a better way to organize, this is your ticket to productivity paradise.

<p align="center">
  <img src="./docs/sample-workflow.png" alt="Sample workflow" />
  <br />
  <em>Sample workflow</em>
</p>

## Features That'll Make You Say "whoa" 🔥

- 🚀 **Multi-Project Kanban Boards**: Juggle epics, tasks, and dependencies like a pro.
- 🔗 **Task Dependencies**: See what's blocked at a glance – no more surprises!
- 🤖 **MCP Integration**: Let LLMs list, create, update, or delete tasks programmatically.
- 📡 **Real-Time Updates**: SSE keeps everyone in sync – web UI, APIs, and beyond.
- 🪝 **Webhooks Galore**: Integrate with Slack, GitHub, CI/CD – trigger actions on task changes.
- 📱 **API-First Design**: Full REST endpoints for ultimate control.
- 💾 **SQLite Simplicity**: All data in one file, with JSON import for easy starts.

## Quick Start: Up and Running in a Flux Second ⚡

```bash
# macOS/Linux
curl -fsSL https://raw.githubusercontent.com/sirsjg/flux/main/scripts/quickstart.sh | bash

## Windows (PowerShell)
irm https://raw.githubusercontent.com/sirsjg/flux/main/scripts/quickstart.ps1 | iex
```

This will start both the web UI ([http://localhost:3000](http://localhost:3000)) and the MCP server. Press Ctrl+C to stop the MCP server when you're done.

```bash
# Claude Code
claude mcp add flux -- docker run -i --rm -v flux-data:/app/packages/data flux-mcp

# Codex
codex mcp add flux -- docker run -i --rm -v flux-data:/app/packages/data flux-mcp
```

Let your agent know!

```bash
cat << 'EOF' >> AGENTS.md
---
You are an autonomous agent using Flux for task management.

RULES:
- All work MUST belong to exactly one project_id.
- You MUST NOT guess or invent a project_id.
- You MUST NOT switch projects without explicit instruction.

STARTUP (MANDATORY):
1. List projects.
2. Select or create ONE project.
3. Confirm the active project_id before any work.

EXECUTION:
- Include project_id in EVERY Flux call.
- Track all work as tasks.
- Update task status as work progresses.
- Close tasks immediately when complete.

CONTEXT LOSS:
- If unsure of project_id, STOP.
- Re-list projects and tasks.
- Ask the user if ambiguity remains.

FORBIDDEN:
- Working without a confirmed project_id.
- Mixing tasks across projects.
- Relying on memory outside Flux.

If these rules cannot be followed, halt and request clarification.
EOF
```
---

## Installation (Docker)

Docker is the recommended way to run Flux. Build the image first:

```bash
docker build -t flux-mcp .
```

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "flux": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-v", "flux-data:/app/packages/data", "flux-mcp"]
    }
  }
}
```

Restart Claude Desktop after saving.

### Web Interface

Run the web server:

```bash
docker run -d -p 3000:3000 -v flux-data:/app/packages/data --name flux-web flux-mcp node packages/server/dist/index.js
```

Open http://localhost:3000

The web UI and MCP server share the same data volume, so changes made via Claude appear instantly in the web interface.

### Using a Local Directory for Data

To store data in a specific folder instead of a Docker volume:

```bash
mkdir -p ~/flux-data

# For Claude Desktop/Code config, use:
docker run -i --rm -v ~/flux-data:/app/packages/data flux-mcp

# For web UI:
docker run -d -p 3000:3000 -v ~/flux-data:/app/packages/data --name flux-web flux-mcp node packages/server/dist/index.js
```

## Installation (From Source)

### Prerequisites

- Node.js 21+
- pnpm 10+

### Setup

```bash
pnpm install
pnpm build
```

### Running

```bash
pnpm --filter @flux/server start
```

Visit http://localhost:3000

### Development Mode

```bash
# Terminal 1: API server with hot reload
pnpm --filter @flux/server dev

# Terminal 2: Web dev server with HMR
pnpm --filter @flux/web dev
```

Web UI will be at http://localhost:5173 (proxies API to :3000)

### MCP with Local Install

Add to Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "flux": {
      "command": "node",
      "args": ["/path/to/flux/packages/mcp/dist/index.js"]
    }
  }
}
```

For Claude Code:

```bash
# Claude Code
claude mcp add flux -- node /path/to/flux/packages/mcp/dist/index.js

# Codex
codex mcp add flux -- node /path/to/flux/packages/mcp/dist/index.js
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `list_projects` | List all projects with stats |
| `create_project` | Create a new project |
| `update_project` | Update project details |
| `delete_project` | Delete a project and all its data |
| `list_epics` | List epics in a project |
| `create_epic` | Create a new epic |
| `update_epic` | Update epic details/status/dependencies |
| `delete_epic` | Delete an epic |
| `list_tasks` | List tasks (with optional filters) |
| `create_task` | Create a new task |
| `update_task` | Update task details/status/dependencies |
| `delete_task` | Delete a task |
| `move_task_status` | Quick status change (todo/doing/done) |

## MCP Resources

| URI | Description |
|-----|-------------|
| `flux://projects` | All projects with stats |
| `flux://projects/:id` | Single project details |
| `flux://projects/:id/epics` | All epics in a project |
| `flux://projects/:id/tasks` | All tasks in a project |

## Project Structure

```
packages/
  shared/   - Shared types and store logic
  web/      - Preact frontend with DaisyUI
  server/   - Hono API server
  mcp/      - MCP server for LLM integration
```

## Data Storage

All data is stored in `packages/data/flux.sqlite`. This file is shared between the web UI and MCP server, so changes made via either interface are immediately visible in both. If `packages/data/flux.json` exists on first run, Flux imports it into SQLite and removes the JSON file.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
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
| GET | `/api/webhooks` | List all webhooks |
| POST | `/api/webhooks` | Create webhook |
| GET | `/api/webhooks/:id` | Get webhook |
| PATCH | `/api/webhooks/:id` | Update webhook |
| DELETE | `/api/webhooks/:id` | Delete webhook |
| POST | `/api/webhooks/:id/test` | Test webhook delivery |
| GET | `/api/webhooks/:id/deliveries` | Get delivery history |

## Webhooks

Webhooks allow Flux to push real-time notifications to external services when events occur. This makes Flux a great control center for automations like notifying Slack, creating GitHub issues, updating CI status, or triggering other workflows whenever work moves on the board.

### Managing Webhooks

**Via Web UI:** Click the "Webhooks" button in the navigation bar to access the webhook management page.

**Via MCP:** Use the `create_webhook`, `list_webhooks`, `update_webhook`, and `delete_webhook` tools.

**Via API:** Use the webhook REST endpoints listed above.

### Webhook Events

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

### Webhook Payload

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

### Webhook Headers

Each webhook request includes these headers:

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `User-Agent` | `Flux-Webhook/1.0` |
| `X-Flux-Event` | The event type (e.g., `task.created`) |
| `X-Flux-Delivery` | Unique webhook ID |
| `X-Flux-Timestamp` | ISO timestamp of the event |
| `X-Flux-Signature` | HMAC-SHA256 signature (if secret configured) |

### Signature Verification

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

### Retry Behavior

If a webhook delivery fails (non-2xx response or network error), Flux will retry up to 3 times with exponential backoff:
- 1st retry: after 1 second
- 2nd retry: after 5 seconds
- 3rd retry: after 30 seconds

### Example: Slack Integration

Create a webhook to post task updates to Slack:

1. Create a Slack Incoming Webhook at https://api.slack.com/messaging/webhooks
2. In Flux, create a webhook with:
   - URL: Your Slack webhook URL
   - Events: `task.status_changed`
3. Create a simple proxy/transformer service, or use Slack Workflow Builder to format the message

### MCP Webhook Tools

| Tool | Description |
|------|-------------|
| `list_webhooks` | List all configured webhooks |
| `create_webhook` | Create a new webhook |
| `update_webhook` | Update webhook configuration |
| `delete_webhook` | Delete a webhook |
| `list_webhook_deliveries` | View recent delivery attempts |

## Tech Stack

- **Frontend:** Preact, TypeScript, Tailwind CSS, DaisyUI, @dnd-kit
- **Backend:** Hono, Node.js
- **Data:** SQLite (single-file persistence)
- **MCP:** @modelcontextprotocol/sdk
- **Build:** Vite, pnpm workspaces

## Roadmap

| Status | Feature | Description |
|--------|---------|-------------|
| ✅ | Server-Sent Events (SSE) | Real-time updates for web while MCP is making changes |
| ✅ | Webhooks | Push task/epic/project events to other tools in real time |
| ✅ | Planning Phase | Add planning to Kanban for ideation phase |
| | Concurrency | Shared single-file SQLite is still a coordination point; concurrent writers are safer than JSON, but we may need conflict-aware merges for heavy multi-agent use |
| ✅ | Tests | Better coverage |
| ✅ | SQLite | Wire into storage abstraction instead of flat file |

## Contributing

Flux is early and moving quickly. If you want to help shape it, contributions are welcome.
Open an issue for ideas and bugs, or pick something from the roadmap and send a PR.

## License

MIT
