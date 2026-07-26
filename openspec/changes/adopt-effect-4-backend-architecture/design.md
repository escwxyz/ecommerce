## Context

The repository implements a Medusa-inspired commerce platform on Cloudflare. The accepted historical blueprint chose Effect for dependency composition and workflows while retaining Hono, oRPC, Zod, Kysely, Better Auth, and Cloudflare-specific adapters. That split now works against the desired operating model: errors cross untyped Promise boundaries, schemas are duplicated between domains and transports, persistence contracts inherit query-builder types, HTTP composition is separate from Effect services, and portability is asserted mainly through package boundaries rather than executable runtime contracts.

This design makes Effect 4 beta the backend application model. It covers the core kernel, commerce modules, API contracts, persistence, workflows, stateful coordination, plugins, telemetry, testing, and Cloudflare composition. The web UI remains a conventional frontend and consumes typed SDK packages without importing the backend Effect runtime.

The migration is pre-production. There is no production data or published API compatibility contract to preserve, so the design favors a clean replacement over permanent dual stacks. Cloudflare remains the first production deployment target. Runtime-neutral contracts must nevertheless be executable with deterministic test Layers so Node, Bun, or another platform can be added without rewriting business logic.

Effect 4 is experimental work hosted in `Effect-TS/effect-smol`. Its packages and APIs can change during the migration. Versions therefore require exact pinning, dedicated upgrade changes, and an architecture canary.

## Goals / Non-Goals

**Goals:**

- Make Effect 4 the mandatory backend model for dependencies, errors, schemas, configuration, resource safety, concurrency, HTTP, SQL, workflows, and telemetry.
- Remove Hono, oRPC, Zod, and Kysely from the permanent backend architecture.
- Keep domain and application packages independent of Cloudflare while delivering a first-class Cloudflare runtime.
- Provide canonical admin and storefront `HttpApi` contracts and a dedicated storefront SDK with browser HTTP and server-only Service Binding transports.
- Use Effect SQL PostgreSQL with Drizzle ORM, module repository contracts, adapter-owned schemas/migrations, module-local transactions, and transactional outbox writes.
- Preserve Medusa-inspired modules, providers, workflows, native plugins, sandboxed plugins, and metadata-driven admin extensibility.
- Keep Better Auth temporarily behind a typed Effect boundary rather than reimplementing security-sensitive functionality.
- Use Durable Objects first behind portable actor/workflow contracts and evaluate Rivet later with parity evidence.
- Maintain a buildable repository through vertical slices and delete legacy paths when each slice satisfies its verification gate.

**Non-Goals:**

- Supporting Node or Bun in the first production milestone.
- Maintaining compatibility with local development data, Kysely migrations, oRPC endpoints, or existing generated client types.
- Reimplementing authentication, cryptographic primitives, or a general distributed transaction system.
- Selecting Rivet as a production runtime before a separate parity and operations evaluation.
- Giving sandboxed plugins access to the host Effect environment, SQL clients, raw Cloudflare bindings, or secrets.
- Forcing frontend application code to use Effect or replacing frontend-only libraries solely for architectural symmetry.

## Decisions

### 1. Effect 4 is the backend application model

Backend public functions and services return Effect values with explicit success, error, and requirement types. Services and platform capabilities compose through Tags and Layers. Effect configuration, scopes, schedules, concurrency, causes, logging, metrics, and tracing define shared runtime semantics.

Hono, oRPC, Zod, and Kysely are migration dependencies only. Completed runtime-neutral packages enforce import bans for those libraries and for Cloudflare runtime modules.

Alternative considered: retain the existing frameworks and use Effect only inside handlers and services. Rejected because this preserves duplicate error, schema, lifecycle, and dependency models at every boundary.

### 2. Effect 4 packages are exact-pinned and upgraded deliberately

All Effect 4 packages use exact, mutually compatible versions in the root catalog and lockfile. The currently reviewed application cohort is `4.0.0-beta.93`. A canary covers Schema, tagged errors, service/Layer composition, `HttpApi`, Effect SQL PostgreSQL, Drizzle Effect integration, and Cloudflare Worker startup. Effect upgrades occur only in dedicated changes that run repository-wide type, test, schema/API snapshot, SQL adapter, and Cloudflare smoke checks. The reviewed upstream version or revision is recorded in project memory.

Alternative considered: track `latest`, a caret range, or the `main` branch. Rejected because beta API movement would make unrelated changes nondeterministic.

### 3. Schema ownership is boundary-specific

Each module owns separate Effect Schemas for domain values, public/admin DTOs, and adapter storage rows. Domain schemas define branded identifiers, value objects, and invariants. API schemas define versioned serialized contracts. Database schemas decode raw rows and encode parameters. Explicit transformations connect the models.

Every untrusted boundary decodes: HTTP, configuration, database results, queues, events, workflow persistence, actor messages, plugin bridges, and providers. Internal functions accept decoded domain values. `Option` is preferred internally while nullable values remain boundary representations.

Alternative considered: reuse one schema everywhere. Rejected because database and compatibility concerns would contaminate domain invariants.

### 4. Expected failures are schema-backed tagged unions

Module contracts expose closed unions of specific expected errors. Repository, provider, and foreign errors are translated before leaving their owning boundary. HTTP APIs declare serialized error schemas and deterministic status mappings. Workflows match errors for retry, compensation, or terminal rejection.

Invariant failures and programming bugs remain defects. Interruptions remain interruptions. Both retain Effect Cause information for telemetry and return sanitized transport responses.

Alternative considered: standardize on `Error` or one generic application error. Rejected because it erases recovery semantics and weakens API contracts.

### 5. Effect HTTP and `HttpApi` own backend APIs

Admin and storefront APIs are composable `HttpApiGroup`s backed by handler Layers. Effect Schema declares paths, parameters, bodies, successes, and failures. OpenAPI is derived from the canonical contract. Authentication, authorization, request context, tracing, timeouts, and error serialization are Effect HTTP middleware.

Modules and trusted plugins contribute API groups through typed composition contracts. The Cloudflare Worker entrypoint provides platform Layers and serves the assembled Effect HTTP application.

Alternative considered: retain oRPC for shared client types. Rejected because it would preserve a second transport and schema model.

### 6. The storefront SDK has one contract and two transports

A dedicated SDK package exposes the storefront API without business logic or credentials. Browser consumers use public HTTP through `fetch`. Cloudflare server/SSR consumers use a server-only Service Binding transport. Both use the same Effect API/schema contract and expose the same typed results and errors.

The Service Binding adapter still crosses the HTTP contract through the binding's `fetch` interface. It does not call domain services directly, preserving authorization, validation, tracing, and behavioral parity. Server-only exports are separated so bindings cannot enter browser bundles.

Alternative considered: a direct in-process server SDK. Rejected because it would create a privileged behavioral path that bypasses the public contract.

### 7. Effect SQL PostgreSQL and Drizzle replace Kysely

Modules define Effect-native repository service contracts. Domain and application services depend on those repositories rather than a universal database client. The first adapter uses `@effect/sql-pg` for scoped connectivity and transactions and Drizzle ORM 1.0 RC's `effect-postgres` driver for PostgreSQL schemas, typed queries, relations, codecs, and migrations. Adapter packages own Drizzle schemas, migrations, transaction details, and repository Layers. Other databases follow later through their own Effect SQL and Drizzle drivers while satisfying the same repository contract suites.

Schema and query definitions are dialect-specific. Shared domain and repository contracts, not shared SQL or Drizzle table types, provide portability. The design does not force a lowest-common-denominator database model.

Alternative considered: use raw Effect SQL alone. Rejected because every database already requires dialect-specific work, while Drizzle 1.0 RC provides an Effect-native PostgreSQL driver and useful schema, query, relation, codec, and migration tooling without leaking into domain contracts.

### 8. Transactions are local; workflows coordinate modules

A module application service owns atomic transaction boundaries. Repositories use the transaction-scoped Effect SQL service from the environment; transaction handles never appear in domain APIs. Domain changes and their outbox records commit in the same local transaction.

Cross-module commerce operations use durable workflows with schema-versioned inputs/state, idempotent steps, persisted progress, retry policies, terminal failures, and compensation. No distributed transaction is implied.

Alternative considered: one transaction spanning module repositories. Rejected because it couples modules to one database/runtime and cannot extend safely to providers or actors.

### 9. Authentication is a temporary external integration

Core and module code sees only an Effect-native `AuthService`, request identity, session, permission, and typed auth error model. Better Auth remains inside a temporary adapter to preserve security-sensitive behavior. Its schemas, database types, handlers, and errors cannot leak across the adapter boundary.

A later research change compares a direct wrapper, the community `effectify` Better Auth package, and future official ecosystem support. Any adoption must prove Effect 4 and Cloudflare compatibility. The project does not reimplement authentication or cryptography.

Alternative considered: immediately replace Better Auth with custom auth. Rejected as unrealistic and unnecessarily risky without official ecosystem support.

### 9.1 Identity organizations are not commerce stores

Better Auth's organization plugin is a candidate for multi-tenant identity:
organizations, members, invitations, teams, active organization/team state, and
auth-scoped roles. Those records remain auth-provider-owned and must be
translated through the Effect auth boundary before module logic sees them.

Commerce stores, merchants, vendors, markets, marketplaces, products, orders,
sales channels, fulfillment, settlement, and workflows remain commerce domain
concepts. A commerce store is not an auth organization. A future marketplace
can link vendors or merchants to Better Auth organizations through
provider-neutral IDs, but modules cannot import Better Auth organization
schemas, tables, migrations, client types, or server API types.

The store tracer slice should therefore preserve the store module as a commerce
settings/defaults module. It may reserve explicit owner/link points for future
merchant, vendor, market, or organization associations, but it must not encode
`store = tenant` or `store = Better Auth organization` as a permanent
invariant.

Alternative considered: model Better Auth organization as the store tenant
directly. Rejected because it couples commerce persistence to a temporary auth
provider and makes normal store, multi-store, and marketplace models harder to
extend independently.

### 10. Cloudflare is first; portability is proven by contracts and Layers

Core, modules, schemas, repositories, API contracts, and workflows cannot import Cloudflare APIs. Cloudflare-specific bindings and implementations live in platform/runtime packages and application composition. Every runtime-neutral service has a deterministic test or in-memory Layer.

Cloudflare provides the first production implementations for Workers, PostgreSQL connectivity, Service Bindings, Queues, Durable Objects, Worker Loader, secrets, and telemetry exporters. The first PostgreSQL connection is provisioned through a Cloudflare platform adapter, expected to use Hyperdrive. Node and Bun are future runtime adapter milestones.

Alternative considered: implement three runtimes concurrently. Rejected because it increases migration scope before the application model is stable.

### 11. Durable Objects are the first actor implementation

The core defines narrow Effect services for keyed actors, serialized commands, timers, durable workflow execution, and state/event persistence. Cloudflare implements them first with Durable Objects. Task 9.7 approved Effect SQL's Durable Object SQLite client for actor-local workloads that require relational queries, indexes, migrations, or multi-statement transactions; the generic keyed actor retains its smaller key-value layout until such a requirement exists. PostgreSQL remains the authoritative relational system of record; actor-local storage is coordination, workflow, cache, timer, or fanout state unless a later spec explicitly transfers ownership. The workload-by-workload authority and recovery matrix is recorded in `docs/stateful-workload-ownership.md`.

Backpine Cloudflare packages and `durable-effect` are implementation references, not core contracts. Rivet is deferred to a parity evaluation covering consistency, timers, recovery, placement, latency, deployment, operations, and cost.

Alternative considered: adopt Rivet immediately for portability. Rejected because portability claims must be proven against actual commerce workloads and Cloudflare operations.

### 12. Plugins retain trusted and sandboxed tiers

Trusted native plugins may contribute Layers, module services, providers, `HttpApiGroup`s, workflows, event handlers, telemetry, and admin metadata. Sandboxed plugins execute through Worker Loader and receive only schema-validated capability bridge operations.

The bridge never exposes the host Effect runtime, SQL client, secrets, raw bindings, or implementation services. Host bridge handlers are Effect services with typed failures, tracing, deadlines, quotas, and audit events. Core manifests and messages remain runtime-neutral so another sandbox adapter can be added later.

Alternative considered: run all plugins as native Effect code. Rejected because untrusted marketplace code requires a stronger isolation boundary.

### 13. Effect telemetry is mandatory

Backend operations use structured Effect logs, metrics, spans, and Causes. Requests, SQL, workflows, queues, actors, plugins, and providers propagate correlation identifiers. Expected failures, defects, and interruptions are measured separately. Shared policies redact sensitive data before export.

Cloudflare supplies the first exporter integration. Deterministic test Layers capture telemetry and critical audit events. Ordinary telemetry export failure does not fail commerce operations; explicitly durable audit persistence is modeled as a separate business requirement.

### 14. Migration uses verified vertical slices

The migration first establishes dependency governance, canaries, conventions, Effect SQL PostgreSQL plus Drizzle, Effect HTTP, the SDK transports, and the auth adapter. The store module is the tracer slice. Modules then migrate in dependency order before transactional workflows, actors, and plugins.

Each slice must pass deterministic domain tests, repository contracts against in-memory and PostgreSQL implementations, schema tests, Effect HTTP tests, workflow recovery tests where relevant, Cloudflare integration checks, and import boundaries. A slice completes only when its legacy route, schema, repository, migration, and dependencies are deleted.

Temporary bridges must have an owner, a removal task, and no use by newly migrated code. The workspace remains buildable between slices.

## Risks / Trade-offs

- [Effect 4 beta APIs change during migration] → Exact-pin packages, use a focused canary, isolate upgrades, and avoid wrappers for transient APIs.
- [The migration becomes a permanent dual stack] → Use slice completion gates that require deletion and repository-wide legacy import tracking.
- [Raw SQL duplicates work across dialects] → Share only proven-portable SQL and rely on repository contract suites; keep dialect differences explicit.
- [Typed error unions become excessively granular] → Model actionable recovery semantics at module boundaries and keep adapter details private.
- [Effect Layers become an abstract service locator] → Create services only at real domain, platform, resource, request, and test boundaries; keep pure functions pure.
- [Better Auth integration blocks Effect HTTP or Effect SQL removal] → Isolate it behind an adapter and allow a temporary dedicated storage/handler seam with explicit deletion research, without leaking into modules.
- [Service Binding and public HTTP transports diverge] → Drive both from one `HttpApi` contract and run shared SDK conformance tests.
- [Cloudflare-to-PostgreSQL connectivity adds latency or pool pressure] → Use a platform-owned Hyperdrive/connection Layer, bounded pools, tracing, and Cloudflare integration tests.
- [Durable Object state becomes a second system of record] → Document ownership per actor and keep PostgreSQL authoritative by default.
- [Workflow replay executes non-idempotent provider actions twice] → Require idempotency keys, persisted step outcomes, and provider-specific replay tests.
- [Sandboxed plugins bypass capability policy] → Decode every message, enforce grants host-side, apply deadlines/quotas, and deny raw resource access.
- [Cloudflare-first code leaks into core] → Maintain import-boundary tests and require test Layers for every portable contract.
- [Observability leaks secrets or high-cardinality data] → Centralize redaction, attribute naming, and metric cardinality policies.

## Migration Plan

1. Accept this superseding architecture change and pause new dependencies on legacy backend abstractions.
2. Exact-pin Effect 4 packages and add the architecture canary.
3. Establish shared Schema, error, service/Layer, configuration, telemetry, repository, transaction, workflow, and testing conventions.
4. Build the Effect SQL PostgreSQL client Layer, Drizzle Effect database Layer, migration runner, clean schema baseline, and repository test harness.
5. Build the Effect HTTP Cloudflare entrypoint, canonical APIs, OpenAPI generation, and storefront SDK HTTP/Service Binding transports.
6. Place Better Auth behind the Effect auth boundary without expanding its footprint.
7. Migrate `store` end-to-end and delete its Zod, Kysely, and oRPC implementation.
8. Migrate customer, product, region/sales-channel, pricing, and inventory.
9. Migrate cart, promotion, tax, fulfillment, payment, checkout, order, and notification-event.
10. Migrate durable workflows, transactional outbox delivery, queues, Durable Object actors, and recovery tests.
11. Migrate native plugins and sandbox bridge contracts.
12. Delete remaining Hono, oRPC, Zod, and Kysely backend dependencies; enable repository-wide forbidden-import gates; refresh architecture documentation and project memory.

Rollback is source-level because there is no production data. Each slice remains independently revertible until the clean PostgreSQL Drizzle baseline becomes the only development schema. After that point, rollback resets the development PostgreSQL database rather than translating data back to Kysely migrations.

## Open Questions

- Which Cloudflare Effect HTTP adapter approach is sufficiently maintained: upstream primitives, a minimal local adapter, or selected Backpine code?
- Which PostgreSQL deployment and Hyperdrive configuration will be the first Cloudflare integration target?
- Can Better Auth operate behind Effect HTTP and the new storage boundary without retaining Kysely, or does auth require a temporary isolated persistence seam?
- What generated-client surface from Effect `HttpApi` best supports the browser SDK without importing server runtime code?
- Which telemetry exporter is operationally appropriate for the first Cloudflare stage?
