#!/usr/bin/env bun
/**
 * Test: Stale reads with separate MCP processes
 * Demonstrates that Agent 1 can't see tasks created by Agent 2
 */

import { createSqliteAdapter } from '/app/packages/shared/dist/adapters/sqlite-adapter.js';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB = '/tmp/flux-stale-read-test.sqlite';

if (existsSync(TEST_DB)) unlinkSync(TEST_DB);

console.log('🧪 Testing stale reads with separate MCP processes\n');

// Agent 1: Starts MCP server, reads DB once
console.log('[Agent 1] Starting MCP server...');
const agent1Adapter = createSqliteAdapter(TEST_DB);
agent1Adapter.read();
agent1Adapter.data.projects = [{ id: 'test-project', name: 'Test' }];
agent1Adapter.data.tasks = [];
agent1Adapter.write();
console.log(`[Agent 1] Initial read: ${agent1Adapter.data.tasks.length} tasks\n`);

// Agent 2: Starts separate MCP server, creates a task
console.log('[Agent 2] Starting separate MCP server...');
const agent2Adapter = createSqliteAdapter(TEST_DB);
agent2Adapter.read();
console.log(`[Agent 2] Initial read: ${agent2Adapter.data.tasks.length} tasks`);

agent2Adapter.data.tasks.push({
  id: 'task-1',
  title: 'Task created by Agent 2',
  status: 'todo',
  depends_on: [],
  comments: [],
  project_id: 'test-project',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});
agent2Adapter.write();
console.log(`[Agent 2] Created task, wrote to DB\n`);

// Agent 1: Tries to list tasks (WITHOUT re-reading)
console.log('[Agent 1] Listing tasks (using in-memory state)...');
console.log(`[Agent 1] Sees: ${agent1Adapter.data.tasks.length} tasks`);
console.log(`[Agent 1] ❌ Can't see Agent 2's task!\n`);

// Agent 1: Re-reads from DB
console.log('[Agent 1] Re-reading from DB...');
agent1Adapter.read();
console.log(`[Agent 1] After re-read: ${agent1Adapter.data.tasks.length} tasks`);
console.log(`[Agent 1] ✅ Now sees Agent 2's task!\n`);

console.log('📊 Summary:');
console.log('- Without db.read(): Agent 1 has stale data');
console.log('- With db.read(): Agent 1 sees fresh data');
console.log('\n💡 Fix: Call db.read() before each read operation in MCP handlers');

unlinkSync(TEST_DB);
