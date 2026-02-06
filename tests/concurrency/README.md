# Concurrency Tests

Tests for concurrent access issues when multiple agents/processes access Flux simultaneously.

## Issue Context

- **Issue:** [#60](https://github.com/sirsjg/flux/issues/60) - Data Loss with Concurrent MCP Writes
- **PR:** [#59](https://github.com/sirsjg/flux/pull/59) - Fix for race conditions and stale reads

## Tests

### `reproduce-race-condition.ts`

Standalone reproduction script demonstrating the race condition bug and verifying the fix.

**Usage:**
```bash
bun tests/concurrency/reproduce-race-condition.ts
```

**What it tests:**
- OLD adapter: 30 concurrent writes → 1 saved (97% loss)
- FIXED adapter: 30 concurrent writes → 30 saved (0% loss)

### `test-stale-reads.ts`

Demonstrates the stale read issue where agents can't see each other's changes.

**Usage:**
```bash
docker cp tests/concurrency/test-stale-reads.ts flux-web:/app/
docker exec -i flux-web bun /app/test-stale-reads.ts
```

**What it tests:**
- Agent 1 reads DB once at startup
- Agent 2 creates task
- Agent 1 can't see new task (without re-read)
- Agent 1 can see new task (after re-read)

### `test-cross-agent-visibility.ts`

End-to-end test verifying agents see each other's changes immediately.

**Usage:**
```bash
# Requires flux-web container running
bun tests/concurrency/test-cross-agent-visibility.ts
```

**What it tests:**
- Agent 1 lists tasks (initial count)
- Agent 2 creates task via MCP
- Agent 1 lists tasks again (should see +1)

## Running All Tests

```bash
# Unit tests (in packages/shared/tests/)
bun test packages/shared/tests/sqlite-concurrency.test.ts

# Integration tests (this directory)
bun tests/concurrency/reproduce-race-condition.ts
docker exec -i flux-web bun /app/test-stale-reads.ts
```

## Issues Fixed

1. **Race Condition on Writes**
   - Multiple processes overwriting each other's changes
   - Fixed with transaction-based merge in SQLite adapter

2. **Stale Reads**
   - Agents not seeing each other's changes
   - Fixed by calling `adapter.read()` before each MCP operation
