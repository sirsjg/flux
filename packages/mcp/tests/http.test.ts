import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { setStorageAdapter, initStore, type StoreWithWebhooks } from '@flux/shared';
import { initClient } from '@flux/shared/client';
import { createServer } from '../src/server.js';
import { startHttpServer, type HttpServerHandle } from '../src/http.js';

function memoryAdapter() {
  const data: StoreWithWebhooks = { projects: [], epics: [], tasks: [] };
  return { data, read: () => {}, write: () => {} };
}

describe('HTTP transport', () => {
  let handle: HttpServerHandle | null = null;
  const originalToken = process.env.FLUX_MCP_TOKEN;

  beforeEach(() => {
    setStorageAdapter(memoryAdapter());
    initStore();
    initClient();
  });

  afterEach(() => {
    handle?.stop();
    handle = null;
    if (originalToken) {
      process.env.FLUX_MCP_TOKEN = originalToken;
    } else {
      delete process.env.FLUX_MCP_TOKEN;
    }
  });

  it('serves /health without auth', async () => {
    process.env.FLUX_MCP_TOKEN = 'secret-token';
    handle = startHttpServer(createServer, 0);

    const res = await fetch(`http://localhost:${handle.port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('rejects /mcp requests without a bearer token when FLUX_MCP_TOKEN is set', async () => {
    process.env.FLUX_MCP_TOKEN = 'secret-token';
    handle = startHttpServer(createServer, 0);

    const res = await fetch(`http://localhost:${handle.port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1, params: {} }),
    });
    expect(res.status).toBe(401);
  });

  it('completes a full session with a valid bearer token', async () => {
    process.env.FLUX_MCP_TOKEN = 'secret-token';
    handle = startHttpServer(createServer, 0);

    const transport = new StreamableHTTPClientTransport(new URL(`http://localhost:${handle.port}/mcp`), {
      requestInit: { headers: { Authorization: 'Bearer secret-token' } },
    });
    const client = new Client({ name: 'http-test', version: '1.0.0' });
    await client.connect(transport);

    const { tools } = await client.listTools();
    expect(tools.length).toBe(25);

    const result = await client.callTool({ name: 'list_projects', arguments: {} });
    expect((result as { structuredContent: unknown }).structuredContent).toEqual({ projects: [] });

    await client.close();
  });

  it('allows unauthenticated sessions when no token is configured', async () => {
    delete process.env.FLUX_MCP_TOKEN;
    handle = startHttpServer(createServer, 0);

    const transport = new StreamableHTTPClientTransport(new URL(`http://localhost:${handle.port}/mcp`));
    const client = new Client({ name: 'http-test', version: '1.0.0' });
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.length).toBe(25);
    await client.close();
  });
});
