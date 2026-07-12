## MODIFIED Requirements

### Requirement: Database service contract
Commerce modules SHALL depend on Effect-native repository services and SHALL NOT depend on Effect SQL clients, Cloudflare D1 bindings, or concrete database adapters directly.

#### Scenario: Module repository is tested outside Cloudflare
- **WHEN** a module repository contract suite runs
- **THEN** it MUST accept an in-memory or non-D1 implementation without changing module services

### Requirement: D1-first Cloudflare adapter
The platform SHALL provide Cloudflare D1 through the Effect SQL D1 client as the first production relational adapter.

#### Scenario: Server Worker handles a database operation
- **WHEN** a Cloudflare request executes a repository operation
- **THEN** the repository MUST receive the request or transaction-scoped Effect SQL D1 service from the Cloudflare Layer

### Requirement: Explicit adapter packages
The platform SHALL model D1, PostgreSQL, libSQL, Bun SQLite, and Node SQLite support as explicit Effect SQL adapter packages with adapter-owned connection code, SQL, row schemas, migrations, and dialect behavior.

#### Scenario: PostgreSQL support is introduced
- **WHEN** the PostgreSQL adapter is added
- **THEN** it MUST implement existing repository contracts and pass shared contract tests without changing module domain logic

### Requirement: Dialect-aware migrations
Database adapters SHALL own explicit raw SQL migration sequences and SHALL document dialect divergence rather than hiding it behind a universal migration abstraction.

#### Scenario: Migration differs by dialect
- **WHEN** D1 and PostgreSQL require different DDL
- **THEN** each adapter MUST provide and test its own migration behavior

