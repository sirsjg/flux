import { syncService } from '@flux/shared/sync-service';
import { requireServerAccess } from './middleware/auth.js';
/**
 * Register sync API routes on the Hono app.
 *
 * Routes:
 *   GET  /api/sync/status  — Current sync status (node role, peers, sequence)
 *   GET  /api/sync/pull    — Pull changes since a given sequence number
 *   POST /api/sync/push    — Push changes from a remote peer
 *   POST /api/sync/discover — Trigger peer discovery (Tailscale or manual)
 */
export function registerSyncRoutes(app) {
    // Sync status — public read (filtered by auth)
    app.get('/api/sync/status', (c) => {
        const status = syncService.getStatus();
        return c.json(status);
    });
    // Pull changes — peers call this to get changes since their last sync
    app.get('/api/sync/pull', (c) => {
        const sinceParam = c.req.query('since');
        const since = sinceParam ? parseInt(sinceParam, 10) : 0;
        if (isNaN(since) || since < 0) {
            return c.json({ error: 'Invalid "since" parameter: must be a non-negative integer' }, 400);
        }
        const oldestSequence = syncService.getOldestSequence();
        // If the peer is asking for changes older than our oldest changelog
        // entry, they've fallen too far behind. Send a full snapshot instead
        // so they can recover without manual intervention.
        if (since > 0 && since < oldestSequence) {
            const snapshot = syncService.getFullSnapshot();
            return c.json({
                nodeId: syncService.getNodeId(),
                changes: snapshot,
                currentSequence: syncService.getCurrentSequence(),
                hubNodeId: syncService.getHubNodeId() || undefined,
                snapshotReason: `Requested since=${since} but oldest changelog entry is ${oldestSequence}. Sent full snapshot.`,
            });
        }
        const changes = syncService.getChangesSince(since);
        return c.json({
            nodeId: syncService.getNodeId(),
            changes,
            currentSequence: syncService.getCurrentSequence(),
            hubNodeId: syncService.getHubNodeId() || undefined,
        });
    });
    // Full snapshot — peers can request the complete database state
    app.get('/api/sync/snapshot', (c) => {
        const snapshot = syncService.getFullSnapshot();
        return c.json({
            nodeId: syncService.getNodeId(),
            changes: snapshot,
            currentSequence: syncService.getCurrentSequence(),
            hubNodeId: syncService.getHubNodeId() || undefined,
        });
    });
    // Push changes — peers send their changes to this node
    app.post('/api/sync/push', async (c) => {
        const body = await c.req.json().catch(() => null);
        if (!body || !Array.isArray(body.changes)) {
            return c.json({ error: 'Request body must contain a "changes" array' }, 400);
        }
        const changes = body.changes;
        // Basic validation
        for (const change of changes) {
            if (!change.nodeId || !change.entity || !change.entityId || !change.action) {
                return c.json({
                    error: 'Each change must have nodeId, entity, entityId, and action',
                }, 400);
            }
        }
        const result = syncService.applyRemoteChanges(changes);
        return c.json(result);
    });
    // Trigger peer discovery — admin only
    app.post('/api/sync/discover', requireServerAccess, async (c) => {
        try {
            // Dynamic import to avoid pulling tailscale module when not needed
            const { discoverPeers } = await import('@flux/shared/tailscale-discovery');
            const status = syncService.getStatus();
            const peers = await discoverPeers({
                port: status.peers[0]?.url
                    ? parseInt(new URL(status.peers[0].url).port || '3000', 10)
                    : 3000,
                tag: c.req.query('tag') || undefined,
            });
            // Register discovered peers
            for (const peer of peers) {
                syncService.setPeer(peer);
            }
            // Re-elect hub with new peers
            const hubId = syncService.electHub();
            return c.json({
                discovered: peers.length,
                peers: syncService.getPeers(),
                hubNodeId: hubId,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return c.json({ error: `Discovery failed: ${message}` }, 500);
        }
    });
}
