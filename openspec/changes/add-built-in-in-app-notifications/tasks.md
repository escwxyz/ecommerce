## 1. Inbox Domain and Persistence

- [ ] 1.1 Add failing module repository-contract tests for creating an administrator inbox record idempotently by source dispatch, listing owned records with cursor/unread/archive filters, counting unread records, and recipient-scoped read/unread/archive mutations.
- [ ] 1.2 Define the admin inbox record, normalized in-app presentation payload, identifier/schema types, repository contract, service operations, and module schema ownership with public JSDoc at package boundaries.
- [ ] 1.3 Add the inbox table, recipient/state/order and unique source-dispatch indexes, shared migration coordination, D1 migration SQL, and the D1 repository implementation without coupling module services to D1 runtime types.
- [ ] 1.4 Run notification-event, database, and D1 migration/repository tests plus package-local typechecks before building delivery behavior.

## 2. Built-In In-App Delivery

- [ ] 2.1 Add failing provider tests proving a valid in-app dispatch creates one owned inbox record, duplicate delivery returns the existing result, malformed presentation data fails without marking delivery successful, and persistence failure remains retryable.
- [ ] 2.2 Implement the runtime-neutral built-in `in-app` provider behind `NotificationProvider`, persist before returning delivered, and preserve dispatch, correlation, causation, and workflow trace identities.
- [ ] 2.3 Implement administrator-scoped inbox list, unread-count, read, unread, mark-all-read, and archive service operations with idempotent lifecycle timestamps and no cross-recipient mutation path.
- [ ] 2.4 Add realtime update hooks for persisted inbox creation and lifecycle changes while keeping D1 authoritative and realtime publication best-effort.

## 3. Authenticated API and Admin Metadata

- [ ] 3.1 Add failing API fragment tests for authenticated ownership derivation, notification permission enforcement, stable pagination/filter schemas, unread count, lifecycle mutations, and concealment of another administrator's record.
- [ ] 3.2 Add schema-backed oRPC contracts and handlers for current-administrator inbox listing, unread count, read/unread, mark-all-read, and archive operations; derive the stable administrator ID only from shared session context.
- [ ] 3.3 Extend notification-event permissions and admin metadata with the inbox surface and typed operation references while preserving the existing event/dispatch observability surface.
- [ ] 3.4 Verify API assembly, OpenAPI validation, notification-event route tests, and package-local typechecks.

## 4. Server and Queue Composition

- [ ] 4.1 Add a failing server/Worker regression proving every request-side queued provider key has a concrete queue-consumer delivery provider and proving a queued wrapper is never registered as its own consumer.
- [ ] 4.2 Replace the hardcoded email/SMS/webhook/in-app list with one notification provider composition result: built-in in-app delivery providers for the consumer and queue wrappers derived from those executable keys for request handling.
- [ ] 4.3 When the queue binding is absent, compose the built-in provider for direct delivery; when an external provider key is unavailable, reject dispatch before queue acceptance instead of creating guaranteed dead-letter work.
- [ ] 4.4 Add queue integration coverage for successful in-app persistence, duplicate message handling, retryable failure, realtime update behavior, and absence of recursive queue publication.

## 5. Admin Inbox Experience

- [ ] 5.1 Add failing web tests for the header unread state, recent-inbox loading/empty/error/content states, read/archive mutation behavior, permission-hidden state, and notification-history filtering.
- [ ] 5.2 Replace the placeholder header bell with an accessible icon control, unread indicator, and responsive popover or sheet backed by typed inbox queries and mutations.
- [ ] 5.3 Add the authenticated `/dashboard/notifications` route with paginated owned records, unread/archived filters, mark-all-read, individual read/unread, archive actions, and coherent loading, empty, error, and mutation states.
- [ ] 5.4 Update web test/typecheck workflows as needed and verify query invalidation keeps the header count, recent list, and history screen synchronized without full-page reloads.

## 6. Verification and Handoff

- [ ] 6.1 Run formatting and static analysis for changed files, then run package-local tests and typechecks for notification-event, db, db-d1, platform-cloudflare, api, server, and web.
- [ ] 6.2 Run repository `bun run check-types`, `bun run test`, `bun run check`, and the ordinary server golden-path integration suite; record any credential-gated deployment smoke separately.
- [ ] 6.3 Apply migrations and seed or fixture updates in an isolated local database, then smoke-test queue delivery through the server API into an administrator inbox and verify recipient isolation and duplicate handling.
- [ ] 6.4 Verify the admin inbox visually and interactively at desktop and mobile widths, including keyboard access, focus behavior, unread updates, overflow, and non-overlapping layout.
- [ ] 6.5 Document the built-in provider boundary and the follow-up contract for plugin-contributed email, SMS, webhook, or other external providers; do not advertise those keys until an active plugin supplies executable delivery.
- [ ] 6.6 Sync accepted requirement changes, complete the checklist, and confirm `openspec status --change "add-built-in-in-app-notifications"` is apply-ready before implementation closure.
