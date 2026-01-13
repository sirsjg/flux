import { createMiddleware } from 'hono/factory';

const FLUX_API_KEY = process.env.FLUX_API_KEY;

/**
 * Auth middleware for Flux server.
 * - GET/HEAD requests are public (readonly)
 * - All other methods require Bearer token matching FLUX_API_KEY
 * - If FLUX_API_KEY is not set, all requests are allowed (dev mode)
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  // Allow all requests if no API key configured (dev mode)
  if (!FLUX_API_KEY) {
    return next();
  }

  // GET and HEAD are public (readonly)
  if (c.req.method === 'GET' || c.req.method === 'HEAD') {
    return next();
  }

  // Check Bearer token for write operations
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token !== FLUX_API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return next();
});
