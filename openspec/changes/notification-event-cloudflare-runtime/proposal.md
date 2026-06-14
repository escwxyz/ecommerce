## Why

The notification/event foundation defines runtime-neutral contracts, but the Cloudflare deployment still needs a concrete asynchronous runtime for guaranteed delivery, retry handling, dead-letter routing, and realtime admin observability. This should follow the foundation without leaking Cloudflare bindings into pure module packages.

## What Changes

- Add a Cloudflare runtime adapter for notification/event delivery using Queues for asynchronous event and notification work.
- Add a tenant- or audience-scoped Durable Object for realtime notification/event observability over hibernatable WebSockets.
- Compose Worker bindings, queue producers/consumers, Durable Object exports, and runtime wiring through `packages/platform-cloudflare` and `apps/server`.
- Preserve `packages/modules/notification-event` as the canonical contract and audit/outbox owner while keeping Cloudflare-specific code in platform/server layers.
- Add tests for queue payload mapping, retry/dead-letter behavior, Durable Object WebSocket hibernation behavior, binding configuration, and import boundaries.

## Capabilities

### New Capabilities

- `notification-event-cloudflare-runtime`: Provides the Cloudflare Queues and Durable Object/WebSocket runtime adapter for the notification/event module foundation.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/platform-cloudflare`, `apps/server`, `packages/infra`, notification/event runtime composition, Cloudflare queue consumers, Durable Object exports and bindings, Worker environment types, and tests.
- Depends on the completed `notification-event-module-foundation` change and the accepted Cloudflare commerce blueprint.
- External platform behavior: Cloudflare Queues for async processing and dead-letter routing; Durable Objects with WebSocket hibernation for realtime admin streams.
