# Peer Sync

Flux supports peer-to-peer synchronization between multiple instances, designed for multi-agent setups where each agent has its own Flux instance on a separate machine.

## Quick Start (Tailscale)

If your machines are on the same [Tailscale](https://tailscale.com) network, sync is zero-config:

```json
// .flux/config.json
{
  "sync": {
    "enabled": true,
    "discovery": "tailscale"
  }
}
```

Flux will automatically discover other instances on your tailnet and elect a hub node.

## Quick Start (Manual)

For non-Tailscale setups, list peers explicitly:

```json
{
  "sync": {
    "enabled": true,
    "discovery": "manual",
    "peers": [
      "http://192.168.1.10:3000",
      "http://192.168.1.11:3000"
    ]
  }
}
```

## How It Works

### Hub-Spoke Topology

When multiple Flux instances sync, one is elected as the **hub** and the rest are **spokes**:

- **Hub**: Receives changes from all spokes, distributes to all spokes
- **Spoke**: Pulls changes from the hub on a configurable interval

Hub election is automatic (`role: "auto"`): the node with the lexicographically lowest node ID becomes the hub. You can also force a role:

```json
{
  "sync": {
    "enabled": true,
    "discovery": "tailscale",
    "role": "hub"
  }
}
```

### Gossip Failover

If the hub goes down, spokes fall back to **gossip mode** — syncing with a randomly selected peer. Changes eventually propagate to all nodes. When the hub comes back, normal hub-spoke resumes.

### Conflict Resolution

Sync uses **last-write-wins** based on ISO 8601 timestamps. If two nodes modify the same task, the most recent write takes precedence. Each change envelope includes a SHA-256 checksum for integrity verification.

## Configuration Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable peer sync |
| `discovery` | string | `"off"` | `"tailscale"`, `"manual"`, or `"off"` |
| `peers` | string[] | - | Manual peer URLs (when discovery = manual) |
| `role` | string | `"auto"` | `"hub"`, `"spoke"`, or `"auto"` (elect) |
| `syncIntervalMs` | number | `30000` | Sync interval in milliseconds |
| `syncPort` | number | server port | Port for sync API endpoints |
| `nodeId` | string | hostname | Unique node identifier |
| `tailscaleTag` | string | `"flux"` | Tailscale tag to filter peers |

## Environment Variables

- `FLUX_SYNC_ENABLED=true` — Enable sync (overrides config)
- `FLUX_SYNC_DISCOVERY=tailscale` — Discovery mode
- `FLUX_SYNC_PEERS=http://host1:3000,http://host2:3000` — Comma-separated peer list
- `FLUX_NODE_ID=my-node` — Stable node identifier (recommended for Docker; defaults to `os.hostname()`)

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/sync/status` | Read | Current sync status, peers, role |
| GET | `/api/sync/pull?since=N` | Read | Pull changes since sequence N |
| POST | `/api/sync/push` | Write | Push changes to this node |
| POST | `/api/sync/discover` | Admin | Trigger peer discovery |

### Pull Example

```bash
curl http://localhost:3000/api/sync/pull?since=0
```

```json
{
  "nodeId": "macbook-pro",
  "changes": [
    {
      "nodeId": "macbook-pro",
      "timestamp": "2026-04-25T10:30:00.000Z",
      "sequence": 42,
      "entity": "task",
      "entityId": "abc123",
      "action": "update",
      "data": { "status": "done" },
      "checksum": "a1b2c3..."
    }
  ],
  "currentSequence": 42,
  "hubNodeId": "gb10-server"
}
```

### Push Example

```bash
curl -X POST http://localhost:3000/api/sync/push \
  -H "Content-Type: application/json" \
  -d '{"changes": [...]}'
```

## Tailscale Setup

### 1. Tag your machines

Flux uses [Tailscale ACL tags](https://tailscale.com/kb/1068/acl-tags) to identify which machines on your tailnet are running Flux. By default it looks for `tag:flux`.

In the Tailscale admin console (https://login.tailscale.com/admin/acls):

1. Add a `tagOwners` entry for the `flux` tag:
   ```json
   "tagOwners": {
     "tag:flux": ["autogroup:admin"]
   }
   ```
2. Apply the tag to each machine that will run Flux — either via the Machines page in the admin console, or by advertising the tag at `tailscale up` time:
   ```bash
   sudo tailscale up --advertise-tags=tag:flux
   ```

You can use a different tag by setting `tailscaleTag` in your config. Set it to `"*"` to skip tag filtering and probe every online peer on the tailnet (useful for debugging but not recommended in production).

### 2. Discovery flow

When `discovery: "tailscale"` is set, Flux:

1. Runs `tailscale status --json` to get all peers on the tailnet
2. Filters to online peers with the `tag:flux` ACL tag (or your custom tag)
3. Probes each peer at `http://{tailscale_ip}:{port}/health`
4. Queries `http://{tailscale_ip}:{port}/api/sync/status` for node ID and role
5. Registers discovered peers and elects a hub

The tailscale status is cached for 10 seconds to avoid hammering the CLI.

On macOS, Flux tries both `tailscale` and `/Applications/Tailscale.app/Contents/MacOS/Tailscale`.

## Docker Deployment

When running Flux in Docker containers, use **manual discovery** with explicit Tailscale IPs. The containers don't need access to the Tailscale CLI or daemon — Tailscale provides the network connectivity at the host level, and the containers just need to know where their peers are.

```bash
# MacBook (100.98.253.46) pointing to GB10
docker run -d --name flux-web -p 3000:3000 \
  -v ~/.flux-data:/app/packages/data \
  -e FLUX_DIR=/app/packages/data/.flux \
  -e FLUX_NODE_ID=macbook \
  flux-mcp:latest
```

**Important:** Set `FLUX_NODE_ID` to a stable, human-readable name. Without it, the node ID defaults to `os.hostname()`, which inside Docker is the ephemeral container ID — causing hub election to change on every restart.

```json
// Config: .flux-data/.flux/config.json
{
  "sync": {
    "enabled": true,
    "discovery": "manual",
    "role": "auto",
    "syncIntervalMs": 30000,
    "peers": ["http://100.69.118.20:3000"]
  }
}
```

Tailscale automatic discovery (`discovery: "tailscale"`) is designed for native (non-Docker) deployments where the Flux process can call the `tailscale` CLI directly.

## Migrating MCP-Only Machines

If a machine currently runs Flux as an MCP client only (pointing `FLUX_SERVER` at another machine's server), it will need to run its own Flux server instance to participate in sync. Each syncing node is a full Flux server with its own local data store.

1. Install Flux server on the machine: `bun install @flux/server`
2. Start the server: `flux server` (or via systemd/launchd)
3. Add the sync config to `.flux/config.json`
4. Tag the machine in Tailscale with `tag:flux`

The MCP client can then point at `localhost:3000` instead of the remote server, and sync will keep all nodes in agreement.

## Scaling to 100+ Nodes

The hub-spoke topology keeps the connection count linear: O(n) instead of O(n^2) for full mesh. At 100 nodes:

- **100 connections** (each spoke talks to 1 hub)
- **Hub handles ~100 sync requests per interval**

For very large deployments, consider:

- Increasing `syncIntervalMs` to reduce hub load (e.g., 60000ms)
- Using multiple hubs with regional partitioning
- The gossip fallback provides resilience if the hub is overloaded

## Known Limitations

**No authentication on sync endpoints.** The `/api/sync/push` and `/api/sync/pull` endpoints have no authentication. Any client that can reach the server over the network can read and write sync data. This is acceptable when Flux instances communicate over a private network (e.g., Tailscale), but sync endpoints should not be exposed to the public internet without adding an auth layer.

**Clock-dependent conflict resolution.** Last-write-wins (LWW) relies on ISO 8601 timestamps from each node's system clock. If clocks are significantly skewed between nodes, the "wrong" write may win. Use NTP or a similar time synchronization mechanism to keep clocks aligned.

**No partial/field-level merges.** Updates are whole-entity overwrites. If two nodes update different fields of the same task simultaneously, the later write replaces the earlier one entirely rather than merging the two field sets.
