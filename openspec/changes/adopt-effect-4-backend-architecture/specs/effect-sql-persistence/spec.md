## ADDED Requirements

### Requirement: Effect SQL persistence foundation
Primary relational persistence SHALL use Effect SQL and raw SQL without an ORM or query-builder abstraction.

#### Scenario: Repository executes a query
- **WHEN** a repository reads or writes relational state
- **THEN** it MUST use the transaction-scoped Effect SQL service supplied by its adapter Layer

### Requirement: Module repository contracts
Modules SHALL own runtime-neutral Effect repository service contracts, while database adapter packages SHALL own SQL, row schemas, migrations, and concrete Layers.

#### Scenario: New database dialect is introduced
- **WHEN** PostgreSQL, libSQL, Bun SQLite, or Node SQLite support is added
- **THEN** the adapter MUST satisfy the same module repository contract suite without changing domain services

### Requirement: Local transaction ownership
Module application services SHALL own local transaction boundaries, and transaction handles SHALL NOT appear in domain APIs.

#### Scenario: Module mutation emits an event
- **WHEN** a module state change requires an outbox event
- **THEN** the state mutation and outbox record MUST commit in the same local transaction

### Requirement: D1-first clean schema baseline
The first production adapter SHALL target Cloudflare D1 and SHALL establish a clean Effect SQL migration baseline without preserving Kysely migration history or development data.

#### Scenario: Effect SQL baseline is applied
- **WHEN** a local or new Cloudflare stage initializes its database
- **THEN** it MUST create the required schema solely from the Effect SQL migration baseline

