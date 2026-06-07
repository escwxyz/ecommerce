## MODIFIED Requirements

### Requirement: Database service contract

Commerce modules SHALL depend on database service or repository contracts rather than direct concrete adapter imports, and those contracts SHALL use Kysely-compatible primary storage types instead of Drizzle table or client contracts.

#### Scenario: Product module requests persistence

- **WHEN** the product module persists product data
- **THEN** it MUST receive a repository or database service through Effect/runtime composition instead of importing a concrete D1, libSQL, PostgreSQL, or Drizzle adapter directly

### Requirement: D1-first Cloudflare adapter

The platform SHALL provide a first-class D1 adapter package for production Cloudflare deployments that creates a D1-backed `Kysely<CommerceDatabase>` runtime from explicit Worker bindings.

#### Scenario: Worker composes primary storage

- **WHEN** the server Worker boots for a Cloudflare deployment
- **THEN** it MUST be able to provision the D1-backed Kysely database service from Cloudflare bindings without product, order, or payment modules importing D1 runtime code

### Requirement: Explicit adapter packages

Each supported primary relational database SHALL have an explicit adapter package that owns runtime connection code, dialect configuration, and migration execution for that database while reusing the shared Kysely database type assembly where practical.

#### Scenario: Future PostgreSQL support is added

- **WHEN** PostgreSQL support is introduced
- **THEN** it MUST live in a PostgreSQL-specific adapter package and use PostgreSQL Kysely dialect behavior rather than modifying commerce modules to import PostgreSQL-specific code

### Requirement: Dialect-aware migrations

The platform SHALL define commerce primary storage migrations as Kysely migration contributions and keep unavoidable dialect differences isolated in adapter-owned runners or named dialect helper functions.

#### Scenario: Module adds a table

- **WHEN** a commerce module adds a table
- **THEN** its migration contribution MUST be executable by the D1 adapter first and reviewable for future libSQL/PostgreSQL support without duplicating Drizzle schema builders

#### Scenario: Dialect-specific SQL is required

- **WHEN** D1, libSQL, or PostgreSQL requires different SQL for the same migration intent
- **THEN** that difference MUST be visible in a dialect helper or adapter-specific migration branch rather than hidden inside module domain logic
