# Proposal: 3 ways to subscribe to “new messages for user” events

All three methods can be driven by the **same backend source**: `GraphQLSubscriptionService` (PubSub). When a message is created and notifications are sent, `publishMessageCreated(message, userId)` is already called; the same event can be exposed over GraphQL subscriptions, SSE, or long polling.

---

## Method 1: GraphQL Subscriptions (graphql-ws) — current

**Technology:** WebSocket, protocol [graphql-ws](https://github.com/enisdenjo/graphql-ws).

**How it works:**
- Client opens a WebSocket to `ws(s)://<host>/api/v1/graphql`.
- Sends `connection_init` with `connectionParams: { Authorization: "Bearer <token>" }`.
- Subscribes with a GraphQL operation, e.g.  
  `subscription { messageCreated(bucketId: $bucketId) { id title body bucketId ... } }`.
- Backend filters by current user (from token) and optionally by `bucketId`; events come from `GraphQLSubscriptionService.messageCreated()` (same PubSub).

**Pros:** Single transport for all subscription types; flexible query shape; already implemented.  
**Cons:** Requires WebSocket support; slightly more complex than “plain” HTTP for clients that only need “new messages”.

---

## Method 2: Server-Sent Events (SSE)

**Technology:** HTTP long-lived response, `Content-Type: text/event-stream`.

**How it could work:**
- New endpoint, e.g. `GET /api/v1/events/messages?bucketId=<optional>`.
- Request must include `Authorization: Bearer <token>`.
- Response: `Content-Type: text/event-stream`, keep connection open.
- When `publishMessageCreated(message, userId)` is called, a backend component subscribed to the same PubSub (or to an internal “message created” stream) serializes the message and writes an SSE event, e.g.  
  `event: message_created`  
  `data: {"id":"...","title":"...","bucketId":"..."}`  
  (and optionally `event: message_deleted` / `data: "<messageId>"` for deletions).
- Filtering: only send events for the authenticated user; if `bucketId` is in the query string, only send events for that bucket.

**Backend integration:** One small service (e.g. `EventsSseGateway`) that:
- Subscribes to `GraphQLSubscriptionService` (e.g. reuses or mirrors the same PubSub event for “message created”).
- For each connection, keeps a map of `userId` (+ optional `bucketId`) and pushes only matching events to that HTTP response stream.

**Pros:** Simple HTTP; one-way stream; auto-reconnect and `EventSource` in browsers; no WebSocket needed.  
**Cons:** One-way only (server → client); need a new endpoint and the SSE gateway that bridges PubSub to HTTP streams.

---

## Method 3: Long polling

**Technology:** Repeated HTTP GET with a “since” cursor and optional timeout.

**How it could work:**
- New endpoint, e.g. `GET /api/v1/events/messages/poll?since=<timestamp>&bucketId=<optional>`.
- Request must include `Authorization: Bearer <token>`.
- Server:
  - Resolves current user from token.
  - Queries (or reads from an in-memory buffer) “messages created for this user after `since`” (and optionally for `bucketId`).
  - If there are events: return immediately with `200` and body e.g. `{ "events": [ { "type": "message_created", "message": { ... } }, ... ], "nextSince": "<ts>" }`.
  - If no events: wait up to a short time (e.g. 25–30 seconds), then respond with `{ "events": [], "nextSince": "<now>" }`.
- Client calls again with `since=nextSince` right after each response.

**Backend integration:** Same event source as above: when `publishMessageCreated` runs, events can be appended to a per-user (or per-user-and-bucket) buffer with a timestamp. The polling handler reads from that buffer for the given user and `since`, and optionally blocks until something arrives or a timeout.

**Pros:** Works everywhere (plain HTTP); no WebSocket or SSE support required; easy to implement on the client.  
**Cons:** Higher latency than push (up to poll interval); more requests if no events; need a bounded buffer and cleanup policy for the “since” buffer.

---

## Summary

| Method              | Transport   | Complexity (backend) | Best for                          |
|---------------------|------------|-----------------------|------------------------------------|
| GraphQL (graphql-ws)| WebSocket  | Already in place      | Full-featured clients, one transport for all subscriptions |
| SSE                 | HTTP stream| New endpoint + bridge | Simple “new messages” stream, browsers, no WebSocket       |
| Long polling        | HTTP GET   | New endpoint + buffer | Very constrained clients, firewalls that block WebSocket/SSE |

All three can be fed by the same `GraphQLSubscriptionService` (or a thin adapter that subscribes to the same PubSub events), so behaviour stays consistent and you can offer more than one option to different clients.
