# Commerce Architecture Roadmap

The current source of truth is `openspec/changes/adopt-effect-4-backend-architecture/`. The completed `define-cloudflare-commerce-blueprint` and its follow-up changes remain historical context; their Hono, oRPC, Zod, Kysely, and stronger runtime-coupling decisions are no longer the target.

## Target Architecture

- Effect 4 owns backend services, Layers, typed errors, schemas, configuration, resource safety, concurrency, HTTP, SQL, workflows, and telemetry.
- Effect Schema is canonical at all backend boundaries. Domain, API, and storage schemas remain distinct and transform explicitly.
- Effect HTTP and `HttpApi` define admin and storefront APIs and generate OpenAPI.
- The storefront SDK exposes one contract through browser HTTP and server-only Cloudflare Service Binding transports.
- Effect SQL PostgreSQL and Drizzle ORM 1.0 RC replace Kysely. Modules own repository contracts; adapters own dialect-specific schemas, relations, codecs, migrations, transactions, queries, and repository Layers.
- PostgreSQL is the first relational adapter, connected from Cloudflare through a platform-owned resource expected to use Hyperdrive. Cloudflare is the first production runtime, but runtime-neutral packages require deterministic test Layers.
- Better Auth remains temporarily behind an Effect-native auth boundary; auth reimplementation is out of scope.
- Auth contracts are centered in `@ecommerce/auth/auth-contracts`; Better Auth
  inferred types and provider errors remain private to the adapter.
- Durable Objects are the first keyed actor adapter behind portable Effect contracts. Rivet is a deferred parity-tested alternative.
- PostgreSQL remains authoritative relational storage by default; actor-local storage is coordination, workflow, or cache state unless an accepted design changes ownership.
- Trusted plugins contribute Effect Layers and typed contracts. Sandboxed plugins use Effect Schema capability bridges without host resource access.

## Store, Organization, and Marketplace Boundary

The store tracer slice should follow Medusa's module separation without
hard-coding one tenancy model:

- Better Auth organizations are identity workspaces: membership, invitations,
  active organization/team state, roles, and auth-provider-owned persistence.
- Commerce stores are domain records: store defaults, currencies, locale,
  timezone, default region, default sales channel, and store metadata.
- Future merchants, vendors, markets, and marketplaces are commerce concepts.
  They may link to an auth organization identifier through the Effect auth
  boundary, but they must not import Better Auth organization tables or inferred
  provider types.
- Sales channels remain commerce selling contexts for availability, cart/order
  scoping, and inventory availability. They are not identity tenants.
- Marketplace support should arrive as a commerce module or plugin extension
  that links merchants/vendors/markets to products, orders, stores, and
  workflows. The store module should expose clean ownership/link points, not
  assume that `store = tenant` or `store = Better Auth organization`.

The next store migration should preserve current store behavior first. If it
adds owner fields, those fields should use provider-neutral identifiers such as
`AuthOrganizationId`, `MerchantId`, or future module link IDs, with Better Auth
translation isolated inside the auth adapter/research track.

## Migration Order

1. Pin Effect 4 and establish architecture canaries.
2. Establish shared Schema, error, Layer, config, telemetry, repository, transaction, workflow, and test conventions.
3. Build the Effect SQL PostgreSQL, Drizzle, and clean migration foundation.
4. Build Effect HTTP, canonical APIs, OpenAPI, and storefront SDK transports.
5. Wrap Better Auth behind the Effect auth boundary.
6. Migrate `store` as the tracer slice.
7. Migrate `customer`, then product, region/sales-channel, pricing, and inventory.
8. Migrate cart, promotion, tax, fulfillment, payment, checkout, order, and notification-event.
9. Migrate workflows, transactional outbox delivery, queues, and Durable Object actors.
10. Migrate native and sandboxed plugin contracts.
11. Remove remaining Hono, oRPC, Zod, and Kysely backend code and dependencies.

## Current Status

As of 2026-08-03, the `adopt-effect-4-backend-architecture` implementation is
in completion audit. Backend commerce code has moved to Effect-native schemas,
service contracts, repository contracts, PostgreSQL Drizzle adapters, Effect
HTTP APIs, storefront SDK transports, workflow/outbox/queue/actor contracts,
plugin contracts, and telemetry conventions. Legacy backend Hono route
composition, oRPC router/procedure coupling, Zod boundary schemas, Kysely
contracts/adapters, completed temporary bridges, and backend forbidden-import
gaps have been removed from the migrated backend surface.

The local PostgreSQL operational path is now Drizzle/Effect-only:

- `bun run db:reset-and-seed-development -- --confirm-development-reset`
  resets the adapter-owned development schema, reapplies checked-in
  migrations, and runs the schema-only development seed.
- `POSTGRES_URL=... bun run --cwd packages/db-postgres db:status` reports the
  live migration table state; on 2026-08-03 it reported 14 applied migrations,
  zero pending migrations, and zero failed migrations against the local
  OrbStack/Docker PostgreSQL instance.
- `POSTGRES_URL=... bun run --cwd packages/db-postgres test:live` verifies live
  migration application, transactional outbox commit/rollback behavior,
  duplicate constraint surfacing, row decoding, and concurrent outbox claiming.

Current completion evidence is tracked in
`openspec/changes/adopt-effect-4-backend-architecture/evidence.md`. Root
`bun run test`, backend/API/SDK/server package typechecks, `bun run build`, and
live PostgreSQL verification pass. Root `bun run check` and
`bun run check-types` are intentionally not marked clean because they still
include pre-existing or untracked workspace surfaces outside this task:
`.vscode/settings.json`, untracked `apps/web/src/routeTree.gen.ts`, and
untracked `apps/web` dashboard/oRPC type errors.

As of 2026-07-28, tasks 1.1 through 10.2 of
`adopt-effect-4-backend-architecture` are complete. The store tracer slice and
customer/product/region-sales-channel/pricing/inventory foundational slices,
plus the cart, promotion, tax, fulfillment, payment, checkout, order, and
notification-event transactional slices, have migrated to the Effect backend
architecture:

- `@ecommerce/store` owns Effect Schema domain/API contracts, schema-backed
  tagged errors, Effect services, repository contracts, in-memory test Layers,
  and PostgreSQL Drizzle persistence.
- `@ecommerce/api` exposes the store admin and storefront contracts through
  Effect `HttpApi` groups instead of the legacy store oRPC router.
- `@ecommerce/storefront-sdk` verifies the store storefront contract through
  both public HTTP and server-only Cloudflare Service Binding transports.
- Store Zod contracts, Kysely/D1 repository code, legacy router code, and direct
  legacy package dependencies have been removed from the migrated store slice.
- `@ecommerce/customer` owns Effect Schema domain/API contracts,
  schema-backed tagged errors, Effect services, repository contracts,
  in-memory test Layers, and PostgreSQL Drizzle persistence. Its legacy Zod,
  Kysely/D1 repository, shared-D1 migration, oRPC router, and related public
  exports have been removed.
- `@ecommerce/api` exposes customer admin operations through Effect `HttpApi`
  groups instead of the legacy customer oRPC router.
- `@ecommerce/product` owns Effect Schema domain/API contracts,
  schema-backed tagged errors, Effect services, repository contracts,
  in-memory test Layers, and PostgreSQL Drizzle persistence. Its legacy Zod,
  Kysely/D1 repository, shared-D1 migration, oRPC router, and related public
  exports have been removed.
- `@ecommerce/api` exposes product admin operations through Effect `HttpApi`
  groups instead of the legacy product oRPC router.
- `@ecommerce/region-sales-channel` owns Effect Schema domain/API contracts,
  schema-backed tagged errors, Effect services, repository contracts,
  in-memory test Layers, and PostgreSQL Drizzle persistence. Its legacy Zod,
  Kysely/D1 repository, shared-D1 migration, oRPC router, and related public
  exports have been removed.
- `@ecommerce/api` exposes region and sales-channel admin operations through
  Effect `HttpApi` groups instead of the legacy oRPC router.
- `@ecommerce/pricing` owns Effect Schema domain/API contracts,
  schema-backed tagged errors, Effect services, repository contracts,
  in-memory test Layers, and PostgreSQL Drizzle persistence. Its legacy Zod,
  Kysely/D1 repository, shared-D1 migration, oRPC router, and related public
  exports have been removed.
- `@ecommerce/api` exposes pricing admin operations through an Effect
  `HttpApi` group instead of the legacy pricing oRPC router.
- `@ecommerce/inventory` owns Effect Schema domain/API contracts,
  schema-backed tagged errors, Effect services, repository contracts,
  in-memory test Layers, and PostgreSQL Drizzle persistence. Its legacy Zod,
  Kysely/D1 repository, shared-D1 migration, oRPC router, and related public
  exports have been removed.
- `@ecommerce/api` exposes inventory admin operations through an Effect
  `HttpApi` group instead of the legacy inventory oRPC router.
- `@ecommerce/cart` owns Effect Schema domain/API contracts, schema-backed
  tagged errors, Effect-native services, repository contracts, in-memory test
  Layers, active-cart cache/actor ports, and PostgreSQL Drizzle persistence. Its
  legacy Zod contracts, Kysely/D1 repository, shared-D1 migration, oRPC router,
  and related public exports have been removed.
- `@ecommerce/api` exposes cart admin operations through an Effect `HttpApi`
  group instead of the legacy cart oRPC router.
- `@ecommerce/platform-cloudflare` adapts the cart active-cache Durable Object
  through the Effect-native cache port. Projection sync failures preserve the
  underlying expected-error message when available.
- `@ecommerce/promotion` owns Effect Schema domain/API contracts,
  schema-backed tagged errors, Effect-native services, repository contracts,
  in-memory test Layers, and PostgreSQL Drizzle persistence for campaigns,
  promotions, rules, usage limits, and redemptions. Its legacy Zod contracts,
  Kysely/D1 repository, shared-D1 migration, oRPC router, and related public
  exports have been removed.
- `@ecommerce/api` exposes promotion admin operations through an Effect
  `HttpApi` group instead of the legacy promotion oRPC router.
- `@ecommerce/tax` owns Effect Schema domain/API contracts, schema-backed
  tagged errors, Effect-native services, provider contracts, repository
  contracts, in-memory test Layers, and PostgreSQL Drizzle persistence for tax
  categories, provider configuration, regions, and rates. Its legacy Zod
  contracts, Kysely/D1 repository, shared-D1 migration, oRPC router, and
  related public exports have been removed.
- `@ecommerce/api` exposes tax admin operations through an Effect `HttpApi`
  group instead of the legacy tax oRPC router.
- `@ecommerce/fulfillment` owns Effect Schema domain/API contracts,
  schema-backed tagged errors, Effect-native services, provider contracts,
  repository contracts, in-memory test Layers, and PostgreSQL Drizzle
  persistence for providers, fulfillment sets, shipping profiles, service
  zones, shipping options, fulfillments, shipments, and return-shipment links.
  Its legacy Zod contracts, Kysely/D1 repository, shared-D1 migration, oRPC
  router, and related public exports have been removed.
- `@ecommerce/api` exposes fulfillment admin operations through an Effect
  `HttpApi` group instead of the legacy fulfillment oRPC router.
- `@ecommerce/payment-provider` is an Effect-native provider boundary with a
  temporary Promise-provider bridge for external SDK adapters that have not yet
  migrated.
- `@ecommerce/payment` owns Effect Schema domain/API contracts, schema-backed
  tagged errors, Effect-native services, provider registry integration,
  repository contracts, in-memory test Layers, and PostgreSQL Drizzle
  persistence for providers, account holders, methods, collections, sessions,
  payments, captures, and refunds. Its legacy Zod contracts, Kysely/D1
  repository, shared-D1 migration, oRPC router, and related public exports have
  been removed.
- `@ecommerce/api` exposes payment admin operations through an Effect `HttpApi`
  group instead of the legacy payment oRPC router.
- The legacy D1 seed no longer creates migrated commerce records. Checkout now
  acquires Store, Customer, Product, Region, Sales Channel, Pricing, Promotion,
  Tax, Inventory, Cart, Payment, Fulfillment, Order, Notification Event, and
  atomic completion-store services through public Effect service tags, with
  Clock and identifier behavior supplied explicitly by runtime composition. Its
  deterministic suite composes those dependencies as Layers and exercises one
  `CheckoutService.completeCheckout` Effect across success, failure,
  idempotency, compensation, and interruption.
- The server-owned checkout compatibility runtime, development seed
  substitutions, broad input casts, and Payment/Fulfillment Promise bridges have
  been deleted. The checkout HTTP suite remains a thin transport test over the
  same `CheckoutService` interface.
- Order now has Effect Schema domain/API contracts, typed errors, Effect-native
  service and repository contracts, in-memory test Layers, PostgreSQL Drizzle
  persistence, and admin Effect HTTP API assembly. Its legacy Zod contracts,
  Kysely/D1 repository, shared-D1 schema, oRPC router, and related public
  exports have been removed.
- Notification-event now has Effect Schema domain/API contracts, typed errors,
  Effect-native service and repository contracts, in-memory test Layers,
  PostgreSQL Drizzle persistence, Cloudflare queue/realtime bridges that run
  repository Effects at the platform boundary, and admin Effect HTTP API
  assembly. Its legacy Zod contracts, Kysely/D1 repository, shared-D1 schema,
  oRPC router, and related public exports have been removed.
- The shared section-7 verification gate has passed for foundational module
  repository contracts, Effect HTTP API assembly, permission metadata,
  storefront SDK transports and browser boundaries, runtime import boundaries,
  shared auth contracts, PostgreSQL/D1 compatibility checks, and the
  credential-free Cloudflare Worker/platform suites.
- The shared section-8 verification gate has passed for the cross-module
  checkout golden path, expected checkout failure/idempotency behavior,
  permission-protected Effect HTTP APIs, Cloudflare queue/retry/concurrency
  primitives, PostgreSQL repository/outbox contracts, and migrated module
  boundary suites. Live PostgreSQL concurrency checks remain opt-in with
  `POSTGRES_URL`.
- Section 9.1 and 9.2 have defined and exercised the portable workflow
  durable-message contract in `@ecommerce/core`: schema-versioned workflow
  descriptors, persisted run state, step outcomes, retry policy, retry
  disposition, and compensation policy now decode through Effect Schema, and
  the deterministic in-memory runtime can persist, recover, skip completed
  side effects, and record failed/compensated outcomes without importing
  Cloudflare, Drizzle, Hono, oRPC, or module runtime adapters.
- Section 9.3 wires the Cloudflare workflow and queue adapters into
  runtime-neutral Effect service Layers. Queue publishing and workflow binding,
  dispatch queue, Durable Object coordinator, metadata/state-store, and
  lifecycle-event failures are normalized to schema-backed tagged errors at the
  platform boundary, while bounded telemetry records successful and failed
  queue/workflow runtime operations. The Cloudflare workflow adapter can now
  persist and recover schema-versioned workflow state through the shared
  `CommerceWorkflowStateStore` contract when one is provided.
- Section 9.4 adds the runtime-neutral transactional-outbox delivery cycle. It
  claims bounded post-commit batches, maps each outbox record to a stable queue
  message id plus preserved domain idempotency key, acknowledges records only
  after queue publication succeeds, persists queue rejection as an outbox
  failure, and retains typed persistence failures for runtime retry. Core tests
  cover success and rejection behavior, while the Cloudflare adapter test
  proves replay produces identical queue identity for consumer deduplication.
- Section 9.5 replaces the permanent actor design surface with Effect-native,
  platform-neutral contracts in `@ecommerce/core/stateful`. Schema-versioned
  commands, results, timers, state snapshots, and ownership descriptors now
  preserve actor identity, correlation, idempotency, recovery source, and state
  authority. Effect service tags cover command dispatch, timers, and state
  persistence, while a deterministic in-memory Layer verifies deduplication,
  state versioning, and timer cancellation without Cloudflare bindings.
  Actor-local relational ownership is rejected unless it names the accepted
  design that explicitly transferred authority away from PostgreSQL.
- Section 9.6 implements the first Cloudflare Durable Object adapter for those
  contracts. The platform Layer routes each actor type/key to a named Durable
  Object and translates transport or response-decoding failures into the
  command, timer, or state service's schema-backed error. The Durable Object
  host decodes every command, result, timer, and state message, serializes actor
  turns, durably deduplicates commands, atomically persists a changed state
  snapshot with its command result, and maintains the earliest Cloudflare alarm
  for the actor's durable timer set.
- Section 9.7 evaluates the beta.93 Effect SQL Durable Object SQLite adapter.
  It is approved for actor-local workloads that need relational queries,
  indexes, migrations, or multi-statement transactions, but is not added merely
  to rewrite the keyed actor's small key-value layout. Notification realtime is
  the first concrete conversion candidate because it already uses raw Durable
  Object SQLite.
- Section 9.8 records the normative owner and recovery source for every current
  stateful workload in `docs/stateful-workload-ownership.md`. PostgreSQL owns
  commerce records, projections, outbox state, and queryable workflow metadata;
  actor-local storage owns only declared coordination, cache, workflow-history,
  timer, and fanout state; queues are transit rather than authority.
- Section 9.9 completes the deterministic recovery gate. The in-memory workflow
  runtime now preserves real Effect interruption without turning it into a
  failed step or compensation, executes declared retry policies, and persists
  every failed attempt with retry disposition and bounded backoff metadata.
  Tests prove replay skips completed side effects, terminal compensation is not
  repeated, outbox replay preserves queue identity, restarted actors reuse
  durable command/state records, and due timers dispatch after actor restart.
- Section 9.10 creates the deferred
  `evaluate-rivet-stateful-runtime-parity` change. It requires Rivet to
  implement the same portable contracts and pass hard consistency,
  idempotency, interruption, restart, and timer-recovery gates before latency,
  placement, deployment, operations, or cost trade-offs can support a separate
  production-adoption proposal.
- Section 10.1 replaces trusted native-plugin manifest interfaces with a
  versioned Effect Schema. Registration now decodes validated plugin IDs,
  semantic versions, and structured required/optional capability declarations
  before retaining executable contributions. Capability keys are namespaced
  runtime-neutral service identifiers rather than auth permissions, bindings,
  SQL clients, or secrets.
- Section 10.2 replaces trusted-plugin executable descriptors with typed
  Effect contribution contracts. Services and providers contribute concrete
  service tags plus Layers; API extensions contribute Effect `HttpApiGroup`
  contracts and handler Layers; workflow and event handlers expose their Effect
  requirements and the Layers that satisfy them. Heterogeneous plugin
  composition preserves each contribution's inferred tag and Layer types
  without weakening the registry to `any`, and plugin API groups compose
  directly through the canonical API assembler.
- Section 10.3 makes trusted-plugin runtime composition deterministic and
  observable. Composition sorts active plugins by decoded plugin ID, validates
  required portable capabilities against the host capability set, and rejects
  duplicate executable keys, admin surface keys, and storage namespaces before
  any Layer is used. Lifecycle dispatch runs sequentially in plugin-ID order,
  returns state transitions only after successful hooks, and records correlated
  `plugin.lifecycle` spans, logs, and bounded success/Cause outcomes through the
  shared Effect telemetry policy. Deterministic tests cover validation,
  composition, lifecycle success/defect behavior, and telemetry capture without
  Cloudflare bindings.
- Section 10.4 replaces sandbox manifest and bridge message validation with
  Effect Schema. `@ecommerce/core/plugins` now owns schemas for sandbox
  manifests, grant policies, bridge contexts, bridge operations, audit events,
  runtime errors, and entrypoint responses. Existing helper APIs preserve their
  public behavior while decoding manifests and bridge messages before they cross
  into host policy code.
- Section 10.5 adds the runtime-neutral `SandboxCapabilityBridgeService`.
  Sandbox bridge invocations now decode context and operation messages,
  enforce granted capabilities, absolute deadlines, and per-scope quotas before
  host dispatch, return schema-backed `SandboxBridgeFailure` values, record
  allow/deny evidence through `DurableAudit`, and wrap execution in
  `plugin.sandbox.bridge` telemetry.
- Section 10.6 locks sandbox host-resource boundaries with tests. Sandbox
  storage namespaces and bridge contexts now reject reserved host-resource
  names such as `secrets` and `sql`; core plugin contracts ban direct SQL,
  database adapter, Cloudflare binding, and platform-runtime imports; and the
  Cloudflare sandbox adapter verifies Worker Loader entrypoints receive only
  mediated `bridge` plus decoded `context` values.
- Section 10.7 adapts Worker Loader execution to the new bridge contract. The
  sandbox-facing Cloudflare bridge remains a narrow Promise facade because
  sandbox workers call methods imperatively, but every facade operation now
  routes through `SandboxCapabilityBridgeService` first. The platform adapter
  provides a `DurableAudit` Layer that mirrors core allow/deny audit evidence
  into sandbox audit events before platform-specific storage, egress, auth, or
  response handling continues.
- Section 10.8 verifies the sandbox runner and bridge failure boundaries.
  Credential-free tests now cover activation gating, malformed Effect Schema
  bridge messages, capability denial, denied outbound hosts, storage namespace
  isolation, invalid Worker Loader responses, sandbox defects, host-side
  invocation timeouts, and sanitized invoke audit records.

## Current Gaps

- Live PostgreSQL store/customer/product/region-sales-channel/pricing/inventory/cart/promotion/tax/fulfillment/payment/order/notification-event
  contract verification is opt-in and still requires `POSTGRES_URL`.
  Credential-free
  suites validate the in-memory contract, package type shape, migrations as
  checked-in files, API contracts, SDK transports, and Worker composition.
- Checkout no longer exports legacy Zod/oRPC contracts or Promise facades. The
  production Worker still omits its HTTP contribution until terminal Payment and
  Fulfillment providers plus a durable checkout completion-store adapter are
  registered; deterministic in-memory completion state is test-only.
- The task-9.4 delivery cycle and Cloudflare queue Layer compose through
  runtime-neutral Effect services. The deployed Worker now composes the
  PostgreSQL notification-event repository and Cloudflare queue processor, but
  it does not yet schedule the generic PostgreSQL outbox drain. Credential-free
  tests continue to cover deterministic claimer and queue Layers.
- Section 12.5 removes the completed Promise-shaped cart/inventory coordinator
  bridge. Cart and inventory now accept `KeyedActorService` directly, the
  deprecated Cloudflare coordinator facade is gone, and only
  `KeyedActorDurableObject` remains as the exported generic actor class.
- The generic `KeyedActorDurableObject` currently provides coordination,
  deduplication, state, and timer hosting with a no-op command interpreter.
  Commerce-specific actor behavior must compose
  `createKeyedActorDurableObjectHandler` with its own typed command handler.
  Ownership is recorded in `docs/stateful-workload-ownership.md`; task 9.9 now
  supplies interruption, restart, duplicate-delivery, and timer-recovery
  evidence for the generic host, but production commerce actors still need
  workload-specific handlers and runtime Layer composition.
- The deployed Worker now has one production composition in
  `apps/server/src/production-commerce-runtime.ts`. It requires Hyperdrive,
  cart-cache and keyed-actor Durable Object namespaces, and notification queue
  and realtime bindings; missing production bindings fail closed with a typed
  configuration error. The composition supplies PostgreSQL repositories and
  Cloudflare adapters to migrated module services, while deterministic
  in-memory repositories, actors, providers, and checkout completion state are
  selected only by explicit testing Layers. Payment,
  fulfillment, and notification-dispatch HTTP groups remain disabled until
  terminal production providers are registered.
- The cart Durable Object cache is a hot aggregate and ownership/idempotency
  coordination primitive, not the durable source of truth. PostgreSQL remains
  authoritative for cart, line-item, and adjustment persistence.
- Better Auth remains behind the Effect auth adapter with a temporary
  provider-private D1 persistence seam. The old D1/Kysely adapter package has
  been removed; replacement or deeper Effect integration remains a follow-up
  research/change item.
- Native plugin manifests, executable contributions, composition validation,
  lifecycle dispatch, and lifecycle telemetry are Effect-native. Production
  hosts must pass their portable capability set to composition and persist any
  lifecycle state they need outside the runtime-neutral contract. Sandboxed
  manifests, bridge messages, capability enforcement, deadlines, quotas, typed
  failures, durable audit records, core bridge telemetry, reserved namespace
  rejection, sandbox host-resource boundary tests, Worker Loader bridge
  execution, and sandbox runner failure verification are now Effect-native.
  Production smoke coverage against a real Worker Loader binding remains a
  credential-gated Cloudflare runtime check.
- Section 11.1 selects the first Cloudflare telemetry exporter. The platform
  package now exposes `createCloudflareTelemetryLayer`, a Workers Logs exporter
  that installs Effect logger and tracer Layers and writes sanitized structured
  log/span records to the Worker `console`.
- Section 11.2 adds the shared `CorrelationContext` propagation helpers and
  carries optional trace identity across HTTP ingress, storefront SDK HTTP and
  Service Binding transports, PostgreSQL outbox rows, queue messages, workflow
  state/events/dispatch, Durable Object actor commands, sandbox plugin bridge
  context, and provider operation inputs.
- Sections 11.3 and 11.4 add shared redaction/cardinality policy constants,
  strict metric-label sanitization, the `typed_rejection` operation outcome, and
  the bounded `commerce_runtime_event_total` taxonomy for typed rejections,
  defects, interruptions, retries, compensation, and poison messages. External
  metric shipping remains a future exporter concern.
- Sections 11.5 and 11.6 verify the observability failure boundaries:
  Cloudflare exporter defects do not replace ordinary commerce successes or
  typed failures, while required sandbox bridge audit evidence still fails
  through the explicit `DurableAudit` persistence contract before host
  operations run.
- Section 12.1 removes the legacy Hono Worker composition. The default server
  Worker now routes commerce traffic through the Effect HTTP runtime and mounts
  Better Auth directly at its temporary adapter path; oRPC, Zod, Kysely, and
  completed temporary bridges are removed by the remaining section 12 tasks.
- Section 12.2 removes the backend oRPC router/procedure/client assembly from
  `packages/api` and the server runtime. The root oRPC catalog entries remain
  temporarily because the currently untracked admin frontend workspace still
  declares oRPC catalog dependencies; remove those entries when the frontend
  admin client is migrated or the untracked workspace is reconciled.
- Section 12.3 removes stale backend Zod dependency declarations and blocks Zod
  from the backend API package. `packages/env` keeps Zod only for the frontend
  `./web` environment helper until that frontend-only surface is migrated.
- Section 12.4 removes the tracked Kysely database contracts, D1 dialect helper
  package, DB utility package, Kysely dependencies, and D1 seed/migration
  workflow. Better Auth's generated D1 SQL now lives under `packages/auth`, and
  the server passes the raw Worker D1 binding directly to the Better Auth
  factory until the auth-provider follow-up resolves that seam.

## Slice Completion Rule

A slice is complete only when its domain/API/storage schemas, typed errors, services, persistence, HTTP contract, applicable workflows and platform adapters, telemetry, and tests use the new Effect architecture and its replaced legacy code and dependencies are deleted.

Temporary bridges require an owner, an OpenSpec removal task, and a deletion criterion. Newly migrated code must not introduce new dependencies on a temporary bridge.

## Portability Rule

Cloudflare-first does not mean Cloudflare-coupled. A contract is portable only when it has a deterministic non-Cloudflare Layer and import-boundary tests prevent platform APIs from entering runtime-neutral packages. Node, Bun, additional SQL dialects, alternate actor runtimes, and alternate telemetry exporters are later adapter changes.

## Comment Rule

Shared JSDoc and architecture comments should name the boundary they protect:
runtime-neutral domain contract, Effect service tag, request scope, repository
contract, temporary migration bridge, platform adapter, or deterministic test
Layer. Comments on temporary bridges must say what future task replaces them so
they do not become permanent abstractions.

## Working Rule

Follow `openspec/changes/adopt-effect-4-backend-architecture/tasks.md` in dependency order. Do not add new backend usage of Hono, oRPC, Zod, or Kysely.
