import { createMiddleware } from 'hono/factory';
import { timingSafeEqual } from 'crypto';
import { validateApiKey, hasApiKeys, getProject, getProjects } from '@flux/shared';
import type { ApiKey, KeyScope } from '@flux/shared';

// Read env vars dynamically to support testing
const getEnvKey = () => process.env.FLUX_API_KEY;

// Keyless (anonymous) full access must be explicitly opted into.
// Without this flag, a server with no keys configured rejects all API requests.
const isAnonymousAllowed = () => {
  const value = process.env.FLUX_ALLOW_ANONYMOUS?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
};

// Auth context attached to requests
export type AuthContext = {
  keyType: 'server' | 'project' | 'env' | 'anonymous';
  projectIds?: string[];  // For project-scoped keys
  apiKey?: ApiKey;        // The validated key record
};

// Timing-safe string comparison
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Auth middleware for Flux server.
 *
 * Access levels:
 * - FLUX_API_KEY env var: Full access (backwards compat)
 * - Stored server keys: Full access
 * - Stored project keys: Access to specific projects
 * - Anonymous: Read public projects only
 *
 * No keys configured: all requests are rejected unless FLUX_ALLOW_ANONYMOUS
 * is explicitly set, in which case all access is allowed (open mode).
 */
export const authMiddleware = createMiddleware<{ Variables: { auth: AuthContext } }>(async (c, next) => {
  const hasStoredKeys = hasApiKeys();
  const envKey = getEnvKey();

  // No keys configured at all
  if (!hasStoredKeys && !envKey) {
    if (isAnonymousAllowed()) {
      c.set('auth', { keyType: 'anonymous' });
      return next();
    }
    // Let clients discover that login is required without a key
    if (c.req.method === 'GET' && c.req.path === '/api/auth/status') {
      c.set('auth', { keyType: 'anonymous' });
      return next();
    }
    return c.json(
      {
        error:
          'Unauthorized: no API keys are configured. Set FLUX_API_KEY to enable authentication, ' +
          'or set FLUX_ALLOW_ANONYMOUS=1 to explicitly allow open access.',
      },
      401
    );
  }

  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // No token provided
  if (!token) {
    // GET/HEAD allowed for public projects (handled in route)
    if (c.req.method === 'GET' || c.req.method === 'HEAD') {
      c.set('auth', { keyType: 'anonymous' });
      return next();
    }
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const resolved = resolveTokenAuth(token);
  if (resolved) {
    c.set('auth', resolved);
    return next();
  }

  return c.json({ error: 'Unauthorized' }, 401);
});

/**
 * Resolve a raw bearer token to an auth context.
 * Used by the auth middleware and by transports that can't send headers
 * (e.g. EventSource passing ?token=).
 */
export function resolveTokenAuth(token: string): AuthContext | null {
  const envKey = getEnvKey();

  // Check env key first (backwards compat)
  if (envKey && safeCompare(token, envKey)) {
    return { keyType: 'env' };
  }

  // Check stored keys
  const apiKey = validateApiKey(token);
  if (apiKey) {
    if (apiKey.scope.type === 'server') {
      return { keyType: 'server', apiKey };
    }
    return {
      keyType: 'project',
      projectIds: apiKey.scope.project_ids,
      apiKey,
    };
  }

  return null;
}

/**
 * Check if the current auth context allows write access to a project
 */
export function canWriteProject(auth: AuthContext, projectId: string): boolean {
  if (isOpenMode()) return true;
  if (auth.keyType === 'env' || auth.keyType === 'server') return true;
  if (auth.keyType === 'project' && auth.projectIds) {
    return auth.projectIds.includes(projectId);
  }
  return false;
}

/**
 * Check if the current auth context allows read access to a project
 * Public projects can be read by anyone, private requires key access
 */
export function canReadProject(auth: AuthContext, projectId: string): boolean {
  // Server/env keys can read anything
  if (auth.keyType === 'env' || auth.keyType === 'server') return true;

  // Project keys can read their projects
  if (auth.keyType === 'project' && auth.projectIds) {
    if (auth.projectIds.includes(projectId)) return true;
  }

  // Anyone can read public projects (but not non-existent ones)
  const project = getProject(projectId);
  if (!project) return false;
  return project.visibility !== 'private';
}

/**
 * Filter projects list based on auth context
 * Hides private projects from anonymous users
 */
export function filterProjects(auth: AuthContext): ReturnType<typeof getProjects> {
  const projects = getProjects();

  // Server/env keys see everything
  if (auth.keyType === 'env' || auth.keyType === 'server') return projects;

  // Project keys see their projects + public projects
  if (auth.keyType === 'project' && auth.projectIds) {
    return projects.filter(p =>
      auth.projectIds!.includes(p.id) || p.visibility !== 'private'
    );
  }

  // Anonymous sees only public projects
  return projects.filter(p => p.visibility !== 'private');
}

/**
 * Check if auth is required (any keys configured)
 */
export function isAuthRequired(): boolean {
  return !!getEnvKey() || hasApiKeys();
}

/**
 * Open mode: no keys configured AND anonymous access explicitly allowed.
 * Every request is granted full access. Requires FLUX_ALLOW_ANONYMOUS.
 */
export function isOpenMode(): boolean {
  return !isAuthRequired() && isAnonymousAllowed();
}

/**
 * Check if auth context has server-level access
 * In open mode (FLUX_ALLOW_ANONYMOUS, no keys), always returns true
 */
export function hasServerAccess(auth: AuthContext): boolean {
  if (isOpenMode()) return true;
  return auth.keyType === 'env' || auth.keyType === 'server';
}

/**
 * Middleware that requires server-level access
 * Use: app.post('/route', requireServerAccess, handler)
 */
export const requireServerAccess = createMiddleware<{ Variables: { auth: AuthContext } }>(async (c, next) => {
  const auth = c.get('auth');
  if (!hasServerAccess(auth)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
});
