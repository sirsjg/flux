# Flux &middot; [![CI](https://github.com/sirsjg/flux/actions/workflows/ci.yml/badge.svg)](https://github.com/sirsjg/flux/actions/workflows/ci.yml) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) ![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat&logo=typescript&logoColor=white) ![Preact](https://img.shields.io/badge/Preact-673ab8?style=flat&logo=preact&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js_21+-339933?style=flat&logo=node.js&logoColor=white) ![pnpm](https://img.shields.io/badge/pnpm-f69220?style=flat&logo=pnpm&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2496ed?style=flat&logo=docker&logoColor=white) ![MCP](https://img.shields.io/badge/MCP-enabled-f59e0b?style=flat)

Ship with less chaos. Flux is a fast, simple Kanban board with MCP integration so your LLMs can help run the show.

## Features

- **Multi-project support** - Manage multiple Kanban boards
- **Epics and Tasks** - Organize work with epics (swimlanes) and tasks
- **Dependencies** - Track task/epic dependencies with blocked indicators
- **Drag and drop** - Move tasks between columns and epics
- **Search and filters** - Find tasks by text, filter by epic or blocked status
- **MCP Server** - Allow LLMs to manage your Kanban board via Model Context Protocol

## Roadmap

- ✅ **Server-Sent Events (SSE)** - real-time updates for web while MCP is making changes.
- **Webhooks (up next)** - push task/epic/project events to other tools in real time. This makes Flux a great control center for automations like notifying Slack, creating GitHub issues, updating CI status, or triggering other workflows whenever work moves on the board.
- **Tests** - eek!

## Contributing

Flux is early and moving quickly. If you want to help shape it, contributions are welcome.
Open an issue for ideas and bugs, or pick something from the roadmap and send a PR.

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

### Claude Code

Add the MCP server:

```bash
claude mcp add flux -- docker run -i --rm -v flux-data:/app/packages/data flux-mcp
```

To share the configuration with your team (creates `.mcp.json`):

```bash
claude mcp add --scope project flux -- docker run -i --rm -v flux-data:/app/packages/data flux-mcp
```

Verify with `claude mcp list`.

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
claude mcp add flux -- node /path/to/flux/packages/mcp/dist/index.js
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

All data is stored in `packages/data/flux.json`. This file is shared between the web UI and MCP server, so changes made via either interface are immediately visible in both.

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

## Tech Stack

- **Frontend:** Preact, TypeScript, Tailwind CSS, DaisyUI, @dnd-kit
- **Backend:** Hono, Node.js
- **MCP:** @modelcontextprotocol/sdk
- **Build:** Vite, pnpm workspaces

## License

MIT
