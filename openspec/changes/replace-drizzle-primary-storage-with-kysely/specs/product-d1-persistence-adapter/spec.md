## MODIFIED Requirements

### Requirement: D1 product repository adapter

The product module SHALL provide a D1-backed product repository adapter under a product-local adapters folder that persists and reads product records through the shared D1 Kysely runtime while satisfying the product repository behavior required by the product service foundation operations.

#### Scenario: Product is saved through D1 repository

- **WHEN** the product service saves a valid draft product through the D1-backed repository
- **THEN** the record MUST be persisted in the product table with its stable identifier, normalized handle, title, status, created timestamp, and updated timestamp intact

#### Scenario: Product is loaded through D1 repository

- **WHEN** a product record exists in D1
- **THEN** the D1-backed Kysely repository MUST return equivalent domain records from list, read-by-id, and read-by-handle operations

#### Scenario: Product D1 adapter is placed with future adapters

- **WHEN** maintainers inspect the product package
- **THEN** the D1 product repository adapter MUST live under a product-local adapters folder so future database adapters can be added beside it

### Requirement: Runtime product routes use persistent repository

The server runtime SHALL compose product route fragments with the D1-backed Kysely product repository instead of relying on the product module's default in-memory repository singleton.

#### Scenario: Server Worker handles product create

- **WHEN** the Cloudflare server Worker handles an authorized product create request
- **THEN** the request MUST execute through the assembled validated product route and persist the product through the D1-backed Kysely repository

#### Scenario: Server Worker restarts

- **WHEN** the server Worker is recreated after a product was persisted in D1
- **THEN** product list and read routes MUST retrieve the persisted product from D1 rather than from process-local memory

### Requirement: Schema and migration ownership remain explicit

Product D1 persistence SHALL use the product module's Kysely table type and migration contribution through shared database assembly and the D1 adapter migration flow rather than redefining product tables in runtime composition code.

#### Scenario: D1 migration is generated for product schema

- **WHEN** implementation changes product table shape or index requirements
- **THEN** the D1 migration artifact MUST be generated from the shared Kysely migration contribution and remain owned by the D1 adapter migration flow

#### Scenario: Product table mapping is reviewed

- **WHEN** maintainers inspect product persistence code
- **THEN** they MUST find the product table type and migration contribution in the product module and the D1 execution adapter behind the product repository contract

## REMOVED Requirements

### Requirement: Shared SQLite timestamp helpers

The database schema layer SHALL provide shared SQLite/Drizzle helpers for millisecond timestamp defaults and update timestamps when product schema definitions require those repeated column patterns.

#### Scenario: Product schema defines timestamp columns

- **WHEN** the product table defines `created_at` or `updated_at` columns
- **THEN** it MUST use shared timestamp helper functions rather than duplicating the raw current timestamp SQL expression in the product schema file

#### Scenario: Timestamp helper is reviewed for adapter scope

- **WHEN** maintainers inspect the timestamp helper module
- **THEN** it MUST be clearly scoped to SQLite/Drizzle timestamp column construction and MUST NOT hide PostgreSQL or future dialect differences behind runtime branching

## ADDED Requirements

### Requirement: Shared Kysely dialect helpers

The database layer SHALL provide named Kysely dialect helpers for repeated column, timestamp, introspection, binary, and JSON patterns that product and future module migrations need across D1, libSQL, and PostgreSQL.

#### Scenario: Product migration defines timestamp columns

- **WHEN** the product migration defines `created_at` or `updated_at` columns
- **THEN** it MUST use a named Kysely dialect helper or explicit adapter-specific branch rather than duplicating raw timestamp SQL expressions in product repository code

#### Scenario: Timestamp helper is reviewed for adapter scope

- **WHEN** maintainers inspect the timestamp helper module
- **THEN** it MUST make supported dialect behavior explicit and MUST NOT imply that D1, libSQL, and PostgreSQL have identical timestamp semantics
