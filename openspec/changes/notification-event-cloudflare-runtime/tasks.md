## 1. Runtime Boundary

- [x] 1.1 Confirm `notification-event-module-foundation` public exports and keep Cloudflare imports out of `packages/modules/notification-event`.
- [x] 1.2 Define Cloudflare runtime package surfaces for queue publishing, queue consuming, realtime stream routing, and Durable Object exports.

## 2. Queue Runtime

- [x] 2.1 Add notification-event queue message types and queue publisher mapping in `packages/platform-cloudflare`.
- [x] 2.2 Implement event distribution and notification dispatch queue consumer handlers with idempotency and retry metadata.
- [x] 2.3 Map exhausted Queue/DLQ messages to module-owned dead-letter records without duplicating provider sends.
- [x] 2.4 Wire notification-event route/service options in server composition to enqueue Cloudflare runtime work after module-owned state is persisted.

## 3. Realtime Durable Object Runtime

- [x] 3.1 Add `NotificationEventRealtimeDurableObject` with constructor-time SQLite schema setup and deterministic stream scope initialization.
- [x] 3.2 Implement hibernatable WebSocket acceptance, WebSocket attachments, message/close handlers, and stream subscription metadata.
- [x] 3.3 Add broadcast/RPC methods for queue consumers to publish event, retry, dead-letter, dispatch, and provider result updates to stream-scoped clients.
- [x] 3.4 Add authenticated and permission-checked Worker route for notification-event realtime WebSocket upgrades.

## 4. Cloudflare Resource Composition

- [x] 4.1 Export the realtime Durable Object class from `apps/server` and type the required Worker env bindings.
- [x] 4.2 Add Alchemy resources for notification-event Queue, dead-letter queue behavior, Durable Object namespace, migrations, and Worker bindings.
- [x] 4.3 Preserve fallback/local test behavior when Cloudflare Queue or Durable Object bindings are absent.

## 5. Verification

- [x] 5.1 Add platform tests for queue payload mapping, consumer idempotency, retry/dead-letter handling, and realtime DO broadcast routing with fake bindings.
- [x] 5.2 Add server and infra tests for Worker exports, WebSocket route authorization, binding configuration, and Alchemy resource graph.
- [x] 5.3 Add or extend import-boundary tests proving pure modules do not import Cloudflare runtime or platform adapter code.
- [x] 5.4 Run targeted platform/server/infra tests plus repo-relevant typecheck and lint.

## 6. Local Development Maintenance

- [x] 6.1 Omit notification queue bindings and consumer registration in Alchemy local mode, where queue bindings are unsupported.
- [x] 6.2 Run the admin app through its standalone Vite task during local development while retaining Alchemy Vite deployment composition.
