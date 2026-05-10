# ThinkBoard Architecture Deep-Dive

ThinkBoard is designed to be a "mini Miro/Figma" backend, focusing on the challenges of real-time collaborative editing in a distributed environment.

## 1. Data Model & CRDTs

To achieve conflict-free collaboration, ThinkBoard uses **Operation-based CRDTs**.

### Operation Object
Each change (drawing a line, adding text) is encapsulated as an `Operation`:
```json
{
  "id": "uuid",
  "clientId": "client-abc",
  "tool": "pen",
  "data": { "points": [...], "color": "#fff" },
  "lamport": 105,
  "vectorClock": { "client-abc": 10, "client-xyz": 5 }
}
```

### Conflict Resolution
1. **Total Ordering**: Every operation is assigned a **Lamport Timestamp**. When two operations conflict (e.g., two people clear the canvas at the same time), the server uses the Lamport timestamp to decide which happened first. If timestamps are identical, the `clientId` acts as a tie-breaker.
2. **Tombstones**: When a user clicks "Undo", we don't delete the operation from the log. Instead, we mark it with an `undone: true` flag. This ensures that if a delayed message arrives from another user, the relative order of active operations remains stable.

## 2. Horizontal Scaling with Redis

ThinkBoard can run on a single machine or scale across a cluster.

### Statelessness
The Node.js servers are stateless. All persistent room data is stored in **Redis**.
- **Room State**: Redis Strings or Hashes store the current operation log.
- **Messaging**: Redis Pub/Sub broadcasts new operations to all server instances.

### Sticky Sessions (Nginx)
WebSockets require a persistent connection. We use Nginx `ip_hash` to ensure that a client stays connected to the same server node. This prevents the "connection flickering" that can happen with round-robin load balancing.

## 3. Presence System

"Liveness" is tracked via a heartbeat mechanism:
1. **Client**: Sends a `presence_update` message every 2 seconds containing cursor `{x, y}`.
2. **Server**: Updates the `lastSeen` timestamp in the `PresenceTracker`.
3. **Cleanup**: A background process on the server checks for users who haven't sent a heartbeat in >5 seconds and broadcasts a `user_left` message.

## 4. Performance Optimizations

- **Throttling**: Mouse movement events are throttled on the client (50ms) to prevent overwhelming the server with thousands of tiny packets.
- **Quadratic Curves**: Instead of sending every single pixel, the pen tool collects points and the canvas engine renders them using `quadraticCurveTo` for smooth lines with less data.
- **Batching**: On initial join, the server sends the entire room state in a single `STATE_SNAPSHOT` message instead of individual operations.
