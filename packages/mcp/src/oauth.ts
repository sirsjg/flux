import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

/**
 * A minimal OAuth 2.1 authorization server + resource server for MCP HTTP mode.
 *
 * Exists because MCP clients that connect from a vendor's infrastructure
 * (Claude Cowork, claude.ai custom connectors) can only authenticate over
 * OAuth - they have no way to send a static `FLUX_MCP_TOKEN` bearer. Without
 * this the only way to expose /mcp publicly is unauthenticated.
 *
 * Implements the pieces MCP clients actually discover and use:
 *   - RFC 9728 protected resource metadata
 *   - RFC 8414 authorization server metadata
 *   - RFC 7591 dynamic client registration
 *   - authorization code grant with PKCE (S256), plus refresh tokens
 *
 * The resource owner authenticates with a single shared secret
 * (FLUX_MCP_PASSWORD). Issued tokens grant access to the MCP endpoint; calls
 * to Flux itself still use the server's configured FLUX_API_KEY, so this
 * gates *reaching* the endpoint rather than changing Flux's own permissions.
 */

const CODE_TTL_MS = 60_000;
const ACCESS_TTL_MS = 60 * 60 * 1000;

export type OAuthConfig = {
  /** Shared secret the human enters on the consent screen. */
  password: string;
  /** Public origin (e.g. https://mcp.example.com). Derived per-request if unset. */
  publicUrl?: string;
  /** File to persist clients and refresh tokens across restarts. null = memory only. */
  storePath?: string | null;
};

type Client = {
  client_id: string;
  client_secret?: string;
  client_name?: string;
  redirect_uris: string[];
};

type AuthCode = {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  resource?: string;
  expires_at: number;
};

type AccessToken = { client_id: string; expires_at: number };

type PersistedState = {
  clients: Client[];
  refresh_tokens: [string, string][];
};

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomToken(): string {
  return b64url(randomBytes(32));
}

function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      // Discovery documents are fetched cross-origin by MCP clients.
      'Access-Control-Allow-Origin': '*',
      ...headers,
    },
  });
}

function oauthError(error: string, description: string, status = 400): Response {
  return json({ error, error_description: description }, status);
}

export type OAuthProvider = {
  /** Handle an OAuth endpoint. Returns null when the path is not ours. */
  handle(req: Request, baseUrl: string): Promise<Response | null>;
  /** True when the bearer token is a live access token. */
  verify(token: string): boolean;
  /** Value for the WWW-Authenticate header on a 401 from /mcp. */
  challenge(baseUrl: string): string;
};

export function createOAuthProvider(config: OAuthConfig): OAuthProvider {
  const clients = new Map<string, Client>();
  const codes = new Map<string, AuthCode>();
  const accessTokens = new Map<string, AccessToken>();
  const refreshTokens = new Map<string, string>(); // refresh token -> client_id

  const storePath = config.storePath ?? null;

  function persist(): void {
    if (!storePath) return;
    const state: PersistedState = {
      clients: [...clients.values()],
      refresh_tokens: [...refreshTokens.entries()],
    };
    try {
      mkdirSync(dirname(storePath), { recursive: true });
      const tmp = `${storePath}.tmp`;
      writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
      renameSync(tmp, storePath);
    } catch (err) {
      console.error('OAuth: failed to persist state:', err);
    }
  }

  function restore(): void {
    if (!storePath || !existsSync(storePath)) return;
    try {
      const state = JSON.parse(readFileSync(storePath, 'utf-8')) as PersistedState;
      for (const c of state.clients || []) clients.set(c.client_id, c);
      for (const [token, clientId] of state.refresh_tokens || []) refreshTokens.set(token, clientId);
    } catch (err) {
      console.error('OAuth: failed to restore state:', err);
    }
  }

  restore();

  function sweep(): void {
    const now = Date.now();
    for (const [code, entry] of codes) if (entry.expires_at <= now) codes.delete(code);
    for (const [token, entry] of accessTokens) if (entry.expires_at <= now) accessTokens.delete(token);
  }

  function issueTokens(clientId: string): Record<string, unknown> {
    const accessToken = randomToken();
    const refreshToken = randomToken();
    accessTokens.set(accessToken, { client_id: clientId, expires_at: Date.now() + ACCESS_TTL_MS });
    refreshTokens.set(refreshToken, clientId);
    persist();
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor(ACCESS_TTL_MS / 1000),
      refresh_token: refreshToken,
    };
  }

  function renderConsent(params: URLSearchParams, error?: string): Response {
    // Every parameter the POST handler re-validates must be carried through the
    // form, or submitting the consent screen fails on a value the client did
    // send in the original GET.
    const fields = [
      'response_type',
      'client_id',
      'redirect_uri',
      'state',
      'code_challenge',
      'code_challenge_method',
      'scope',
      'resource',
    ]
      .map((name) => {
        const value = params.get(name);
        return value === null ? '' : `<input type="hidden" name="${name}" value="${escapeHtml(value)}" />`;
      })
      .join('\n      ');

    const client = clients.get(params.get('client_id') || '');
    const clientName = escapeHtml(client?.client_name || 'An MCP client');

    return new Response(
      `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize Flux MCP</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, sans-serif; display: grid; place-items: center;
           min-height: 100vh; margin: 0; background: #0f172a; color: #e2e8f0; }
    .card { width: min(26rem, 92vw); background: #1e293b; padding: 2rem;
            border-radius: 0.75rem; box-shadow: 0 10px 30px rgb(0 0 0 / 0.35); }
    h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
    p { color: #94a3b8; font-size: 0.875rem; margin: 0 0 1.5rem; }
    label { display: block; font-size: 0.875rem; margin-bottom: 0.5rem; }
    input[type=password] { width: 100%; padding: 0.625rem; border-radius: 0.375rem;
      border: 1px solid #334155; background: #0f172a; color: inherit; box-sizing: border-box; }
    button { width: 100%; margin-top: 1.25rem; padding: 0.625rem; border: 0;
      border-radius: 0.375rem; background: #6366f1; color: white; font-weight: 600; cursor: pointer; }
    .error { color: #fca5a5; font-size: 0.875rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize Flux</h1>
    <p>${clientName} is requesting access to your Flux board.</p>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    <form method="POST">
      ${fields}
      <label for="password">Access password</label>
      <input id="password" type="password" name="password" autocomplete="current-password" required autofocus />
      <button type="submit">Authorize</button>
    </form>
  </div>
</body>
</html>`,
      { status: error ? 401 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
    );
  }

  function validateAuthorizeParams(params: URLSearchParams): { error: Response } | { client: Client; redirectUri: string } {
    const clientId = params.get('client_id');
    if (!clientId) return { error: oauthError('invalid_request', 'client_id is required') };

    const client = clients.get(clientId);
    if (!client) return { error: oauthError('invalid_client', 'Unknown client_id') };

    const redirectUri = params.get('redirect_uri');
    if (!redirectUri) return { error: oauthError('invalid_request', 'redirect_uri is required') };
    // Exact match only - prevents redirecting the code to an attacker.
    if (!client.redirect_uris.includes(redirectUri)) {
      return { error: oauthError('invalid_request', 'redirect_uri does not match a registered URI') };
    }

    if (params.get('response_type') !== 'code') {
      return { error: oauthError('unsupported_response_type', 'Only response_type=code is supported') };
    }
    if (!params.get('code_challenge')) {
      return { error: oauthError('invalid_request', 'PKCE code_challenge is required') };
    }
    if ((params.get('code_challenge_method') || 'plain') !== 'S256') {
      return { error: oauthError('invalid_request', 'Only code_challenge_method=S256 is supported') };
    }

    return { client, redirectUri };
  }

  return {
    challenge(baseUrl: string): string {
      return `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`;
    },

    verify(token: string): boolean {
      sweep();
      const entry = accessTokens.get(token);
      return !!entry && entry.expires_at > Date.now();
    },

    async handle(req: Request, baseUrl: string): Promise<Response | null> {
      const url = new URL(req.url);
      const path = url.pathname;

      // CORS preflight for browser-side MCP clients.
      if (req.method === 'OPTIONS' && (path === '/register' || path === '/token')) {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Protocol-Version',
          },
        });
      }

      // ---- RFC 9728: protected resource metadata ----
      // Clients probe both the bare path and the resource-suffixed variant.
      if (path === '/.well-known/oauth-protected-resource' || path === '/.well-known/oauth-protected-resource/mcp') {
        return json({
          resource: `${baseUrl}/mcp`,
          authorization_servers: [baseUrl],
          bearer_methods_supported: ['header'],
        });
      }

      // ---- RFC 8414: authorization server metadata ----
      if (path === '/.well-known/oauth-authorization-server' || path === '/.well-known/oauth-authorization-server/mcp') {
        return json({
          issuer: baseUrl,
          authorization_endpoint: `${baseUrl}/authorize`,
          token_endpoint: `${baseUrl}/token`,
          registration_endpoint: `${baseUrl}/register`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
          scopes_supported: ['flux'],
        });
      }

      // ---- RFC 7591: dynamic client registration ----
      if (path === '/register') {
        if (req.method !== 'POST') return oauthError('invalid_request', 'POST required', 405);

        let body: Record<string, unknown>;
        try {
          body = (await req.json()) as Record<string, unknown>;
        } catch {
          return oauthError('invalid_request', 'Body must be JSON');
        }

        const redirectUris = body.redirect_uris;
        if (!Array.isArray(redirectUris) || redirectUris.length === 0 || !redirectUris.every((u) => typeof u === 'string')) {
          return oauthError('invalid_redirect_uri', 'redirect_uris must be a non-empty array of strings');
        }

        const client: Client = {
          client_id: b64url(randomBytes(16)),
          client_name: typeof body.client_name === 'string' ? body.client_name : undefined,
          redirect_uris: redirectUris as string[],
        };
        clients.set(client.client_id, client);
        persist();

        return json(
          {
            client_id: client.client_id,
            client_name: client.client_name,
            redirect_uris: client.redirect_uris,
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
          },
          201
        );
      }

      // ---- Authorization endpoint ----
      if (path === '/authorize') {
        sweep();

        if (req.method === 'GET') {
          const check = validateAuthorizeParams(url.searchParams);
          if ('error' in check) return check.error;
          return renderConsent(url.searchParams);
        }

        if (req.method === 'POST') {
          const form = new URLSearchParams(await req.text());
          const check = validateAuthorizeParams(form);
          if ('error' in check) return check.error;

          const password = form.get('password') || '';
          if (!safeCompare(password, config.password)) {
            return renderConsent(form, 'Incorrect password.');
          }

          const code = randomToken();
          codes.set(code, {
            client_id: check.client.client_id,
            redirect_uri: check.redirectUri,
            code_challenge: form.get('code_challenge')!,
            resource: form.get('resource') || undefined,
            expires_at: Date.now() + CODE_TTL_MS,
          });

          const target = new URL(check.redirectUri);
          target.searchParams.set('code', code);
          const state = form.get('state');
          if (state) target.searchParams.set('state', state);

          return new Response(null, { status: 302, headers: { Location: target.toString(), 'Cache-Control': 'no-store' } });
        }

        return oauthError('invalid_request', 'GET or POST required', 405);
      }

      // ---- Token endpoint ----
      if (path === '/token') {
        if (req.method !== 'POST') return oauthError('invalid_request', 'POST required', 405);
        sweep();

        const form = new URLSearchParams(await req.text());
        const grantType = form.get('grant_type');

        if (grantType === 'authorization_code') {
          const code = form.get('code');
          if (!code) return oauthError('invalid_request', 'code is required');

          const entry = codes.get(code);
          // Single use: consume regardless of outcome.
          codes.delete(code);
          if (!entry || entry.expires_at <= Date.now()) {
            return oauthError('invalid_grant', 'Authorization code is invalid or expired');
          }
          if (form.get('client_id') !== entry.client_id) {
            return oauthError('invalid_grant', 'client_id does not match the authorization code');
          }
          if (form.get('redirect_uri') !== entry.redirect_uri) {
            return oauthError('invalid_grant', 'redirect_uri does not match the authorization request');
          }

          const verifier = form.get('code_verifier');
          if (!verifier) return oauthError('invalid_request', 'code_verifier is required');
          const digest = b64url(createHash('sha256').update(verifier).digest());
          if (!safeCompare(digest, entry.code_challenge)) {
            return oauthError('invalid_grant', 'PKCE verification failed');
          }

          return json(issueTokens(entry.client_id));
        }

        if (grantType === 'refresh_token') {
          const token = form.get('refresh_token');
          if (!token) return oauthError('invalid_request', 'refresh_token is required');

          const clientId = refreshTokens.get(token);
          if (!clientId) return oauthError('invalid_grant', 'Refresh token is invalid');
          // Rotate: a refresh token is good for exactly one use.
          refreshTokens.delete(token);

          return json(issueTokens(clientId));
        }

        return oauthError('unsupported_grant_type', `Unsupported grant_type: ${grantType ?? 'none'}`);
      }

      return null;
    },
  };
}

/** Resolve the public origin, preferring an explicit override over proxy headers. */
export function resolveBaseUrl(req: Request, override?: string): string {
  if (override) return override.replace(/\/+$/, '');
  const url = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host;
  return `${proto}://${host}`;
}

/** Default location for persisted OAuth state. */
export function defaultStorePath(fluxDir: string): string {
  return join(fluxDir, 'mcp-oauth.json');
}
