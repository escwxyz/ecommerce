## Context

The notification-event module currently owns event outbox records, notification templates, provider registrations, dispatch audit records, retries, and dead letters. The Cloudflare adapter queues notification delivery work, but `apps/server` hardcodes queue-publishing wrappers for email, SMS, webhook, and in-app while the queue consumer has no concrete delivery providers. Those accepted messages therefore fail provider lookup and eventually dead-letter.

The first complete notification channel is intentionally limited to authenticated administrators using the existing admin application. External channels require provider SDKs, secrets, lifecycle handling, and plugin composition, so they remain deferred until the native and sandboxed plugin runtime is stable. Pure module code must remain independent of Cloudflare bindings, and `apps/server` remains composition only.

## Goals / Non-Goals

**Goals:**

- Deliver queued in-app notifications into a durable, administrator-scoped inbox.
- Model unread/read/archive state independently from provider delivery audit state.
- Derive inbox ownership from the authenticated administrator context.
- Expose typed APIs and admin metadata for inbox discovery and lifecycle operations.
- Replace the placeholder admin bell with a usable, accessible inbox and notification history screen.
- Ensure request-side queued providers and queue-consumer delivery providers are derived from the same executable provider registry.
- Preserve queue idempotency, retry, dead-letter, and realtime observability behavior.

**Non-Goals:**

- Implement customer or storefront notifications.
- Implement email, SMS, webhook, push, or provider-specific SDK adapters.
- Compose notification providers from native or sandboxed plugins in this change.
- Build unrestricted plugin-provided frontend UI.
- Replace dispatch/outbox audit storage or make the realtime Durable Object canonical inbox storage.

## Decisions

1. Add a separate module-owned admin inbox aggregate.

   The notification-event module will own an inbox record and repository contract with D1 persistence. A record includes a stable ID, recipient administrator ID, source dispatch ID, presentation content, optional action target and metadata, correlation/causation/workflow trace fields, `createdAt`, optional `readAt`, and optional `archivedAt`. The source dispatch ID is unique so queue retries cannot create duplicate inbox entries.

   Alternative considered: add read and archive fields to `notification_dispatch`. Rejected because dispatches are provider delivery audit records, while inbox state is recipient-specific presentation state with a different lifecycle and query pattern.

2. Treat `in-app` as a built-in delivery provider behind the existing provider contract.

   The provider consumes a normalized dispatch and template, persists the inbox record through the module repository, and returns a delivered result only after persistence succeeds. It remains runtime-neutral and does not import Cloudflare Queue APIs. The Cloudflare consumer receives this concrete provider; request handling receives a queue-publishing wrapper for the same provider key.

   Alternative considered: bypass notification dispatch and write inbox records directly from order or other modules. Rejected because it would couple modules to notification storage and bypass idempotency, audit, retry, and trace behavior.

3. Derive request and consumer provider sets from one composition result.

   Server composition will first build concrete delivery providers. If a queue binding exists, request-side notification services receive queue-publishing wrappers derived only from those provider keys, while the queue handler receives the concrete providers. Without a queue binding, request-side services may use the concrete providers directly. No queue wrapper is ever registered as its own consumer.

   Alternative considered: retain a hardcoded channel list in `apps/server`. Rejected because it advertises unavailable providers and cannot reflect plugin activation or deactivation later.

4. Scope all inbox API operations to the authenticated administrator.

   Route handlers will extract a stable administrator user ID from the shared auth/session context and pass it as an explicit service scope. Current-inbox APIs will not accept a recipient ID. Repository queries and mutations include that recipient scope, and notification read permission remains required for reads and personal lifecycle mutations.

   Alternative considered: expose recipient IDs and rely only on broad notification permissions. Rejected because a caller could enumerate or mutate another administrator's inbox.

5. Use cursor-based inbox listing and stored lifecycle timestamps.

   Default listing returns unarchived records newest first, with a stable cursor based on creation time plus record ID. Optional unread filtering and a dedicated unread count support compact admin UI. Read and archive operations store timestamps and are idempotent; marking unread clears `readAt`.

   Alternative considered: offset pagination and boolean-only state. Rejected because inserts can shift offsets, while timestamps preserve lifecycle audit information and deterministic ordering.

6. Keep D1 authoritative and realtime delivery best-effort.

   Inbox records are durable module data in D1. Existing notification-event realtime publication may announce inbox creation or lifecycle updates after persistence, but Durable Object stream state does not become the inbox source of truth.

   Alternative considered: store inbox records in the realtime Durable Object. Rejected because Durable Objects are coordination/fanout primitives here, not the primary long-lived business record store.

7. Reserve external provider composition for a follow-up plugin change.

   This change removes email, SMS, and webhook from the built-in executable set. A later change will normalize active `CommercePluginProviderDescriptor` contributions into notification delivery providers, including a host adapter for sandboxed plugin entrypoints. The built-in registry shape should allow those providers to be appended later without changing notification module contracts.

   Alternative considered: add fake external providers in development. Rejected because fake delivery masks missing provider configuration and does not prove production delivery behavior.

8. Provide a compact header inbox plus a dedicated history screen.

   The existing admin header bell becomes an icon button with an accessible unread indicator and a popover or sheet containing a bounded recent list. A dedicated `/dashboard/notifications` route provides paginated history, unread/archived filters, and lifecycle actions. Both surfaces use the shared typed oRPC client and query invalidation so mutations update unread count and lists without page reloads.

   Alternative considered: rely only on admin metadata for a future dashboard change. Rejected because a built-in in-app provider is not operationally complete until the administrator can see and manage delivered records.

## Risks / Trade-offs

- Inbox growth can make listing and unread counts expensive -> Add recipient/state/order indexes and bounded pagination; retention policy can be a later change.
- Template payloads may not map cleanly to title/body/action fields -> Define a normalized in-app presentation payload and reject malformed in-app dispatches before persistence.
- Administrator deletion or identity changes can leave historical rows -> Store the stable auth user ID and retain rows as audit/presentation history unless a later retention policy removes them.
- Plugin activation can later change available provider keys -> Keep provider-key derivation centralized so request and consumer registries cannot diverge.
- Queue delivery can persist an inbox record before a later realtime broadcast fails -> Treat D1 persistence as successful delivery and keep realtime best-effort.
- Header polling or refetching can create unnecessary load -> Use bounded queries, sensible stale time, mutation invalidation, and the existing realtime stream only as an optional refresh signal.

## Migration Plan

1. Add inbox domain schemas, repository contracts, D1 migration/table/indexes, and repository contract tests.
2. Add the built-in in-app provider and idempotent service behavior with module tests.
3. Add authenticated inbox API contracts, route handlers, permissions, and admin metadata.
4. Refactor server notification provider composition so request wrappers are derived from concrete delivery providers and the queue consumer receives those concrete providers.
5. Add the admin header inbox and notification history route with query/mutation state and component tests.
6. Add queue and server integration tests proving in-app delivery, duplicate handling, unavailable external providers, and recipient isolation.
7. Apply the D1 migration before deploying the Worker composition. Roll back by disabling inbox routes/provider registration and reverting the additive table migration; existing dispatch and outbox records remain intact.

## Open Questions

- What retention period or per-administrator maximum should apply to archived inbox records? This can remain a follow-up unless operational limits require it before launch.
