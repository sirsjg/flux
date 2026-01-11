# Roadmap

| Status | Feature | Description |
|--------|---------|-------------|
| ✅ | Server-Sent Events (SSE) | Real-time updates for web while MCP is making changes |
| ✅ | Webhooks | Push task/epic/project events to other tools in real time |
| ✅ | Planning Phase | Add planning to Kanban for ideation phase |
| | Concurrency | Shared single-file SQLite is still a coordination point; concurrent writers are safer than JSON, but we may need conflict-aware merges for heavy multi-agent use |
| ✅ | Tests | Better coverage |
| ✅ | SQLite | Wire into storage abstraction instead of flat file |
