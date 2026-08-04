## ADDED Requirements

### Requirement: Effect PostgreSQL and Drizzle persistence foundation
Primary relational persistence SHALL use `@effect/sql-pg` with Drizzle ORM 1.0 RC's Effect PostgreSQL driver.

#### Scenario: Repository executes a query
- **WHEN** a repository reads or writes relational state
- **THEN** it MUST use the Drizzle Effect database service backed by the scoped Effect PostgreSQL client Layer

### Requirement: Module repository contracts
Modules SHALL own runtime-neutral Effect repository service contracts, while database adapter packages SHALL own dialect-specific Drizzle schemas, relations, codecs, migrations, queries, and concrete Layers.

#### Scenario: New database dialect is introduced
- **WHEN** another database dialect is added
- **THEN** the adapter MUST satisfy the same module repository contract suite without changing domain services

### Requirement: Local transaction ownership
Module application services SHALL own local transaction boundaries, and transaction handles SHALL NOT appear in domain APIs.

#### Scenario: Module mutation emits an event
- **WHEN** a module state change requires an outbox event
- **THEN** the state mutation and outbox record MUST commit in the same local transaction

### Requirement: PostgreSQL-first clean schema baseline
The first production adapter SHALL target PostgreSQL and SHALL establish a clean Drizzle migration baseline without preserving Kysely migration history or development data.

#### Scenario: Effect SQL baseline is applied
- **WHEN** a local or new Cloudflare stage initializes its database
- **THEN** it MUST create the required schema solely from the PostgreSQL Drizzle migration baseline
