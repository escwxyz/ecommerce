## Why

The current Drizzle-based primary storage plan is starting to create duplicate schema pressure: product already owns a Drizzle table definition, D1 repository code, and manual SQL test setup, and adding libSQL or PostgreSQL would require more dialect-specific table definitions. Kysely fits the platform's multi-adapter goal better because it keeps query typing behind one `Database` interface and lets migrations share one builder model while isolating unavoidable dialect differences in small helpers.

## What Changes

- **BREAKING**: Replace Drizzle as the primary relational storage abstraction with Kysely for commerce-owned primary data.
- Keep Cloudflare D1 as the first production primary database adapter, but create it as a `Kysely<Database>` runtime instead of a Drizzle client.
- Add Kysely database type assembly so modules contribute table interfaces and migrations without duplicating Drizzle table builders per database dialect.
- Introduce Kysely migration composition and dialect helper patterns modeled after EmDash for timestamps, binary types, JSON expressions, table/index introspection, and request-scoped behavior.
- Migrate product persistence from the existing D1/Drizzle repository path to a Kysely SQL repository as the proof slice.
- Align Better Auth persistence with its Kysely-backed relational database support instead of treating auth as a separate Drizzle path.
- Preserve Cloudflare-native non-primary storage choices: Durable Objects, KV, R2, Queues, Cron, Worker Loader, and service bindings remain platform primitives where they are the right fit, such as cart/session-like state, plugin bundles, assets, async work, and sandbox coordination.
- Update related docs and completed-planning artifacts that still describe Drizzle as the long-term data-adapter strategy so later changes start from the Kysely decision.

## Capabilities

### New Capabilities

- `kysely-primary-storage`: Defines Kysely as the platform's primary relational storage abstraction, including database type assembly, migration composition, dialect adapters, and module repository expectations.

### Modified Capabilities

- `commerce-data-adapters`: Replace the Drizzle-based multi-adapter strategy with a Kysely-based strategy while keeping D1 first and dialect differences explicit.
- `database-adapter-boundary`: Change shared DB and D1 adapter boundaries from Drizzle-specific contracts to Kysely runtime and migration contracts.
- `product-d1-persistence-adapter`: Replace the product D1/Drizzle repository adapter requirement with a product Kysely SQL repository backed by the D1 Kysely adapter.
- `commerce-platform-architecture`: Remove Drizzle as the assumed long-term database abstraction from platform boundary requirements and documentation.

## Impact

- Affected code areas: `packages/db`, `packages/db-d1`, `packages/db-utils`, `packages/modules/product`, `packages/auth`, `apps/server`, migration tooling, tests, and docs.
- Affected dependencies: add `kysely` plus a D1-compatible Kysely dialect or small maintained D1 dialect wrapper; remove Drizzle from primary commerce persistence after migration; keep Drizzle temporarily only for short-lived migration staging if implementation still needs it.
- Affected docs/artifacts: `README.md`, `docs/architecture-roadmap.md`, `packages/db/README.md`, `packages/modules/README.md`, and OpenSpec artifacts that currently name Drizzle as the strategic storage layer.
- Affected runtime systems: Cloudflare D1 remains the first production primary adapter; Cloudflare Durable Objects and other platform stores remain valid for non-primary data such as carts and platform coordination.
