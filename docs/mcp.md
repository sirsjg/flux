# MCP

## Remote Server Mode

The MCP server can connect to a remote Flux API instead of using local storage:

```bash
FLUX_SERVER=https://flux.example.com FLUX_API_KEY=your-key npx @flux/mcp
```

| Variable | Description |
|----------|-------------|
| `FLUX_SERVER` | Remote Flux server URL |
| `FLUX_API_KEY` | API key for write operations |

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
| `list_ready_tasks` | List ready tasks (unblocked, not done, sorted by priority) |
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
