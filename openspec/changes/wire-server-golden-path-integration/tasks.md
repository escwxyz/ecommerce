## 1. Complete Order D1 Persistence

- [x] 1.1 Add failing shared repository-contract coverage for reading, listing, idempotent aggregate creation, transaction recording, state transitions, and order updates against a D1-compatible Kysely database.
- [x] 1.2 Implement the module-owned order D1 repository over the existing order tables and preserve aggregate serialization, idempotency, and D1-compatible compensated aggregate writes required by `OrderRepository`.
- [x] 1.3 Export the order D1 adapter and database option types through the module's public adapter boundary, then run order tests and typecheck.

## 2. Extract And Complete Server Composition

- [x] 2.1 Add failing server assembly tests proving customer, tax, payment, fulfillment, order, and checkout procedures are absent from the current composition and present only when all required dependencies are supplied.
- [x] 2.2 Extract a testable server commerce composition factory that accepts the shared database plus clock/id, coordinator, notification runtime, and provider dependencies without importing Cloudflare bindings into module packages.
- [x] 2.3 Construct customer, tax, payment, fulfillment, and order services from their D1 repositories and register their route fragments in the server API assembly.
- [x] 2.4 Wire checkout and module routes to the same repository, provider, coordinator, clock, id, and event dependencies so cart, pricing, inventory, customer, tax, payment, order, fulfillment, and event state share one runtime graph.
- [x] 2.5 Refactor the Worker entry to adapt D1, Durable Object, Queue, auth, and realtime bindings into the composition factory while preserving existing health, auth, cart-cache, inventory-coordination, and notification behavior.
- [x] 2.6 Add explicit development-provider configuration using seed-compatible `manual` payment and fulfillment providers, and verify non-development composition never enables deterministic providers implicitly.
- [x] 2.7 Add required server workspace dependencies and focused composition tests without introducing new external runtime packages.

## 3. Build The Golden-Path Smoke Harness

- [x] 3.1 Add an isolated server integration harness that applies every D1 SQL migration, executes the generated deterministic seed artifact, exposes the database through production D1 repository implementations, and closes all local resources after each test.
- [x] 3.2 Add deterministic auth/session, id generation, coordination, notification, payment, and fulfillment inputs needed to run the composed server without Cloudflare or external provider credentials.
- [x] 3.3 Drive public Hono/oRPC procedures to create and configure an active cart for the seeded customer, add the seeded product variant with pricing/inventory/tax metadata, and complete checkout with the seeded shipping option and provider key.
- [x] 3.4 Assert the checkout response includes completed status plus order, payment, fulfillment, cart, and workflow identifiers.
- [x] 3.5 Query module-owned storage and assert cart totals/references, inventory reservation, order aggregate, payment collection/session/payment/capture, fulfillment, and checkout event records retain the expected seeded relationships.
- [x] 3.6 Ensure the golden-path test runs under the ordinary server `test` task and remains independent from the credential-gated Alchemy deployment test and developer Wrangler state.

## 4. Verification And Documentation

- [x] 4.1 Run order repository tests, checkout tests, D1 seed tests, server tests, and package-local typechecks for every touched package.
- [x] 4.2 Run repository `bun run check-types`, `bun run test`, and `bun run check`; fix any integration, boundary, formatting, or static-analysis failures.
- [x] 4.3 Run `bun run test:integration` and record whether the Alchemy deployment smoke passed or was credential-skipped without treating that skip as golden-path coverage.
- [x] 4.4 Document the migration, seed, development-provider, and server smoke commands plus the boundary between local commerce integration and deployed health verification.
- [x] 4.5 Sync accepted requirement changes if implementation alters the specification, complete this task checklist, and confirm `openspec status --change "wire-server-golden-path-integration"` is apply-complete before archival.

Verification notes:

- `bun run check-types`, `bun run test`, the server build, and changed-file static analysis passed.
- `bun run check` is clean for this change but remains non-zero because of pre-existing formatting in `apps/web/src/routeTree.gen.ts`; it also reports the existing `packages/ui/src/components/label.tsx` accessibility warning.
- `bun run test:integration` completed with the Alchemy deployment test credential-skipped; the local golden checkout smoke passed independently in the ordinary server test task.
