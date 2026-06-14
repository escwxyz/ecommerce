## Context

`notification-event-module-foundation` established the runtime-neutral event and notification contracts, including event envelopes, outbox records, notification templates, dispatch state, retry metadata, dead letters, API fragments, admin metadata, and import-boundary tests. The next step is Cloudflare runtime integration: asynchronous delivery should use Cloudflare Queues, and realtime admin/operator observability should use Durable Objects with WebSocket hibernation.

The architecture blueprint requires Cloudflare-specific runtime code to stay out of pure module packages. Cloudflare bindings, Durable Object classes, queue consumers, and Worker exports belong in `packages/platform-cloudflare`, `apps/server`, and `packages/infra`, while `packages/modules/notification-event` remains the source of truth for contracts and domain state.

Cloudflare Durable Object guidance also shapes this change:

- model Durable Objects around coordination atoms, not a single global object;
- use SQLite-backed Durable Object storage for per-object durable state;
- use `blockConcurrencyWhile()` only for constructor-time schema setup;
- prefer RPC methods for programmatic calls and hibernatable WebSocket handlers for realtime streams;
- persist critical state before updating in-memory connection state;
- use Queues for asynchronous work, retries, delays, batching, and dead-letter routing.

## Goals / Non-Goals

**Goals:**

- Provide a Cloudflare runtime adapter that publishes notification/event work onto Queue bindings using the existing module envelope and dispatch contracts.
- Provide Queue consumer handlers that process event distribution and notification dispatch records idempotently, update module-owned audit state, and route exhausted messages to dead-letter handling.
- Provide a realtime Durable Object for admin/operator notification-event streams using WebSocket hibernation and deterministic per-tenant or per-audience routing.
- Compose Durable Object classes, Queue bindings, queue consumers, and server routes through `packages/platform-cloudflare`, `apps/server`, and `packages/infra`.
- Keep all Cloudflare-specific imports out of `packages/modules/notification-event`, `packages/core`, and other pure commerce modules.

**Non-Goals:**

- Replacing the notification-event module's D1/outbox audit tables with Durable Object storage.
- Building a full admin UI for realtime streams; this change should expose the runtime endpoint and metadata needed by future UI work.
- Introducing provider-specific notification SDKs.
- Replacing the existing workflow runtime, stateful coordinator, or queue abstractions.
- Supporting non-Cloudflare realtime transports in this change.

## Decisions

1. Keep Cloudflare runtime code in `packages/platform-cloudflare`.

   The notification-event module owns contracts and test doubles. The Cloudflare adapter package owns `cloudflare:workers` imports, Queue bindings, Durable Object classes, WebSocket handlers, and runtime glue. This preserves module portability and follows the existing `StatefulCoordinatorDurableObject` and workflow runtime pattern.

   Alternative considered: implement Durable Object and queue behavior directly in `packages/modules/notification-event`. Rejected because it would violate the blueprint and make module tests depend on Cloudflare runtime bindings.

2. Use Queues for asynchronous delivery and retries.

   Event publication should enqueue event distribution work after the module-owned outbox record exists. Notification dispatch work should enqueue provider delivery tasks and preserve idempotency keys, correlation metadata, causation metadata, and workflow run IDs. Queue retry/delay settings should be mapped from module retry policy, with exhausted messages handled through Cloudflare DLQ configuration and module dead-letter records.

   Alternative considered: use Durable Object alarms as the primary retry engine. Rejected because Queues are already the Cloudflare primitive for delivery buffering, retries, delays, batching, and DLQs; Durable Object alarms are better reserved for per-object scheduled maintenance or connection cleanup.

3. Use Durable Objects for realtime observability only.

   A `NotificationEventRealtimeDurableObject` should coordinate WebSocket subscribers for a single tenant/audience stream. It should not be the canonical outbox, dead-letter, or dispatch database. It can store connection/session cursors and recent stream metadata in DO SQLite, but the module-owned D1 schema remains the durable audit source.

   Alternative considered: a single global notification-event Durable Object. Rejected because it creates a throughput bottleneck and violates the coordination-atom model.

4. Route Durable Objects deterministically by stream scope.

   Worker code should derive names such as `tenant:<tenantId>` or `tenant:<tenantId>:audience:<audienceKey>` and use `getByName()`. The stream scope must be explicit in the request and permission-checked before the Worker obtains a stub.

   Alternative considered: use `newUniqueId()` and store mappings in D1. Rejected for the first slice because deterministic names simplify routing, tests, and rollback.

5. Use WebSocket hibernation APIs.

   The DO should accept connections with `ctx.acceptWebSocket(server)` and implement `webSocketMessage`, `webSocketClose`, and broadcast helpers. Per-socket identity, stream scope, and last-seen cursor should be stored with WebSocket attachments so state can be restored when the DO wakes after hibernation. Constructor work should be limited to SQLite schema setup.

   Alternative considered: standard WebSocket `accept()` with in-memory connection state only. Rejected because hibernation reduces idle cost and in-memory-only connection metadata is lost on eviction.

6. Keep realtime broadcasting best-effort and audit persistence authoritative.

   Queue consumers should update module-owned records first, then notify the realtime DO. If broadcasting fails, delivery state remains durable and clients can recover by querying API/admin metadata or reconnecting with a cursor. Realtime failure must not roll back event publication or provider dispatch.

   Alternative considered: make WebSocket broadcast part of the same success transaction as dispatch. Rejected because external connection fanout is not the source of truth and should not block delivery.

## Risks / Trade-offs

- Duplicate delivery from Queue retries -> Use idempotency keys and module repository checks before mutating provider dispatch state.
- WebSocket fanout can overload a single DO -> Shard by tenant/audience and batch event frames when broadcasting multiple records.
- Hibernation resets in-memory state -> Store per-socket attachments and stream cursors, and keep constructor work minimal.
- Queue DLQ and module dead-letter state can diverge -> Consumer failure paths must record module dead-letter metadata when Cloudflare reports exhausted delivery or when DLQ messages are consumed.
- Realtime permission leaks are possible -> Server WebSocket upgrade path must authenticate and authorize stream scope before connecting to the DO, and DO messages should carry only authorized stream payloads.
- Local tests may not fully simulate hibernation -> Add unit tests for DO handlers and platform tests with fake namespaces/queues; reserve full Miniflare/Workers hibernation behavior for integration tests when available.

## Migration Plan

1. Add platform-cloudflare notification-event queue message types, queue publisher adapter, queue consumer handlers, and tests using fake Queue bindings.
2. Add the realtime Durable Object class with SQLite schema setup, hibernatable WebSocket acceptance, subscription attachments, and broadcast/RPC methods.
3. Export the DO class from `apps/server`, add Worker WebSocket upgrade routing, and wire notification-event route options to the Cloudflare runtime adapters.
4. Add Alchemy resources for Queue bindings, DLQ configuration, Durable Object namespace, and Worker env wiring.
5. Add boundary tests proving pure module packages remain free of `cloudflare:workers` and platform imports.
6. Roll back by disabling queue/DO bindings and reverting Worker runtime wiring; module-owned D1 records remain intact.

## Open Questions

- What is the first stream scope: single-store tenant, authenticated admin user, or a broader role/audience key?
- Should queue consumers process event distribution and notification dispatch in one queue or two separate queues?
- Should realtime reconnect history be read only from module D1 APIs, or should each DO maintain a small recent-event cache in SQLite?
- Which Cloudflare testing surface should be added first for WebSocket hibernation: current Bun tests with fakes or `@cloudflare/vitest-pool-workers` integration tests?
