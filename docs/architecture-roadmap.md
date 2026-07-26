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

As of 2026-07-26, tasks 1.1 through 9.2 of
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
- The legacy D1 seed no longer creates `store`, `customer`, `product`,
  `product_variant`, `region`, `region_country`, `sales_channel`, or
  `sales_channel_product`, pricing records, inventory records, cart tables, or
  promotion/tax/fulfillment/payment/order tables. Checkout smoke tests now run
  against the remaining legacy D1 modules by
  using temporary server-owned store defaults, customer payment-identity,
  deterministic product-variant validation, deterministic region/sales-channel
  validation, deterministic pricing calculation and inventory
  availability/reservation facades, and Promise facades over the Effect cart,
  promotion, tax, fulfillment, payment, and order services behind the Effect checkout
  service boundary. The tax facade translates the legacy checkout commerce-region ID
  into the seeded tax-region ID rather than weakening migrated tax identifier
  schemas.
- The checkout compatibility facades are intentionally not new module adapters:
  they preserve only the development golden-path invariants formerly supplied
  by deleted D1 seed rows. Task 8.9 removed checkout's remaining legacy
  Zod/oRPC contract/router package surface and the server oRPC checkout route.
  The golden-path suite now exercises the composed Effect checkout service
  directly while durable workflow/runtime Layer composition remains deferred to
  section 9.
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

## Current Gaps

- Live PostgreSQL store/customer/product/region-sales-channel/pricing/inventory/cart/promotion/tax/fulfillment/payment/order/notification-event
  contract verification is opt-in and still requires `POSTGRES_URL`.
  Credential-free
  suites validate the in-memory contract, package type shape, migrations as
  checked-in files, API contracts, SDK transports, and Worker composition.
- Checkout no longer exports legacy Zod/oRPC contracts and is exposed through
  the admin Effect HTTP group at `POST /admin/checkout/complete`. Its service
  returns Effect values and schema-backed failures, but the server golden-path
  composition still uses temporary server-owned Promise facades over migrated
  downstream services until section 9 introduces durable workflow/runtime Layer
  composition. Newly migrated module code must not depend on those facades.
- Workflow durable schemas and the deterministic recovery harness are now
  defined, but task 9.3 still needs to adapt the Cloudflare workflow/queue
  runtime Layers to the same state-store and typed-failure contract.
- The Hono Worker remains the deployed compatibility entrypoint while the
  Effect Worker foundation accumulates migrated module groups. Cart, promotion,
  tax, fulfillment, payment, checkout, order, and notification-event are
  registered in native Effect HTTP contracts/tests with in-memory or test
  Layers until the Cloudflare PostgreSQL/cache-backed runtime Layer is
  composed.
- Tasks 8.1 through 8.9 did not make the cart, promotion, tax, fulfillment,
  payment, order, or notification-event Effect Worker paths production-backed.
  The authoritative PostgreSQL repositories and cart Durable Object cache port
  exist, but the deployed Cloudflare runtime still needs a request/runtime
  Layer that wires those adapters together before migrated module traffic
  should rely on that path.
- The cart Durable Object cache is a hot aggregate and ownership/idempotency
  coordination primitive, not the durable source of truth. PostgreSQL remains
  authoritative for cart, line-item, and adjustment persistence.
- Better Auth remains behind the Effect auth adapter with a temporary D1/Kysely
  persistence seam. Replacement or deeper Effect integration remains a follow-up
  research/change item.
- Repository-wide removal of Hono, oRPC, Zod, Kysely, and completed temporary
  bridges is deferred to section 12 after all dependent slices migrate.

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
