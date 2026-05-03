# Agent Activity Tracking — Design Spec

## Problem

Agents need to understand the full end-to-end process when they pick up work. Today they call `list_ready_tasks` and get a flat list — they have no visibility into which epics are in flight, what other agents are working on, what was recently completed, or how their task fits into the broader plan. Meanwhile, the human operator (Neil) has no single view showing "what is each agent doing right now and what have they accomplished."

Three specific gaps:

1. **No completion history.** `workers[]` is cleared when a task moves to `done`, so there's no record of who built what.
2. **No epic-level awareness.** Agents see individual tasks but not the epic they belong to or the epic's overall progress. They can't reason about "this epic is 80% done, I should finish the remaining 2 tasks."
3. **No cross-agent visibility.** An agent can't see what other agents are currently working on or recently completed. This leads to duplicate effort and poor coordination.

## Design

### 1. New field: `completed_by` on Task

```typescript
// types.ts — Task type addition
completed_by?: string;    // Agent name that completed this task (persists after done)
started_at?: string;      // ISO timestamp when task first moved to in_progress
completed_at?: string;    // ISO timestamp when task moved to done
```

When `move_task_status` sets status to `in_progress`:
- Set `started_at` to `new Date().toISOString()` (only if not already set)
- Add `agent_name` to `workers[]` (existing behavior)

When `move_task_status` sets status to `done`:
- Set `completed_by` to the current `agent_name` (or first worker if not provided)
- Set `completed_at` to `new Date().toISOString()`
- Clear `workers[]` (existing behavior)

### 2. New MCP tool: `get_epic_progress`

Returns a structured view of an epic's completion state with agent attribution.

```
Tool: get_epic_progress
Params: { epic_id: string }
Returns: {
  epic: { id, title, status, notes },
  total_tasks: number,
  by_status: { planning: number, todo: number, in_progress: number, done: number },
  active_workers: [{ agent_name: string, task_id: string, task_title: string, started_at: string }],
  recently_completed: [{ task_id: string, task_title: string, completed_by: string, completed_at: string }],
  remaining_work: [{ task_id: string, task_title: string, priority: number, blocked: boolean }],
  percent_complete: number
}
```

This gives an agent picking up work in an epic full situational awareness: what's done, who did it, what's in flight, and what remains.

### 3. New MCP tool: `get_agent_activity`

Returns what a specific agent (or all agents) are doing and have recently done.

```
Tool: get_agent_activity
Params: { agent_name?: string }  // omit for all agents
Returns: {
  agents: [{
    name: string,
    current_tasks: [{ task_id, title, epic_id, epic_title, started_at }],
    recent_completions: [{ task_id, title, epic_id, epic_title, completed_at }],  // last 24h
    stats: { completed_today: number, completed_this_week: number, in_progress: number }
  }]
}
```

### 4. New MCP tool: `get_project_overview`

High-level project status that an agent reads at the start of every cycle to orient itself.

```
Tool: get_project_overview
Params: { project_id: string }
Returns: {
  project: { id, name, description },
  epic_summary: [{
    id: string,
    title: string,
    total: number,
    done: number,
    in_progress: number,
    todo: number,
    percent_complete: number,
    active_agents: string[],     // agents with in_progress tasks in this epic
    wave: string                 // extracted from title, e.g. "LAUNCH-01"
  }],
  active_agents: [{
    name: string,
    current_task_count: number,
    epics_active_in: string[]    // epic IDs where they have in_progress tasks
  }],
  recently_completed_count: number,  // last 24h
  total_tasks: number,
  overall_percent_complete: number
}
```

### 5. Updated BOOT.md protocol

Add to the Execution Protocol for every agent:

```
STEP 0: Orient (BEFORE picking a task)
  Call flux__get_project_overview(project_id="obecno9").
  Read: which epics have active work, which agents are online, overall progress.
  
  Then call flux__get_epic_progress for the epic you intend to work in.
  Read: what's done, what's in flight, what's remaining.
  
  Pick your task from the remaining work in priority order.
```

### 6. Web UI: Agent Activity Dashboard

New route `/agents` in the Flux web app showing:

- **Agent cards**: One card per agent showing current task, time working, recent completions
- **Epic progress bars**: Horizontal bars per epic showing % complete with agent-colored segments
- **Activity timeline**: Vertical timeline showing task completions across all agents, chronologically
- **Heatmap**: Which epics each agent has contributed to (agent × epic grid with task counts)

### 7. Implementation Plan

#### Phase 1: Data model (sync-safe)
- Add `completed_by`, `started_at`, `completed_at` to Task type
- Update `move_task_status` in server and MCP to populate these fields
- These are additive fields — no migration needed, backward compatible

#### Phase 2: New MCP tools
- Implement `get_epic_progress`, `get_agent_activity`, `get_project_overview`
- These are read-only aggregations over existing data — no new storage needed

#### Phase 3: BOOT.md updates
- Add STEP 0 orient protocol to all agent BOOT.md files
- Update cron prompts to reference the new orientation step

#### Phase 4: Web UI
- Agent dashboard page at `/agents`
- Epic progress visualization on existing epic list view
- Activity timeline component

## Files to Change

### packages/shared/src/types.ts
- Add `completed_by?: string`, `started_at?: string`, `completed_at?: string` to Task

### packages/shared/src/store.ts
- No changes needed (fields are part of the Task JSON blob)

### packages/server/src/index.ts
- Update PATCH `/api/tasks/:id` to set `started_at` when moving to in_progress
- Update PATCH `/api/tasks/:id` to set `completed_by` and `completed_at` when moving to done
- Add GET `/api/projects/:projectId/epics/:epicId/progress` endpoint
- Add GET `/api/agents/activity` endpoint
- Add GET `/api/projects/:projectId/overview` endpoint

### packages/mcp/src/index.ts
- Update `move_task_status` handler to populate `completed_by`, `started_at`, `completed_at`
- Add `get_epic_progress` tool definition and handler
- Add `get_agent_activity` tool definition and handler
- Add `get_project_overview` tool definition and handler

### packages/server/dist/sync-routes.js & packages/shared/dist/sync-service.js
- Compiled versions — rebuild after source changes

### packages/web/src/
- New `AgentDashboard.tsx` page component
- Updated `EpicList` with progress bars
- New `ActivityTimeline.tsx` component
- Route addition in App.tsx

## Sync Considerations

All new fields are additive to the Task entity. The sync system already handles task updates via `applyTaskChange`. No changelog schema changes needed. The `completed_by`, `started_at`, and `completed_at` fields sync naturally as part of task update payloads.

The new API endpoints (`/epics/:id/progress`, `/agents/activity`, `/projects/:id/overview`) are read-only aggregations. They don't create new entity types, so no sync changes are needed — each node computes them from its local data.
