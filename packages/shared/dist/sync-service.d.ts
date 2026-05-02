import type { SyncConfig, SyncEnvelope, PeerState, SyncPushResponse, SyncStatus } from './sync-types.js';
declare class SyncService {
    private changeLog;
    private sequence;
    private maxChangeLogSize;
    private nodeId;
    private peers;
    private syncTimer;
    private config;
    private hubNodeId;
    private lastSyncAt;
    private statePath;
    private persistTimer;
    constructor(maxChangeLogSize?: number);
    /**
     * Set the file path for persisting sync state.
     * Must be called before startSyncLoop for state to survive restarts.
     */
    setStatePath(path: string): void;
    /**
     * Load persisted sync state from disk.
     * Called automatically by startSyncLoop if statePath is set.
     */
    private loadState;
    /**
     * Persist sync state to disk. Debounced to avoid excessive writes —
     * batches rapid changes into a single write within 500ms.
     */
    private schedulePersist;
    private persistNow;
    private getDefaultNodeId;
    getNodeId(): string;
    recordChange(entity: SyncEnvelope['entity'], entityId: string, action: SyncEnvelope['action'], data: Record<string, unknown>): SyncEnvelope;
    getChangesSince(sequence: number): SyncEnvelope[];
    getCurrentSequence(): number;
    /**
     * Return the oldest sequence number still in the changelog.
     * If a peer requests changes older than this, they need a full snapshot.
     */
    getOldestSequence(): number;
    /**
     * Build a full-state snapshot for peers that are too far behind
     * the changelog. Returns all entities as synthetic 'create' changes.
     */
    getFullSnapshot(): SyncEnvelope[];
    applyRemoteChanges(changes: SyncEnvelope[]): SyncPushResponse;
    private applyChange;
    private applyTaskChange;
    private applyEpicChange;
    private applyProjectChange;
    private computeChecksum;
    getPeers(): PeerState[];
    setPeer(peer: PeerState): void;
    removePeer(nodeId: string): boolean;
    /**
     * Elect the hub node. When role='auto', the node with the
     * lexicographically lowest nodeId becomes the hub.
     */
    electHub(): string;
    getRole(): 'hub' | 'spoke';
    getHubNodeId(): string | null;
    startSyncLoop(config: SyncConfig): Promise<void>;
    stopSyncLoop(): void;
    private syncWithPeers;
    private findPeerById;
    private pullFromPeer;
    private pushToPeer;
    getStatus(): SyncStatus;
}
export declare const syncService: SyncService;
export {};
