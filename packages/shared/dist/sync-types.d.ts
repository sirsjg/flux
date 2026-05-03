export type SyncConfig = {
    enabled: boolean;
    discovery: 'tailscale' | 'manual' | 'off';
    peers?: string[];
    role?: 'hub' | 'spoke' | 'auto';
    syncIntervalMs?: number;
    syncPort?: number;
    nodeId?: string;
    tailscaleTag?: string;
};
export type SyncEnvelope = {
    nodeId: string;
    timestamp: string;
    sequence: number;
    entity: 'task' | 'epic' | 'project';
    entityId: string;
    action: 'create' | 'update' | 'delete';
    data: Record<string, unknown>;
    checksum?: string;
};
export type PeerState = {
    nodeId: string;
    url: string;
    lastSyncedSequence: number;
    lastSyncedAt: string;
    online: boolean;
    role: 'hub' | 'spoke';
    hostname?: string;
};
export type TailscalePeer = {
    ID: string;
    HostName: string;
    DNSName: string;
    TailscaleIPs: string[];
    Online: boolean;
    OS: string;
};
export type SyncPullResponse = {
    nodeId: string;
    changes: SyncEnvelope[];
    currentSequence: number;
    hubNodeId?: string;
};
export type SyncPushResponse = {
    accepted: number;
    rejected: number;
    errors?: string[];
    currentSequence: number;
};
export type SyncStatus = {
    nodeId: string;
    role: 'hub' | 'spoke';
    discovery: 'tailscale' | 'manual' | 'off';
    peers: PeerState[];
    currentSequence: number;
    lastSyncAt?: string;
    hubNodeId?: string;
};
