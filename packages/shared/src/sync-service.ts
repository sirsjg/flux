import { createHash } from 'crypto';
import { hostname } from 'os';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import type { Task, Epic, Project } from './types.js';
import {
  getTask,
  updateTask,
  deleteTask,
  getEpic,
  updateEpic,
  deleteEpic,
  getProject,
  updateProject,
  deleteProject,
  insertTask,
  insertEpic,
  insertProject,
} from './store.js';
import type {
  SyncConfig,
  SyncEnvelope,
  PeerState,
  SyncPullResponse,
  SyncPushResponse,
  SyncStatus,
} from './sync-types.js';
import { discoverPeers } from './tailscale-discovery.js';

// ============ Constants ============

const DEFAULT_SYNC_INTERVAL_MS = 30000;
const DEFAULT_MAX_CHANGELOG_SIZE = 10000;
const DEFAULT_TAILSCALE_TAG = 'flux';

// ============ Sync Service ============

// Shape of the persisted sync state file
type PersistedSyncState = {
  sequence: number;
  changeLog: SyncEnvelope[];
};

class SyncService {
  private changeLog: SyncEnvelope[] = [];
  private sequence = 0;
  private maxChangeLogSize: number;
  private nodeId: string;
  private peers: Map<string, PeerState> = new Map();
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private config: SyncConfig | null = null;
  private hubNodeId: string | null = null;
  private lastSyncAt: string | null = null;
  private statePath: string | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(maxChangeLogSize = DEFAULT_MAX_CHANGELOG_SIZE) {
    this.maxChangeLogSize = maxChangeLogSize;
    this.nodeId = this.getDefaultNodeId();
  }

  // ============ State Persistence ============

  /**
   * Set the file path for persisting sync state.
   * Must be called before startSyncLoop for state to survive restarts.
   */
  setStatePath(path: string): void {
    this.statePath = path;
  }

  /**
   * Load persisted sync state from disk.
   * Called automatically by startSyncLoop if statePath is set.
   */
  private loadState(): void {
    if (!this.statePath) return;
    try {
      if (!existsSync(this.statePath)) return;
      const raw = readFileSync(this.statePath, 'utf-8');
      const state = JSON.parse(raw) as PersistedSyncState;
      if (typeof state.sequence === 'number' && Array.isArray(state.changeLog)) {
        this.sequence = state.sequence;
        this.changeLog = state.changeLog;
      }
    } catch {
      // Corrupted state file — start fresh
      console.warn('[sync] Could not load sync state, starting fresh');
    }
  }

  /**
   * Persist sync state to disk. Debounced to avoid excessive writes —
   * batches rapid changes into a single write within 500ms.
   */
  private schedulePersist(): void {
    if (!this.statePath) return;
    if (this.persistTimer) return; // already scheduled
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistNow();
    }, 500);
  }

  private persistNow(): void {
    if (!this.statePath) return;
    try {
      const state: PersistedSyncState = {
        sequence: this.sequence,
        changeLog: this.changeLog,
      };
      const tmp = this.statePath + '.tmp';
      writeFileSync(tmp, JSON.stringify(state));
      // Atomic rename to avoid partial writes
      renameSync(tmp, this.statePath);
    } catch (err) {
      console.error('[sync] Failed to persist sync state:', err);
    }
  }

  // ============ Node Identity ============

  private getDefaultNodeId(): string {
    // Prefer FLUX_NODE_ID env var (recommended for Docker where os.hostname()
    // returns an ephemeral container ID).
    const envNodeId = process.env.FLUX_NODE_ID;
    if (envNodeId) return envNodeId;
    try {
      return hostname();
    } catch {
      return 'node-' + Math.random().toString(36).substring(2, 9);
    }
  }

  getNodeId(): string {
    return this.nodeId;
  }

  // ============ Change Recording ============

  recordChange(
    entity: SyncEnvelope['entity'],
    entityId: string,
    action: SyncEnvelope['action'],
    data: Record<string, unknown>
  ): SyncEnvelope {
    this.sequence++;
    const envelope: SyncEnvelope = {
      nodeId: this.nodeId,
      timestamp: new Date().toISOString(),
      sequence: this.sequence,
      entity,
      entityId,
      action,
      data,
      checksum: this.computeChecksum(data),
    };
    this.changeLog.push(envelope);

    // Trim changelog if it exceeds max size
    if (this.changeLog.length > this.maxChangeLogSize) {
      const excess = this.changeLog.length - this.maxChangeLogSize;
      this.changeLog.splice(0, excess);
    }

    this.schedulePersist();
    return envelope;
  }

  // ============ Change Retrieval ============

  getChangesSince(sequence: number): SyncEnvelope[] {
    return this.changeLog.filter(e => e.sequence > sequence);
  }

  getCurrentSequence(): number {
    return this.sequence;
  }

  // ============ Remote Change Application (Last-Write-Wins) ============

  applyRemoteChanges(changes: SyncEnvelope[]): SyncPushResponse {
    let accepted = 0;
    let rejected = 0;
    const errors: string[] = [];

    for (const change of changes) {
      // Skip changes from this node
      if (change.nodeId === this.nodeId) {
        continue;
      }

      // Verify checksum if present
      if (change.checksum) {
        const computed = this.computeChecksum(change.data);
        if (computed !== change.checksum) {
          rejected++;
          errors.push(`Checksum mismatch for ${change.entity}/${change.entityId}`);
          continue;
        }
      }

      try {
        this.applyChange(change);
        accepted++;

        // Add to our changelog so we can relay to other peers
        this.sequence++;
        const relayed: SyncEnvelope = {
          ...change,
          sequence: this.sequence,
        };
        this.changeLog.push(relayed);

        // Trim if needed
        if (this.changeLog.length > this.maxChangeLogSize) {
          const excess = this.changeLog.length - this.maxChangeLogSize;
          this.changeLog.splice(0, excess);
        }
      } catch (err) {
        rejected++;
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to apply ${change.action} on ${change.entity}/${change.entityId}: ${message}`);
      }
    }

    if (accepted > 0) {
      this.schedulePersist();
    }

    return {
      accepted,
      rejected,
      errors: errors.length > 0 ? errors : undefined,
      currentSequence: this.sequence,
    };
  }

  private applyChange(change: SyncEnvelope): void {
    const { entity, entityId, action, data } = change;

    switch (entity) {
      case 'task':
        this.applyTaskChange(entityId, action, data, change.timestamp);
        break;
      case 'epic':
        this.applyEpicChange(entityId, action, data, change.timestamp);
        break;
      case 'project':
        this.applyProjectChange(entityId, action, data, change.timestamp);
        break;
    }
  }

  private applyTaskChange(
    entityId: string,
    action: SyncEnvelope['action'],
    data: Record<string, unknown>,
    remoteTimestamp: string
  ): void {
    const existing = getTask(entityId);

    switch (action) {
      case 'create':
        if (!existing) {
          insertTask(data as unknown as Task);
        }
        break;

      case 'update':
        if (existing) {
          // Last-write-wins: only apply if remote timestamp is newer
          const localUpdated = existing.updated_at || existing.created_at || '';
          if (remoteTimestamp > localUpdated) {
            const { id, ...updates } = data as Record<string, unknown>;
            updateTask(entityId, updates as Partial<Omit<Task, 'id'>>);
          }
        }
        break;

      case 'delete':
        if (existing) {
          deleteTask(entityId);
        }
        break;
    }
  }

  private applyEpicChange(
    entityId: string,
    action: SyncEnvelope['action'],
    data: Record<string, unknown>,
    remoteTimestamp: string
  ): void {
    const existing = getEpic(entityId);

    switch (action) {
      case 'create':
        if (!existing) {
          insertEpic(data as unknown as Epic);
        }
        break;

      case 'update':
        if (existing) {
          // Last-write-wins: only apply if remote timestamp is newer
          const localEpicUpdated = (existing as Record<string, unknown>).updated_at as string
            || (existing as Record<string, unknown>).created_at as string || '';
          if (remoteTimestamp > localEpicUpdated) {
            const { id, ...updates } = data as Record<string, unknown>;
            updateEpic(entityId, updates as Partial<Omit<Epic, 'id'>>);
          }
        }
        break;

      case 'delete':
        if (existing) {
          deleteEpic(entityId);
        }
        break;
    }
  }

  private applyProjectChange(
    entityId: string,
    action: SyncEnvelope['action'],
    data: Record<string, unknown>,
    remoteTimestamp: string
  ): void {
    const existing = getProject(entityId);

    switch (action) {
      case 'create':
        if (!existing) {
          insertProject(data as unknown as Project);
        }
        break;

      case 'update':
        if (existing) {
          // Last-write-wins: only apply if remote timestamp is newer
          const localProjectUpdated = (existing as Record<string, unknown>).updated_at as string
            || (existing as Record<string, unknown>).created_at as string || '';
          if (remoteTimestamp > localProjectUpdated) {
            const { id, ...updates } = data as Record<string, unknown>;
            updateProject(entityId, updates as Partial<Omit<Project, 'id'>>);
          }
        }
        break;

      case 'delete':
        if (existing) {
          deleteProject(entityId);
        }
        break;
    }
  }

  // ============ Checksum ============

  private computeChecksum(data: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  // ============ Peer Management ============

  getPeers(): PeerState[] {
    return Array.from(this.peers.values());
  }

  setPeer(peer: PeerState): void {
    this.peers.set(peer.nodeId, peer);
  }

  removePeer(nodeId: string): boolean {
    return this.peers.delete(nodeId);
  }

  // ============ Hub Election ============

  /**
   * Elect the hub node. When role='auto', the node with the
   * lexicographically lowest nodeId becomes the hub.
   */
  electHub(): string {
    const allNodeIds = [this.nodeId, ...Array.from(this.peers.keys())].sort();
    const hubId = allNodeIds[0];
    this.hubNodeId = hubId;

    // Update peer roles
    for (const [id, peer] of this.peers) {
      peer.role = id === hubId ? 'hub' : 'spoke';
    }

    return hubId;
  }

  getRole(): 'hub' | 'spoke' {
    if (!this.config) return 'spoke';
    if (this.config.role === 'hub') return 'hub';
    if (this.config.role === 'spoke') return 'spoke';
    // auto: check election result
    return this.hubNodeId === this.nodeId ? 'hub' : 'spoke';
  }

  getHubNodeId(): string | null {
    return this.hubNodeId;
  }

  // ============ Sync Loop ============

  async startSyncLoop(config: SyncConfig): Promise<void> {
    if (!config.enabled) return;

    this.config = config;
    this.nodeId = config.nodeId || this.getDefaultNodeId();

    // Restore persisted changelog from previous run
    this.loadState();

    // Discover peers
    if (config.discovery === 'tailscale') {
      const discovered = await discoverPeers({
        port: config.syncPort,
        tag: config.tailscaleTag,
      });
      for (const peer of discovered) {
        if (peer.online) {
          this.peers.set(peer.nodeId, peer);
        }
      }
    } else if (config.discovery === 'manual' && config.peers) {
      for (let i = 0; i < config.peers.length; i++) {
        const url = config.peers[i];
        const peerId = `manual-peer-${i}`;
        this.peers.set(peerId, {
          nodeId: peerId,
          url,
          lastSyncedSequence: 0,
          lastSyncedAt: '',
          online: true,
          role: 'spoke',
        });
      }
    }

    // Elect hub if auto
    if (config.role === 'auto') {
      this.electHub();
    } else if (config.role === 'hub') {
      this.hubNodeId = this.nodeId;
    }

    // Start periodic sync
    const interval = config.syncIntervalMs || DEFAULT_SYNC_INTERVAL_MS;
    this.syncTimer = setInterval(() => {
      this.syncWithPeers().catch(err => {
        console.error('[sync] Sync loop error:', err);
      });
    }, interval);

    // Run initial sync
    await this.syncWithPeers();
  }

  stopSyncLoop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    // Flush any pending state to disk before stopping
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persistNow();
    this.config = null;
  }

  private async syncWithPeers(): Promise<void> {
    const role = this.getRole();

    if (role === 'spoke' && this.hubNodeId) {
      // Spoke: pull from hub, then push local changes back
      const hubPeer = this.findPeerById(this.hubNodeId);
      if (hubPeer) {
        const pullOk = await this.pullFromPeer(hubPeer);
        if (pullOk) {
          // Push any local changes to the hub
          await this.pushToPeer(hubPeer);
          this.lastSyncAt = new Date().toISOString();
          return;
        }
        // Hub unreachable — fall through to gossip
        console.warn('[sync] Hub unreachable, falling back to gossip');
      }
    }

    if (role === 'hub') {
      // Hub: push changes to all spokes
      for (const peer of this.peers.values()) {
        if (peer.nodeId === this.nodeId) continue;
        await this.pushToPeer(peer);
      }
      this.lastSyncAt = new Date().toISOString();
      return;
    }

    // Gossip: pick a random peer and sync
    const availablePeers = Array.from(this.peers.values()).filter(
      p => p.nodeId !== this.nodeId && p.online
    );
    if (availablePeers.length === 0) return;

    const randomPeer = availablePeers[Math.floor(Math.random() * availablePeers.length)];
    await this.pullFromPeer(randomPeer);
    this.lastSyncAt = new Date().toISOString();
  }

  private findPeerById(nodeId: string): PeerState | undefined {
    return this.peers.get(nodeId);
  }

  private async pullFromPeer(peer: PeerState): Promise<boolean> {
    try {
      const url = `${peer.url}/api/sync/pull?since=${peer.lastSyncedSequence}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        peer.online = false;
        return false;
      }

      const pullResponse = (await response.json()) as SyncPullResponse;
      if (pullResponse.changes.length > 0) {
        this.applyRemoteChanges(pullResponse.changes);
      }

      peer.lastSyncedSequence = pullResponse.currentSequence;
      peer.lastSyncedAt = new Date().toISOString();
      peer.online = true;

      // Update hub info if provided
      if (pullResponse.hubNodeId) {
        this.hubNodeId = pullResponse.hubNodeId;
      }

      return true;
    } catch {
      peer.online = false;
      return false;
    }
  }

  private async pushToPeer(peer: PeerState): Promise<boolean> {
    try {
      const changes = this.getChangesSince(peer.lastSyncedSequence);
      if (changes.length === 0) return true;

      const url = `${peer.url}/api/sync/push`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        peer.online = false;
        return false;
      }

      const pushResponse = (await response.json()) as SyncPushResponse;
      peer.lastSyncedSequence = pushResponse.currentSequence;
      peer.lastSyncedAt = new Date().toISOString();
      peer.online = true;
      return true;
    } catch {
      peer.online = false;
      return false;
    }
  }

  // ============ Status ============

  getStatus(): SyncStatus {
    return {
      nodeId: this.nodeId,
      role: this.getRole(),
      discovery: this.config?.discovery || 'off',
      peers: this.getPeers(),
      currentSequence: this.sequence,
      lastSyncAt: this.lastSyncAt || undefined,
      hubNodeId: this.hubNodeId || undefined,
    };
  }
}

// ============ Singleton Export ============

export const syncService = new SyncService();
