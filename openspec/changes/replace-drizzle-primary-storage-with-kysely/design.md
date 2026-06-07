## Context

The current storage blueprint uses Drizzle as the primary relational abstraction. That was enough for the first D1/product proof slice, but it is already creating duplication pressure: product has a module-local Drizzle schema, a D1/Drizzle repository, and manual SQL setup in tests. Extending the same model to libSQL and PostgreSQL would push each module toward repeated table builders or dialect-specific schema copies.

EmDash demonstrates a simpler pattern for this platform shape: keep one Kysely `Database` type, create dialect-specific Kysely instances at the adapter edge, and isolate SQL differences behind small helpers for timestamps, binary columns, JSON expressions, table/index checks, and migrations. The implementation should use `refs/emdash/packages/core/src/db` and `refs/emdash/packages/core/src/database` as the local reference for adapter descriptors, dialect helpers, connection setup, and migration runner shape. Kysely also fits the existing module boundary goal because module logic can depend on typed query/repository contracts without importing Cloudflare runtime bindings or concrete adapter packages.

This change only covers primary relational storage. Cloudflare Durable Objects, KV, R2, Queues, Cron, Worker Loader, and service bindings remain first-class platform primitives for state and workloads that should not be modeled as primary relational data.

## Goals

- Replace Drizzle as the strategic primary commerce storage abstraction with Kysely.
- Keep Cloudflare D1 as the first production adapter.
- Let commerce modules contribute typed table surfaces and migrations without duplicating schema definitions per dialect.
- Preserve adapter boundaries so shared database contracts stay independent from Cloudflare bindings and D1 runtime packages.
- Migrate product persistence as the first proof slice.
- Align Better Auth persistence with its Kysely-backed relational database support.
- Update docs and prior planning artifacts that still describe Drizzle as the long-term architecture.

## Non-Goals

- Replacing Durable Objects, KV, R2, Queues, Cron, Worker Loader, or service bindings with Kysely.
- Building all future adapters in this change. D1 is first; libSQL and PostgreSQL remain follow-up adapters.
- Redesigning product domain behavior beyond the repository persistence mechanism.
- Reimplementing Better Auth's internal relational adapter behavior.

## Decisions

### Kysely owns primary relational query typing

`packages/db` will expose the shared database type surface, migration contribution contracts, dialect helper contracts, and test helpers. It may depend on `kysely`, but it must not depend on Cloudflare bindings, D1 runtime wrappers, server env packages, Hono server code, or module runtime composition.

Modules contribute table interfaces and migration fragments to a shared commerce database assembly. Repository implementations use Kysely query builders against the assembled database type instead of Drizzle table builders.

### Adapter packages create concrete Kysely runtimes

`packages/db-d1` will create the Cloudflare D1-backed `Kysely<CommerceDatabase>` runtime from explicit bindings passed by the Worker composition layer. Future `packages/db-libsql` and `packages/db-postgres` packages will follow the same contract but provide their own dialect construction and migration execution details.

D1 adapter metadata, request-scope support, and connection setup should follow the EmDash descriptor pattern, extended with a D1 descriptor. The implementation should use the Cloudflare D1 Kysely dialect path used by Better Auth/Kysely relational support unless local verification shows a concrete incompatibility.

### Migrations are Kysely-based and dialect-aware

The platform will move primary commerce migrations away from Drizzle schema generation. Kysely migration definitions are bundled in code, composed from module contributions, and executed through adapter-owned migration runners following the EmDash migration runner pattern.

Dialect differences are explicit helpers, not hidden global branching. Timestamp defaults, binary storage, JSON expressions, identifier quoting, table/index introspection, and request-scoped behavior live in database utility contracts or adapter packages where they can be tested per dialect.

### Product persistence is the proof slice

The product module is the first commerce module to move from D1/Drizzle to Kysely. Product domain logic, validation, branded IDs, duplicate-handle behavior, and in-memory test adapters remain local to the product package. Only SQL persistence and migration assembly change.

### Better Auth follows the Kysely storage direction

Better Auth supports relational databases through Kysely-compatible dialects, including Cloudflare D1 through the Kysely community dialect path. Auth persistence should therefore move with the platform's Kysely storage direction. Any current Drizzle adapter usage in this repo is migration debt, not a long-term auth boundary.

### Documentation must track the storage decision

Drizzle references in the architecture blueprint, package docs, roadmap docs, and completed OpenSpec planning artifacts are now historical unless explicitly scoped to migration compatibility. Follow-up work must update docs so later agents start from the Kysely decision rather than reintroducing Drizzle as the preferred multi-adapter model.

## Risks and Tradeoffs

- Kysely has built-in dialects for common databases, while Cloudflare D1 uses a community dialect path. The implementation should follow the Better Auth/Kysely D1 path and keep that dependency isolated at adapter edges.
- Better Auth's bundled Kysely adapter is currently incompatible with `kysely@0.29.x` migration exports. Keep `kysely` pinned to `0.28.17` until Better Auth supports the new export layout.
- Kysely reduces duplicate schema-builder code, but it does not remove all dialect differences. Migrations and helper functions still need dialect-specific testing.
- Drizzle schema generation can be convenient for D1. Replacing it means migration discipline moves to Kysely migration code and adapter runners.
- Better Auth still needs local integration verification, but the storage direction is Kysely rather than an auth-specific Drizzle island.
- Existing D1/product tests and docs will need careful migration so the proof slice does not regress behavior while changing storage internals.

## Migration Plan

1. Add Kysely and the D1-compatible dialect path aligned with EmDash-style adapter descriptors and Better Auth/Kysely relational support.
2. Refactor `packages/db` into shared Kysely database contracts, module table assembly, migration contribution contracts, and dialect helpers.
3. Refactor `packages/db-d1` to create a D1-backed Kysely runtime from explicit Worker bindings and to own D1 migration execution.
4. Move product SQL persistence from the Drizzle repository to a Kysely-backed repository while keeping product domain behavior unchanged.
5. Move Better Auth runtime configuration to the Kysely-compatible relational database path and remove current auth Drizzle adapter usage unless a short-lived migration step requires it.
6. Update README, package docs, roadmap docs, and Drizzle-era OpenSpec artifacts so future changes describe Kysely as the primary storage architecture.
7. Run targeted repository contract tests, boundary checks, typecheck, and lint checks.

## Resolved Guidance and Remaining Question

- Adapter descriptors, dialect helpers, connection setup, and migration runner structure should follow the EmDash source under `refs/emdash/packages/core/src/db` and `refs/emdash/packages/core/src/database`.
- Better Auth relational support is Kysely-backed, so auth persistence should align with this Kysely migration.
- Migration runners should follow the EmDash shape: shared migration definitions and helper contracts, with adapter-owned runtime execution.
- Remaining question: which previous Drizzle-oriented changes should be archived, superseded, or left as historical context after this change is accepted?
