import { createHash, randomBytes } from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setStorageAdapter, initStore, type StoreWithWebhooks } from '@flux/shared';
import { initClient } from '@flux/shared/client';
import { createServer } from '../src/server.js';
import { startHttpServer, type HttpServerHandle } from '../src/http.js';
import { createOAuthProvider } from '../src/oauth.js';

function memoryAdapter() {
  const data: StoreWithWebhooks = { projects: [], epics: [], tasks: [] };
  return { data, read: () => {}, write: () => {} };
}

const PASSWORD = 'consent-password';
const REDIRECT = 'http://localhost:9999/callback';

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pkce() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

const INITIALIZE = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
});

describe('MCP OAuth', () => {
  let handle: HttpServerHandle | null = null;
  let base = '';
  const originalToken = process.env.FLUX_MCP_TOKEN;

  beforeEach(() => {
    setStorageAdapter(memoryAdapter());
    initStore();
    initClient();
    delete process.env.FLUX_MCP_TOKEN;
    const oauth = createOAuthProvider({ password: PASSWORD, storePath: null });
    handle = startHttpServer(createServer, 0, oauth);
    base = `http://localhost:${handle.port}`;
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

  async function register(): Promise<string> {
    const res = await fetch(`${base}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Test Client', redirect_uris: [REDIRECT] }),
    });
    return (await res.json()).client_id;
  }

  async function authorize(clientId: string, challenge: string): Promise<string> {
    const body = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'state-value',
      password: PASSWORD,
    });
    const res = await fetch(`${base}/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      redirect: 'manual',
    });
    const location = new URL(res.headers.get('location')!);
    return location.searchParams.get('code')!;
  }

  async function exchange(clientId: string, code: string, verifier: string) {
    const res = await fetch(`${base}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        redirect_uri: REDIRECT,
        code_verifier: verifier,
      }),
    });
    return { status: res.status, body: await res.json() };
  }

  it('advertises protected resource metadata on a 401', async () => {
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: INITIALIZE,
    });

    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata=');
  });

  it('serves RFC 9728 protected resource metadata', async () => {
    const res = await fetch(`${base}/.well-known/oauth-protected-resource`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.resource).toBe(`${base}/mcp`);
    expect(body.authorization_servers).toEqual([base]);
  });

  it('serves RFC 8414 authorization server metadata', async () => {
    const res = await fetch(`${base}/.well-known/oauth-authorization-server`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.issuer).toBe(base);
    expect(body.code_challenge_methods_supported).toEqual(['S256']);
    expect(body.registration_endpoint).toBe(`${base}/register`);
  });

  it('registers a client dynamically', async () => {
    const res = await fetch(`${base}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Test Client', redirect_uris: [REDIRECT] }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.client_id).toBeTruthy();
    expect(body.redirect_uris).toEqual([REDIRECT]);
  });

  it('rejects registration without redirect_uris', async () => {
    const res = await fetch(`${base}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Test Client' }),
    });

    expect(res.status).toBe(400);
  });

  it('completes the authorization code flow and accepts the token', async () => {
    const clientId = await register();
    const { verifier, challenge } = pkce();
    const code = await authorize(clientId, challenge);

    const { status, body } = await exchange(clientId, code, verifier);
    expect(status).toBe(200);
    expect(body.token_type).toBe('Bearer');
    expect(body.access_token).toBeTruthy();

    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${body.access_token}`,
      },
      body: INITIALIZE,
    });
    expect(res.status).toBe(200);
  });

  it('rejects an unregistered redirect_uri', async () => {
    const clientId = await register();
    const { challenge } = pkce();
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: 'http://attacker.example/callback',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    const res = await fetch(`${base}/authorize?${query}`);
    expect(res.status).toBe(400);
  });

  it('requires PKCE', async () => {
    const clientId = await register();
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT,
    });

    const res = await fetch(`${base}/authorize?${query}`);
    expect(res.status).toBe(400);
  });

  it('rejects the wrong consent password', async () => {
    const clientId = await register();
    const { challenge } = pkce();
    const res = await fetch(`${base}/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: REDIRECT,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        password: 'wrong-password',
      }),
      redirect: 'manual',
    });

    expect(res.status).toBe(401);
  });

  it('rejects a mismatched PKCE verifier', async () => {
    const clientId = await register();
    const { challenge } = pkce();
    const code = await authorize(clientId, challenge);

    const { status } = await exchange(clientId, code, b64url(randomBytes(32)));
    expect(status).toBe(400);
  });

  it('only allows an authorization code to be used once', async () => {
    const clientId = await register();
    const { verifier, challenge } = pkce();
    const code = await authorize(clientId, challenge);

    expect((await exchange(clientId, code, verifier)).status).toBe(200);
    expect((await exchange(clientId, code, verifier)).status).toBe(400);
  });

  it('rotates refresh tokens', async () => {
    const clientId = await register();
    const { verifier, challenge } = pkce();
    const code = await authorize(clientId, challenge);
    const first = (await exchange(clientId, code, verifier)).body;

    const refresh = async (token: string) =>
      fetch(`${base}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token, client_id: clientId }),
      });

    const res = await refresh(first.refresh_token);
    expect(res.status).toBe(200);
    expect((await res.json()).access_token).not.toBe(first.access_token);

    // The consumed refresh token must not work a second time.
    expect((await refresh(first.refresh_token)).status).toBe(400);
  });

  it('rejects an unknown bearer token', async () => {
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer not-a-real-token',
      },
      body: INITIALIZE,
    });

    expect(res.status).toBe(401);
  });

  it('still accepts a static FLUX_MCP_TOKEN alongside OAuth', async () => {
    handle?.stop();
    process.env.FLUX_MCP_TOKEN = 'static-token';
    const oauth = createOAuthProvider({ password: PASSWORD, storePath: null });
    handle = startHttpServer(createServer, 0, oauth);
    base = `http://localhost:${handle.port}`;

    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer static-token',
      },
      body: INITIALIZE,
    });

    expect(res.status).toBe(200);
  });
});
