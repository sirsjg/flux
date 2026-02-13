#!/usr/bin/env bun
/**
 * Test: Verify agents can see each other's changes
 * Simulates 2 separate MCP processes (docker exec) where Agent 2 creates a task
 * and Agent 1 should immediately see it
 */

const PROJECT_ID = '0gcsjpp';

console.log('🧪 Testing cross-agent visibility with MCP\n');

// Helper to call MCP
async function callMCP(toolName: string, args: any) {
  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: toolName, arguments: args }
  });
  
  const proc = Bun.spawn(['docker', 'exec', '-i', 'flux-web', 'bun', 'packages/mcp/dist/index.js'], {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  
  proc.stdin.write(request);
  proc.stdin.end();
  
  const output = await new Response(proc.stdout).text();
  const lines = output.trim().split('\n');
  const jsonLine = lines[lines.length - 1];
  
  try {
    return JSON.parse(jsonLine);
  } catch (e) {
    console.error('Failed to parse MCP response:', jsonLine);
    throw e;
  }
}

// Agent 1: Get initial task count
console.log('[Agent 1] Listing tasks (initial)...');
const initialResponse = await callMCP('list_tasks', { project_id: PROJECT_ID });
const initialTasks = JSON.parse(initialResponse.result.content[0].text);
const initialCount = initialTasks.length;
console.log(`[Agent 1] Initial task count: ${initialCount}\n`);

// Agent 2: Create a new task (separate MCP process)
console.log('[Agent 2] Creating task (separate MCP process)...');
const taskTitle = `Test task ${Date.now()}`;
const createResponse = await callMCP('create_task', {
  project_id: PROJECT_ID,
  title: taskTitle,
});
console.log(`[Agent 2] ${createResponse.result.content[0].text}\n`);

// Extract task ID from response
const taskIdMatch = createResponse.result.content[0].text.match(/ID: (\w+)/);
const createdTaskId = taskIdMatch ? taskIdMatch[1] : null;

// Agent 1: List tasks again (separate MCP process - should see Agent 2's task)
console.log('[Agent 1] Listing tasks again (separate MCP process)...');
const finalResponse = await callMCP('list_tasks', { project_id: PROJECT_ID });
const finalTasks = JSON.parse(finalResponse.result.content[0].text);
const finalCount = finalTasks.length;
console.log(`[Agent 1] Final task count: ${finalCount}\n`);

// Verify
const foundTask = createdTaskId ? finalTasks.find((t: any) => t.id === createdTaskId) : null;

console.log('📊 Results:');
console.log(`  Initial count: ${initialCount}`);
console.log(`  Final count:   ${finalCount}`);
console.log(`  Expected:      ${initialCount + 1}`);
console.log(`  Task visible:  ${foundTask ? '✅ YES' : '❌ NO'}\n`);

if (finalCount === initialCount + 1 && foundTask) {
  console.log('✅ SUCCESS: Agent 1 sees Agent 2\'s task immediately!');
  console.log('   Fix verified: db.read() refreshes data on each MCP call');
  process.exit(0);
} else {
  console.log('❌ FAILED: Agent 1 has stale data');
  console.log('   Expected to see new task but didn\'t');
  process.exit(1);
}
