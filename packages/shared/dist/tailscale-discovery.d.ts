import type { PeerState } from './sync-types.js';
export type DiscoverOptions = {
    port?: number;
    tag?: string;
    timeout?: number;
};
declare function invalidateCache(): void;
/**
 * Discover other Flux instances on the same Tailscale network.
 *
 * Runs `tailscale status --json`, filters to online peers with the
 * specified ACL tag, and probes each one for a running Flux server.
 *
 * Requires the `tailscale` CLI on the host — intended for native
 * (non-Docker) deployments. For Docker, use `discovery: "manual"`
 * with explicit peer URLs in your sync config.
 *
 * Returns an empty array silently if the CLI is not available.
 */
export declare function discoverPeers(options?: DiscoverOptions): Promise<PeerState[]>;
/**
 * Returns this node's Tailscale IPv4 address, or null if unavailable.
 */
export declare function getTailscaleIP(): string | null;
/**
 * Returns this node's Tailscale hostname, or null if unavailable.
 */
export declare function getHostName(): string | null;
export { invalidateCache as _invalidateCache };
