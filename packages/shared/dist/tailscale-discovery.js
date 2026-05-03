import { execSync } from 'child_process';
// ============ Constants ============
const DEFAULT_PORT = 3000;
const DEFAULT_PROBE_TIMEOUT_MS = 2000;
const DEFAULT_TAG = 'flux';
const STATUS_CACHE_TTL_MS = 10000;
const TAILSCALE_PATHS = [
    'tailscale',
    '/Applications/Tailscale.app/Contents/MacOS/Tailscale',
];
// ============ Status Cache ============
let cachedStatus = null;
let cachedStatusAt = 0;
function invalidateCache() {
    cachedStatus = null;
    cachedStatusAt = 0;
}
// ============ Tailscale CLI ============
/**
 * Find a working tailscale CLI path, trying the standard command first
 * and falling back to the macOS app bundle path.
 */
function findTailscaleCli() {
    for (const cmd of TAILSCALE_PATHS) {
        try {
            execSync(`${cmd} version`, { stdio: 'pipe', timeout: 5000 });
            return cmd;
        }
        catch {
            // Try next path
        }
    }
    return null;
}
/**
 * Get tailscale status via the CLI.
 *
 * This requires the `tailscale` CLI to be available on the host.
 * For Docker deployments, use `discovery: "manual"` with explicit
 * peer URLs instead of Tailscale auto-discovery.
 *
 * Returns cached result if called within STATUS_CACHE_TTL_MS.
 */
function getTailscaleStatus() {
    const now = Date.now();
    if (cachedStatus && now - cachedStatusAt < STATUS_CACHE_TTL_MS) {
        return cachedStatus;
    }
    const cli = findTailscaleCli();
    if (!cli)
        return null;
    try {
        const raw = execSync(`${cli} status --json`, {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 10000,
            encoding: 'utf-8',
        });
        const status = JSON.parse(raw);
        cachedStatus = status;
        cachedStatusAt = now;
        return status;
    }
    catch {
        return null;
    }
}
// ============ HTTP Probing ============
/**
 * Probe a single peer for health and sync status.
 * Returns a PeerState if the peer is running Flux, or null.
 */
async function probePeer(ip, peerHostname, port, timeout) {
    const baseUrl = `http://${ip}:${port}`;
    // Health check first
    const healthOk = await probeUrl(`${baseUrl}/health`, timeout);
    if (!healthOk) {
        return null;
    }
    // Get sync status for nodeId and role
    const syncStatus = await fetchJson(`${baseUrl}/api/sync/status`, timeout);
    return {
        nodeId: syncStatus?.nodeId ?? peerHostname,
        url: baseUrl,
        lastSyncedSequence: 0,
        lastSyncedAt: new Date().toISOString(),
        online: true,
        role: syncStatus?.role ?? 'spoke',
        hostname: peerHostname,
    };
}
/**
 * Check if a URL responds with a 2xx status within the timeout.
 */
async function probeUrl(url, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { signal: controller.signal });
        return res.ok;
    }
    catch {
        return false;
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * Fetch JSON from a URL with a timeout. Returns null on any failure.
 */
async function fetchJson(url, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok)
            return null;
        return (await res.json());
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timer);
    }
}
// ============ Public API ============
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
export async function discoverPeers(options = {}) {
    const port = options.port ?? DEFAULT_PORT;
    const timeout = options.timeout ?? DEFAULT_PROBE_TIMEOUT_MS;
    const tag = options.tag ?? DEFAULT_TAG;
    const status = getTailscaleStatus();
    if (!status || !status.Peer) {
        return [];
    }
    // Collect online peers, filtering by Tailscale ACL tag.
    // By default, only peers tagged with "tag:flux" are considered.
    // Set tag to '*' to skip filtering and probe all online peers.
    const candidates = [];
    for (const peer of Object.values(status.Peer)) {
        if (!peer.Online)
            continue;
        // Tag filtering: require the tag unless explicitly set to '*'
        if (tag !== '*') {
            const peerTags = peer.Tags ?? [];
            const normalizedTag = tag.startsWith('tag:') ? tag : `tag:${tag}`;
            if (!peerTags.includes(normalizedTag))
                continue;
        }
        // Use the first IP (typically the IPv4 Tailscale address)
        const ip = peer.TailscaleIPs?.[0];
        if (!ip)
            continue;
        candidates.push({ ip, hostname: peer.HostName });
    }
    // Probe all candidates concurrently
    const results = await Promise.allSettled(candidates.map((c) => probePeer(c.ip, c.hostname, port, timeout)));
    const peers = [];
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled' && result.value) {
            peers.push(result.value);
        }
        else {
            // Peer is online on Tailscale but not running Flux — mark offline
            peers.push({
                nodeId: candidates[i].hostname,
                url: `http://${candidates[i].ip}:${port}`,
                lastSyncedSequence: 0,
                lastSyncedAt: new Date().toISOString(),
                online: false,
                role: 'spoke',
                hostname: candidates[i].hostname,
            });
        }
    }
    return peers;
}
/**
 * Returns this node's Tailscale IPv4 address, or null if unavailable.
 */
export function getTailscaleIP() {
    const status = getTailscaleStatus();
    if (!status?.Self?.TailscaleIPs?.length) {
        return null;
    }
    return status.Self.TailscaleIPs[0];
}
/**
 * Returns this node's Tailscale hostname, or null if unavailable.
 */
export function getHostName() {
    const status = getTailscaleStatus();
    if (!status?.Self?.HostName) {
        return null;
    }
    return status.Self.HostName;
}
// Exported for testing
export { invalidateCache as _invalidateCache };
