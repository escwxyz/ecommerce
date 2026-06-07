# Kysely Primary Storage

## Purpose

Synced from completed OpenSpec changes. This spec captures the current accepted requirements for this capability.

## Requirements

### Requirement: Kysely is the primary commerce relational abstraction

The platform SHALL use Kysely as the primary relational storage abstraction for commerce-owned primary data, replacing Drizzle as the strategic database layer for modules, repositories, migrations, and adapter contracts.

#### Scenario: Commerce module defines relational persistence

- **WHEN** a commerce module adds or changes primary relational persistence
- **THEN** it MUST model its database-facing types and SQL repository behavior through Kysely-compatible contracts rather than new Drizzle table builders or Drizzle query code

#### Scenario: Non-primary Cloudflare storage is used

- **WHEN** carts, plugin bundles, assets, async jobs, sandbox state, or coordination state are better served by Cloudflare Durable Objects, KV, R2, Queues, Cron, Worker Loader, or service bindings
- **THEN** those runtime stores MAY remain outside Kysely and MUST NOT be forced into primary relational storage

### Requirement: Database types are assembled from module contributions

The shared database package SHALL expose a composed Kysely database type assembled from module-owned table interface contributions without requiring each dialect adapter to duplicate module table definitions.

#### Scenario: Product contributes table types

- **WHEN** the product module owns product persistence
- **THEN** it MUST contribute the product table type surface once for shared database assembly and repository typing

#### Scenario: Future module adds primary tables

- **WHEN** a future commerce module adds relational tables
- **THEN** it MUST extend the shared database assembly through the same contribution mechanism instead of defining dialect-specific table builders in each adapter package

### Requirement: Kysely adapters are created at runtime edges

Concrete database adapter packages SHALL create `Kysely<CommerceDatabase>` instances at runtime edges from explicit inputs while shared modules depend only on database/repository contracts.

#### Scenario: Server Worker provisions D1

- **WHEN** the Cloudflare server Worker receives a request that needs primary relational data
- **THEN** it MUST provision the D1-backed Kysely runtime through the D1 adapter package using explicit Worker bindings

#### Scenario: Shared package imports database types

- **WHEN** shared packages import database-facing types or repository contracts
- **THEN** they MUST NOT import D1 runtime wrappers, Cloudflare bindings, Hono server code, or server environment packages

### Requirement: Migrations are Kysely-based and dialect-aware

The platform SHALL define primary commerce migrations as Kysely migration contributions and execute them through adapter-owned migration runners with explicit dialect handling.

#### Scenario: D1 migration is executed

- **WHEN** a D1 migration command runs
- **THEN** it MUST execute the composed Kysely migration set through the D1 adapter's migration runner

#### Scenario: Dialect-specific migration behavior is required

- **WHEN** a migration needs timestamp defaults, binary column types, JSON expressions, table/index introspection, or other dialect-specific behavior
- **THEN** it MUST use named dialect helpers or adapter-specific migration branches rather than duplicating opaque raw SQL throughout module code

### Requirement: Better Auth uses Kysely-compatible relational storage

Auth persistence SHALL use Better Auth's Kysely-compatible relational database support and align with the platform's D1-first Kysely storage direction.

#### Scenario: Better Auth database is configured

- **WHEN** the server Worker configures Better Auth persistence for Cloudflare runtime
- **THEN** it MUST use Better Auth's Kysely-compatible database configuration with the selected D1/Kysely adapter path

#### Scenario: Existing auth Drizzle usage is removed

- **WHEN** implementation migrates auth persistence from the current Drizzle adapter path
- **THEN** Drizzle MUST NOT remain part of the long-term auth package contract or shared commerce database contract

### Requirement: Storage documentation is synchronized

The repository SHALL update storage-related documentation and planning artifacts so Kysely is described as the current primary relational storage strategy and Drizzle is only described as historical or temporary compatibility context.

#### Scenario: Agent starts a future database change

- **WHEN** an agent reads the architecture blueprint, roadmap, package docs, or active OpenSpec guidance before implementing database work
- **THEN** the docs MUST point to Kysely for primary commerce storage and MUST NOT describe Drizzle as the preferred multi-adapter strategy
