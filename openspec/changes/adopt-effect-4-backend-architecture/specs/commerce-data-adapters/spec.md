## MODIFIED Requirements

### Requirement: Database service contract
Commerce modules SHALL depend on Effect-native repository services and SHALL NOT depend on Effect SQL clients, Drizzle database values, Cloudflare connectivity resources, or concrete database adapters directly.

#### Scenario: Module repository is tested outside Cloudflare
- **WHEN** a module repository contract suite runs
- **THEN** it MUST accept an in-memory implementation without changing module services

### Requirement: PostgreSQL-first Cloudflare adapter
The platform SHALL provide PostgreSQL through Effect SQL and Drizzle as the first production relational adapter, with Cloudflare connectivity owned by the platform adapter.

#### Scenario: Server Worker handles a database operation
- **WHEN** a Cloudflare request executes a repository operation
- **THEN** the repository MUST receive a scoped Drizzle Effect service backed by the platform-provided PostgreSQL client Layer

### Requirement: Explicit adapter packages
The platform SHALL model each database dialect as an explicit Effect SQL plus Drizzle adapter package with adapter-owned connection code, schemas, relations, codecs, migrations, queries, and dialect behavior.

#### Scenario: Additional database support is introduced
- **WHEN** an additional database adapter is added
- **THEN** it MUST implement existing repository contracts and pass shared contract tests without changing module domain logic

### Requirement: Dialect-aware migrations
Database adapters SHALL own explicit Drizzle migration sequences and SHALL document dialect divergence rather than hiding it behind a universal schema abstraction.

#### Scenario: Migration differs by dialect
- **WHEN** PostgreSQL and another dialect require different DDL
- **THEN** each adapter MUST provide and test its own migration behavior
