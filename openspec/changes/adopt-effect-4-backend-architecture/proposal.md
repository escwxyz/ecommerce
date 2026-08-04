## Why

The current backend uses Effect for selected services and workflows, but its permanent architecture is still split across Hono, oRPC, Zod, Kysely, Better Auth, and Cloudflare-specific runtime code. The platform needs one coherent Effect 4 application model so typed errors, schemas, dependencies, persistence, HTTP APIs, workflows, observability, and runtime adapters compose consistently while retaining a Cloudflare-first deployment and a credible path to other platforms.

## What Changes

- **BREAKING** Make Effect 4 beta the mandatory backend programming model and exact-pin the compatible Effect package set.
- **BREAKING** Replace Zod backend schemas with Effect Schema at domain, transport, storage, configuration, event, queue, provider, and plugin boundaries.
- **BREAKING** Replace Kysely with Drizzle ORM 1.0 RC using its Effect PostgreSQL driver, backed by Effect SQL PostgreSQL and module-owned repository contracts.
- **BREAKING** Replace Hono and oRPC backend routing with Effect HTTP and `HttpApi` contracts, including schema-declared success and error responses and derived OpenAPI.
- Introduce a storefront SDK package with a browser HTTP transport and a server-only Cloudflare Service Binding transport over one canonical API contract.
- Preserve Cloudflare as the first production runtime while prohibiting Cloudflare dependencies from runtime-neutral core, module, API-contract, and workflow packages.
- Keep Better Auth temporarily behind an Effect-native auth boundary; defer replacement or adoption of a community Effect wrapper until Effect 4 and Cloudflare compatibility are proven.
- Use module-local Effect SQL transactions and transactional outbox writes; coordinate cross-module operations with durable Effect workflows, idempotent steps, persisted progress, and compensation.
- Keep Durable Objects as the first actor/coordination adapter behind portable Effect contracts; evaluate Rivet later through parity tests rather than adopting it as a core dependency now.
- Redesign trusted and sandboxed plugin extension points around Effect services, Layers, schemas, typed errors, capability bridges, telemetry, quotas, and runtime-neutral contracts.
- Make Effect logging, metrics, tracing, and cause semantics the backend observability foundation.
- Migrate by verified vertical slices, starting with the store module, and delete each legacy path when its replacement passes domain, adapter, HTTP, workflow, boundary, and Cloudflare integration gates.
- Treat the existing Cloudflare commerce blueprint as historical context; this change supersedes its Hono, oRPC, Zod, Kysely, and stronger Cloudflare-coupling decisions while preserving its Medusa-inspired module and extension goals.

## Capabilities

### New Capabilities

- `effect-backend-conventions`: Governs Effect 4 version pinning, services and Layers, schema ownership, tagged error policy, configuration, telemetry, testing, and forbidden legacy imports.
- `effect-http-api-sdk`: Defines the canonical Effect HTTP admin/storefront APIs, derived OpenAPI, and storefront SDK HTTP and Service Binding transports.
- `effect-sql-persistence`: Defines Effect SQL PostgreSQL plus Drizzle persistence, module repository contracts, PostgreSQL-first adapter ownership, migrations, transactions, outbox semantics, and future dialect conformance.
- `effect-migration-governance`: Defines the pre-production clean-break policy, vertical-slice sequence, temporary bridge rules, verification gates, and legacy dependency removal criteria.

### Modified Capabilities

- `commerce-platform-architecture`: Replace the mixed Hono/oRPC/Kysely application composition with an Effect-native backend and portable runtime adapter boundary.
- `commerce-data-adapters`: Replace Kysely adapters with PostgreSQL-first Effect SQL and Drizzle adapter packages.
- `api-route-validation-contracts`: Replace Zod and oRPC validation contracts with Effect Schema and Effect `HttpApi` contracts.
- `module-api-assembly`: Replace oRPC router fragments with composable Effect `HttpApiGroup` contracts and handler Layers.
- `shared-auth-boundary`: Require an Effect-native auth/session/authorization service boundary while retaining Better Auth only inside a temporary adapter.
- `workflow-event-primitives`: Require typed Effect workflows, local transactions, transactional outbox events, idempotent replay, persisted progress, and compensation.
- `stateful-runtime-primitives`: Define portable Effect actor and workflow services with Durable Objects as the first adapter and Rivet deferred to parity evaluation.
- `native-plugin-contracts`: Replace imperative native plugin extension contracts with Effect Layer, schema, API, workflow, provider, and telemetry contributions.
- `cloudflare-plugin-sandbox`: Require Effect Schema bridge messages and Effect-hosted capability enforcement without exposing the host runtime or raw bindings.
- `commerce-admin-extensibility`: Replace shared oRPC types with Effect HTTP/API schemas while keeping the frontend free of backend runtime dependencies.

## Impact

- Affects every backend package, module, API route, database schema/migration, repository implementation, workflow, queue consumer, Durable Object, plugin contract, Cloudflare Worker composition path, backend test, and backend dependency declaration.
- Adds a storefront SDK package and Cloudflare Service Binding transport while retaining a public HTTP transport for browsers.
- Removes Hono, oRPC, Zod, and Kysely from the permanent backend architecture after slice-by-slice migration; frontend-only dependency choices remain independent.
- Retains Better Auth temporarily behind an Effect boundary and adds a later research task for direct wrapping, `effectify`, and future ecosystem support.
- Requires a new PostgreSQL Drizzle schema and migration baseline; no production backfill or legacy API compatibility is required.
- Adds a Cloudflare-to-PostgreSQL connection resource, expected to use Hyperdrive unless the implementation spike proves another supported Effect PostgreSQL connection path.
- Preserves Cloudflare Workers, Queues, Durable Objects, Worker Loader, Alchemy, the Medusa-inspired module model, and metadata-driven admin extensibility as deployment and product goals rather than core runtime dependencies.
