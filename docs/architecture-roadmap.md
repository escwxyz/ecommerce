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
7. Migrate customer, product, region/sales-channel, pricing, and inventory.
8. Migrate cart, promotion, tax, fulfillment, payment, checkout, order, and notification-event.
9. Migrate workflows, transactional outbox delivery, queues, and Durable Object actors.
10. Migrate native and sandboxed plugin contracts.
11. Remove remaining Hono, oRPC, Zod, and Kysely backend code and dependencies.

## Current Status

As of 2026-07-19, tasks 1.1 through 6.10 of
`adopt-effect-4-backend-architecture` are complete. The store tracer slice is
the first fully migrated commerce module:

- `@ecommerce/store` owns Effect Schema domain/API contracts, schema-backed
  tagged errors, Effect services, repository contracts, in-memory test Layers,
  and PostgreSQL Drizzle persistence.
- `@ecommerce/api` exposes the store admin and storefront contracts through
  Effect `HttpApi` groups instead of the legacy store oRPC router.
- `@ecommerce/storefront-sdk` verifies the store storefront contract through
  both public HTTP and server-only Cloudflare Service Binding transports.
- Store Zod contracts, Kysely/D1 repository code, legacy router code, and direct
  legacy package dependencies have been removed from the migrated store slice.
- The legacy D1 seed no longer creates a `store` table row. Checkout smoke tests
  still run against the remaining legacy D1 modules by using a temporary
  server-owned store defaults facade until checkout itself migrates.

## Current Gaps

- Live PostgreSQL store contract verification is opt-in and still requires
  `POSTGRES_URL`. Credential-free suites validate the in-memory contract,
  package type shape, migrations as checked-in files, API contracts, SDK
  transports, and Worker composition.
- Customer, product, region/sales-channel, pricing, inventory, cart, promotion,
  tax, fulfillment, payment, checkout, order, and notification-event still have
  legacy D1/Kysely/oRPC paths until their vertical-slice tasks run.
- The Hono Worker remains the deployed compatibility entrypoint while the
  Effect Worker foundation accumulates migrated module groups.
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
