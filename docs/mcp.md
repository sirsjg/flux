# MCP

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
