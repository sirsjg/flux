import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { setStorageAdapter, initStore, type StoreWithWebhooks } from '@flux/shared';
import { initClient } from '@flux/shared/client';
import { createFilesystemBlobStorage, setBlobStorage } from '@flux/shared/blob-storage';
import { createServer } from '../src/server.js';

function memoryAdapter(initial?: Partial<StoreWithWebhooks>) {
  const data: StoreWithWebhooks = {
    projects: [],
    epics: [],
    tasks: [],
    ...initial,
  };
  return { data, read: () => {}, write: () => {} };
}

async function connectClient(): Promise<Client> {
  const server = createServer();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

type ToolResult = {
  content: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

async function callTool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as ToolResult;
}

describe('flux MCP server', () => {
  let tempDir: string;

  beforeEach(() => {
    setStorageAdapter(memoryAdapter());
    initStore();
    initClient(); // local mode
    tempDir = mkdtempSync(join(tmpdir(), 'flux-mcp-test-'));
    setBlobStorage(createFilesystemBlobStorage(join(tempDir, 'blobs')));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes all 25 tools with schemas and annotations', async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();

    expect(names).toEqual(
      [
        'list_projects', 'create_project', 'update_project', 'delete_project',
        'list_epics', 'create_epic', 'update_epic', 'delete_epic',
        'list_tasks', 'list_ready_tasks', 'create_task', 'update_task',
        'delete_task', 'move_task_status', 'add_task_comment', 'delete_task_comment',
        'list_webhooks', 'create_webhook', 'update_webhook', 'delete_webhook',
        'list_webhook_deliveries',
        'blob_attach', 'blob_get', 'blob_list', 'blob_delete',
      ].sort()
    );

    const listTasks = tools.find((t) => t.name === 'list_tasks')!;
    expect(listTasks.annotations?.readOnlyHint).toBe(true);
    expect(listTasks.inputSchema.properties).toHaveProperty('project_id');
    expect(listTasks.outputSchema).toBeDefined();

    const deleteProject = tools.find((t) => t.name === 'delete_project')!;
    expect(deleteProject.annotations?.destructiveHint).toBe(true);
  });

  it('lists projects with structured content', async () => {
    const client = await connectClient();
    const result = await callTool(client, 'list_projects');
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ projects: [] });
  });

  it('creates and lists a project', async () => {
    const client = await connectClient();
    const created = await callTool(client, 'create_project', {
      name: 'Test Project',
      description: 'A test',
    });
    expect(created.isError).toBeFalsy();
    const project = (created.structuredContent as { project: { id: string; name: string } }).project;
    expect(project.name).toBe('Test Project');
    expect(created.content[0].text).toContain(project.id);

    const listed = await callTool(client, 'list_projects');
    const projects = (listed.structuredContent as { projects: Array<{ id: string; stats: unknown }> }).projects;
    expect(projects.length).toBe(1);
    expect(projects[0].id).toBe(project.id);
    expect(projects[0].stats).toBeDefined();
  });

  it('rejects invalid tool input', async () => {
    const client = await connectClient();
    const result = await callTool(client, 'create_project', {}); // missing required name
    expect(result.isError).toBe(true);
    expect(result.content[0].text?.toLowerCase()).toContain('invalid');
  });

  it('enforces the planning → todo → in_progress workflow', async () => {
    const client = await connectClient();
    const created = await callTool(client, 'create_project', { name: 'P' });
    const projectId = (created.structuredContent as { project: { id: string } }).project.id;

    const taskResult = await callTool(client, 'create_task', {
      project_id: projectId,
      title: 'My task',
      priority: 0,
    });
    const task = (taskResult.structuredContent as { task: { id: string; status: string; priority: number } }).task;
    expect(task.status).toBe('planning');
    expect(task.priority).toBe(0);

    // planning → in_progress is rejected
    const blocked = await callTool(client, 'move_task_status', {
      task_id: task.id,
      status: 'in_progress',
    });
    expect(blocked.isError).toBe(true);

    // planning → todo → in_progress works, with worker tracking
    await callTool(client, 'move_task_status', { task_id: task.id, status: 'todo' });
    const started = await callTool(client, 'move_task_status', {
      task_id: task.id,
      status: 'in_progress',
      agent_name: 'claude',
    });
    const startedTask = (started.structuredContent as { task: { status: string; workers?: string[] } }).task;
    expect(startedTask.status).toBe('in_progress');
    expect(startedTask.workers).toEqual(['claude']);

    // done clears workers
    const done = await callTool(client, 'move_task_status', { task_id: task.id, status: 'done' });
    const doneTask = (done.structuredContent as { task: { workers?: string[] } }).task;
    expect(doneTask.workers).toEqual([]);
  });

  it('lists ready tasks respecting dependencies', async () => {
    const client = await connectClient();
    const created = await callTool(client, 'create_project', { name: 'P' });
    const projectId = (created.structuredContent as { project: { id: string } }).project.id;

    const first = await callTool(client, 'create_task', { project_id: projectId, title: 'First' });
    const firstId = (first.structuredContent as { task: { id: string } }).task.id;
    await callTool(client, 'move_task_status', { task_id: firstId, status: 'todo' });

    const second = await callTool(client, 'create_task', {
      project_id: projectId,
      title: 'Second',
      depends_on: [firstId],
    });
    const secondId = (second.structuredContent as { task: { id: string } }).task.id;
    await callTool(client, 'move_task_status', { task_id: secondId, status: 'todo' });

    const ready = await callTool(client, 'list_ready_tasks', { project_id: projectId });
    const tasks = (ready.structuredContent as { tasks: Array<{ id: string }> }).tasks;
    expect(tasks.map((t) => t.id)).toContain(firstId);
    expect(tasks.map((t) => t.id)).not.toContain(secondId);
  });

  it('adds and deletes task comments', async () => {
    const client = await connectClient();
    const created = await callTool(client, 'create_project', { name: 'P' });
    const projectId = (created.structuredContent as { project: { id: string } }).project.id;
    const taskResult = await callTool(client, 'create_task', { project_id: projectId, title: 'T' });
    const taskId = (taskResult.structuredContent as { task: { id: string } }).task.id;

    const comment = await callTool(client, 'add_task_comment', {
      task_id: taskId,
      body: 'Progress note',
      agent_name: 'claude',
    });
    expect(comment.isError).toBeFalsy();
    const commentId = (comment.structuredContent as { comment: { id: string } }).comment.id;

    const deleted = await callTool(client, 'delete_task_comment', {
      task_id: taskId,
      comment_id: commentId,
    });
    expect(deleted.isError).toBeFalsy();
  });

  it('returns isError for missing entities', async () => {
    const client = await connectClient();
    const result = await callTool(client, 'update_task', { task_id: 'nope', title: 'x' });
    expect(result.isError).toBe(true);
  });

  it('serves resources including per-project templates', async () => {
    const client = await connectClient();
    const created = await callTool(client, 'create_project', { name: 'Resourceful' });
    const projectId = (created.structuredContent as { project: { id: string } }).project.id;

    const { resources } = await client.listResources();
    const uris = resources.map((r) => r.uri);
    expect(uris).toContain('flux://projects');
    expect(uris).toContain(`flux://projects/${projectId}`);
    expect(uris).toContain(`flux://projects/${projectId}/epics`);
    expect(uris).toContain(`flux://projects/${projectId}/tasks`);

    const all = await client.readResource({ uri: 'flux://projects' });
    const parsed = JSON.parse((all.contents[0] as { text: string }).text);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('Resourceful');

    const single = await client.readResource({ uri: `flux://projects/${projectId}` });
    const project = JSON.parse((single.contents[0] as { text: string }).text);
    expect(project.id).toBe(projectId);
    expect(project.stats).toBeDefined();
  });

  it('exposes prompts', async () => {
    const client = await connectClient();
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual(['project_status', 'whats_next']);

    const prompt = await client.getPrompt({
      name: 'whats_next',
      arguments: { project_id: 'proj-1' },
    });
    const text = (prompt.messages[0].content as { text: string }).text;
    expect(text).toContain('list_ready_tasks');
    expect(text).toContain('proj-1');
  });

  it('attaches, lists, gets, and deletes blobs', async () => {
    const client = await connectClient();
    const created = await callTool(client, 'create_project', { name: 'P' });
    const projectId = (created.structuredContent as { project: { id: string } }).project.id;
    const taskResult = await callTool(client, 'create_task', { project_id: projectId, title: 'T' });
    const taskId = (taskResult.structuredContent as { task: { id: string } }).task.id;

    const filePath = join(tempDir, 'note.md');
    writeFileSync(filePath, '# hello');

    const attached = await callTool(client, 'blob_attach', { task_id: taskId, file_path: filePath });
    expect(attached.isError).toBeFalsy();
    const blobId = (attached.structuredContent as { blob_id: string }).blob_id;

    const listed = await callTool(client, 'blob_list', { task_id: taskId });
    const blobs = (listed.structuredContent as { blobs: Array<{ id: string; mime_type: string }> }).blobs;
    expect(blobs.length).toBe(1);
    expect(blobs[0].mime_type).toBe('text/markdown');

    const got = await callTool(client, 'blob_get', { blob_id: blobId });
    const content = (got.structuredContent as { content_base64: string }).content_base64;
    expect(Buffer.from(content, 'base64').toString()).toBe('# hello');

    const deleted = await callTool(client, 'blob_delete', { blob_id: blobId });
    expect(deleted.isError).toBeFalsy();
  });
});
