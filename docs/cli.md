# CLI Reference

The Flux CLI provides full task management from the terminal, with MCP parity.

## Installation

```bash
# From source
cd packages/cli && bun run build && bun link

# Via Docker
docker run -it --rm -v flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite flux-mcp flux
```

## Storage Modes

The CLI supports three storage modes:

### Local File (default)
```bash
flux init           # Creates .flux/data.json
flux project list   # Uses local data
```

### SQLite (via FLUX_DATA)
```bash
FLUX_DATA=.flux/data.sqlite flux project list
```

### Server/Hosted API
Connect to any Flux server (local or remote):

```bash
# Connect to hosted instance
flux init --server https://flux.example.com

# Or local server
flux init --server http://localhost:3000

# All commands now use the API
flux project list   # → GET /api/projects
flux task create proj_abc "New task"  # → POST /api/projects/proj_abc/tasks
```

Server mode stores the URL in `.flux/config.json`. The CLI works identically regardless of mode - all commands are transparently routed to the configured backend.

## Commands

### Initialization

```bash
flux init                    # Interactive setup (JSON storage)
flux init --sqlite           # Use SQLite storage
flux init --server URL       # Connect to server
flux init --git              # Use git sync (default)
flux init --no-agents        # Skip AGENTS.md update
```

Config is stored in `.flux/config.json` and can be committed to share with your team.

### Projects

```bash
flux project list                        # List all projects
flux project create <name>               # Create project
flux project update <id> --name <n>      # Rename project
flux project delete <id>                 # Delete project
```

### Epics

```bash
flux epic list <project>                 # List epics in project
flux epic create <project> <title>       # Create epic
flux epic update <id> --title <t>        # Update epic
flux epic update <id> --status done      # Change status
flux epic delete <id>                    # Delete epic
```

### Tasks

```bash
flux task list <project>                 # List tasks
flux task list <project> --epic <id>     # Filter by epic
flux task list <project> --status todo   # Filter by status

flux task create <project> <title>       # Create task
flux task create <project> <title> -e <epic> -P 0  # With epic and priority

flux task update <id> --title <t>        # Update title
flux task update <id> --status in_progress
flux task update <id> --epic <epic_id>   # Assign to epic
flux task update <id> --note "context"   # Add note

flux task start <id>                     # Mark in_progress
flux task done <id>                      # Mark done
flux task done <id> --note "completed"   # Done with note

flux task delete <id>                    # Delete task
```

### Quick Commands

```bash
flux ready                   # Show unblocked tasks sorted by priority
flux ready --json            # JSON output
flux show <id>               # Show task details with comments
```

### Data Sync

**Git-based sync** (for teams):
```bash
flux pull                    # Pull from flux-data branch
flux push                    # Push to flux-data branch
flux push "commit message"   # Push with custom message
```

**Export/Import**:
```bash
flux export                  # Print JSON to stdout
flux export -o backup.json   # Export to file
flux import backup.json      # Import (replace)
flux import backup.json --merge  # Import (merge)
cat data.json | flux import -    # Import from stdin
```

### Local Server

Start a local Flux server with Web UI + API:

```bash
flux serve                     # Uses config or defaults to .flux/data.json
flux serve -p 8080             # Custom port
flux serve --data path.json    # Override with JSON file
flux serve --data path.sqlite  # Override with SQLite file
```

Reads `.flux/config.json` to determine storage backend. Serves both the web dashboard and REST API.

## Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |
| `-P, --priority` | Priority: 0 (P0), 1 (P1), 2 (P2) |
| `-e, --epic` | Epic ID |
| `--note` | Add note/comment |
| `--status` | Filter or set status |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FLUX_DIR` | Override .flux directory location |
| `FLUX_DATA` | Data file path (`.sqlite`/`.db` for SQLite) |

## Examples

```bash
# Quick workflow
flux init
flux project create "My Project"
flux task create proj_abc "Fix login bug" -P 0
flux task start task_xyz
flux task done task_xyz --note "Fixed by adding null check"

# Agent workflow
flux ready --json | jq '.[0]'  # Get next task
flux task start task_123
flux task done task_123

# Team sync
flux pull
flux task create proj_abc "New feature"
flux push "added new feature task"
```
