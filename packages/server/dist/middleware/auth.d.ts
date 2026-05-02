import { getProjects } from '@flux/shared';
import type { ApiKey } from '@flux/shared';
export type AuthContext = {
    keyType: 'server' | 'project' | 'env' | 'anonymous';
    projectIds?: string[];
    apiKey?: ApiKey;
};
/**
 * Auth middleware for Flux server.
 *
 * Access levels:
 * - FLUX_API_KEY env var: Full access (backwards compat)
 * - Stored server keys: Full access
 * - Stored project keys: Access to specific projects
 * - Anonymous: Read public projects only
 *
 * Dev mode (no keys configured): All access allowed
 */
export declare const authMiddleware: import("hono").MiddlewareHandler<{
    Variables: {
        auth: AuthContext;
    };
}, string, {}, Response>;
/**
 * Check if the current auth context allows write access to a project
 */
export declare function canWriteProject(auth: AuthContext, projectId: string): boolean;
/**
 * Check if the current auth context allows read access to a project
 * Public projects can be read by anyone, private requires key access
 */
export declare function canReadProject(auth: AuthContext, projectId: string): boolean;
/**
 * Filter projects list based on auth context
 * Hides private projects from anonymous users
 */
export declare function filterProjects(auth: AuthContext): ReturnType<typeof getProjects>;
/**
 * Check if auth is required (any keys configured)
 */
export declare function isAuthRequired(): boolean;
/**
 * Check if auth context has server-level access
 * In dev mode (no auth configured), always returns true
 */
export declare function hasServerAccess(auth: AuthContext): boolean;
/**
 * Middleware that requires server-level access
 * Use: app.post('/route', requireServerAccess, handler)
 */
export declare const requireServerAccess: import("hono").MiddlewareHandler<{
    Variables: {
        auth: AuthContext;
    };
}, string, {}, Response>;
