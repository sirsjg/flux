#!/usr/bin/env bun
/**
 * Reproduction script for SQLite race condition issue
 * https://github.com/sirsjg/flux/issues/60
 * 
 * This demonstrates the data loss bug with concurrent writes.
 * Run with the OLD adapter code to see the bug, or with the FIX to see it resolved.
 * 
 * Usage:
 *   bun reproduce-race-condition.ts
 */

import { Database } from 'bun:sqlite';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB = '/tmp/flux-race-reproduction.sqlite';

// OLD ADAPTER (buggy - loses data)
function createOldAdapter(filePath: string) {
  const db = new Database(filePath, { create: true });
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('CREATE TABLE IF NOT EXISTS store (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)');

  const selectStmt = db.prepare('SELECT data FROM store WHERE id = 1');
  const insertStmt = db.prepare('INSERT INTO store (id, data) VALUES (1, ?)');
  const updateStmt = db.prepare('UPDATE store SET data = ? WHERE id = 1');

  let _data: any = { tasks: [] };

  return {
    get data() { return _data; },
    read() {
      const row = selectStmt.get() as { data?: string } | null;
      if (row?.data) {
        _data = JSON.parse(row.data);
      }
      if (!selectStmt.get()) {
        insertStmt.run(JSON.stringify(_data));
      }
    },
    write() {
      // BUG: No merge, just overwrites
      const serialized = JSON.stringify(_data);
      const row = selectStmt.get();
      if (row) {
        updateStmt.run(serialized);
      } else {
        insertStmt.run(serialized);
      }
    },
  };
}

// FIXED ADAPTER (merges concurrent changes)
function createFixedAdapter(filePath: string) {
  const db = new Database(filePath, { create: true });
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('CREATE TABLE IF NOT EXISTS store (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)');

  const selectStmt = db.prepare('SELECT data FROM store WHERE id = 1');
  const insertStmt = db.prepare('INSERT INTO store (id, data) VALUES (1, ?)');
  const updateStmt = db.prepare('UPDATE store SET data = ? WHERE id = 1');

  let _data: any = { tasks: [] };

  const readFromDb = () => {
    const row = selectStmt.get() as { data?: string } | null;
    return row?.data ? JSON.parse(row.data) : { tasks: [] };
  };

  const mergeById = (current: any[], updated: any[]) => {
    const result = new Map();
    for (const item of current) result.set(item.id, item);
    for (const item of updated) result.set(item.id, item);
    return Array.from(result.values());
  };

  return {
    get data() { return _data; },
    read() {
      _data = readFromDb();
      if (!selectStmt.get()) {
        insertStmt.run(JSON.stringify(_data));
      }
    },
    write() {
      // FIX: Merge with current state inside transaction
      db.transaction(() => {
        const current = readFromDb();
        const merged = {
          tasks: mergeById(current.tasks, _data.tasks),
        };
        const serialized = JSON.stringify(merged);
        const row = selectStmt.get();
        if (row) {
          updateStmt.run(serialized);
        } else {
          insertStmt.run(serialized);
        }
        _data = merged;
      })();
    },
  };
}

async function testAdapter(name: string, createAdapter: (path: string) => any) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log('='.repeat(60));

  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);

  // Initialize
  const init = createAdapter(TEST_DB);
  init.read();
  init.data.tasks = [];
  init.write();

  // Simulate 3 agents each creating 10 tasks concurrently
  async function createTask(agentId: string, taskNum: number) {
    const adapter = createAdapter(TEST_DB);
    adapter.read();
    
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    
    adapter.data.tasks.push({
      id: `${agentId}-task-${taskNum}`,
      title: `Task ${taskNum} from ${agentId}`,
    });
    
    adapter.write();
  }

  const startTime = Date.now();
  const writes = [];
  for (let i = 0; i < 10; i++) {
    writes.push(
      createTask('agent-A', i),
      createTask('agent-B', i),
      createTask('agent-C', i)
    );
  }
  await Promise.all(writes);
  const duration = Date.now() - startTime;

  // Check results
  const final = createAdapter(TEST_DB);
  final.read();
  const total = final.data.tasks.length;
  const expected = 30;
  const lost = expected - total;

  console.log(`\nResults:`);
  console.log(`  Duration: ${duration}ms`);
  console.log(`  Expected: ${expected} tasks`);
  console.log(`  Actual:   ${total} tasks`);
  console.log(`  Lost:     ${lost} tasks (${Math.round(lost/expected*100)}%)`);

  if (lost > 0) {
    console.log(`\n  ❌ FAILED: Data loss detected!`);
    
    const byAgent = {
      A: final.data.tasks.filter((t: any) => t.id.startsWith('agent-A')).length,
      B: final.data.tasks.filter((t: any) => t.id.startsWith('agent-B')).length,
      C: final.data.tasks.filter((t: any) => t.id.startsWith('agent-C')).length,
    };
    console.log(`\n  Tasks by agent:`);
    console.log(`    Agent A: ${byAgent.A}/10`);
    console.log(`    Agent B: ${byAgent.B}/10`);
    console.log(`    Agent C: ${byAgent.C}/10`);
  } else {
    console.log(`\n  ✅ PASSED: All tasks saved!`);
  }

  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  return lost === 0;
}

async function main() {
  console.log('Flux SQLite Race Condition Reproduction');
  console.log('Issue: https://github.com/sirsjg/flux/issues/60\n');
  console.log('This script demonstrates the data loss bug with concurrent writes.');
  console.log('Running 30 concurrent writes (3 agents × 10 tasks each)...');

  const oldPassed = await testAdapter('OLD ADAPTER (buggy)', createOldAdapter);
  const fixedPassed = await testAdapter('FIXED ADAPTER (with merge)', createFixedAdapter);

  console.log(`\n${'='.repeat(60)}`);
  console.log('Summary:');
  console.log(`  OLD adapter:   ${oldPassed ? '✅ PASS' : '❌ FAIL (expected - demonstrates bug)'}`);
  console.log(`  FIXED adapter: ${fixedPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(60));

  if (!oldPassed && fixedPassed) {
    console.log('\n✅ Reproduction successful! Bug demonstrated and fix verified.');
  }
}

main();
