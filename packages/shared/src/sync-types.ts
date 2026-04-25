// ============ Peer Sync Types ============
// Hub-spoke with gossip failover for multi-node Flux sync over Tailscale.

// Sync configuration (added to FluxConfig)
export type SyncConfig = {
  enabled: boolean;
  discovery: 'tailscale' | 'manual' | 'off';
  peers?: string[];           // Manual peer URLs (used when discovery='manual')
  role?: 'hub' | 'spoke' | 'auto';  // auto = elect hub from peers
  syncIntervalMs?: number;    // How often to sync (default 30000)
  syncPort?: number;          // Port for sync API (default: same as server port)
  nodeId?: string;            // Unique node identifier (default: hostname)
  tailscaleTag?: string;      // Tailscale tag to filter peers (default: 'flux')
};

// A sync envelope wrapping a change
export type SyncEnvelope = {
  nodeId: string;
  timestamp: string;       // ISO 8601
  sequence: number;         // Monotonic sequence per node
  entity: 'task' | 'epic' | 'project';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;  // The entity data or partial update
  checksum?: string;        // SHA-256 of JSON.stringify(data) for integrity
};

// Sync state tracked per peer
export type PeerState = {
  nodeId: string;
  url: string;
  lastSyncedSequence: number;
  lastSyncedAt: string;
  online: boolean;
  role: 'hub' | 'spoke';
  hostname?: string;
};

// Tailscale peer info from `tailscale status --json`
export type TailscalePeer = {
  ID: string;
  HostName: string;
  DNSName: string;
  TailscaleIPs: string[];
  Online: boolean;
  OS: string;
};

// Response from sync pull
export type SyncPullResponse = {
  nodeId: string;
  changes: SyncEnvelope[];
  currentSequence: number;
  hubNodeId?: string;
};

// Response from sync push
export type SyncPushResponse = {
  accepted: number;
  rejected: number;
  errors?: string[];
  currentSequence: number;
};

// Sync status for API
export type SyncStatus = {
  nodeId: string;
  role: 'hub' | 'spoke';
  discovery: 'tailscale' | 'manual' | 'off';
  peers: PeerState[];
  currentSequence: number;
  lastSyncAt?: string;
  hubNodeId?: string;
};
