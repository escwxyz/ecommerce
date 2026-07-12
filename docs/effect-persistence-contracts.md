# Effect Persistence Contract Conventions

Runtime-neutral persistence contracts live in `@ecommerce/core/persistence`.
They describe what business logic may depend on; PostgreSQL, Drizzle, migration
SQL, connection pools, and Cloudflare connectivity remain adapter concerns.

## Repository contracts

Module packages own narrow repository services for their aggregate or workflow
slice. Those services may extend `CommerceRepository` for metadata, but their
operations stay module-specific. Do not introduce a universal database or query
service for migrated code.

Repository methods return `Effect` values and translate adapter failures into a
declared module error union before leaving the module boundary. Shared
`RepositoryUnavailable`, `RepositoryConflict`, and `RepositoryDecodeFailure`
errors are available for adapter-owned translation, but modules should expose
only actionable errors from their public contracts.

## Transactions

Application services own local transaction boundaries through
`TransactionBoundaryService`. Transaction-scoped work may read
`CurrentTransactionService` metadata, but that metadata is not a database handle
and must not appear in domain APIs.

Adapters provide scoped resources internally. A mutation that changes domain
state and emits an outbox record must run both operations under the same local
transaction boundary.

## Migrations

Adapter packages own migration definitions, checksums, SQL/Drizzle execution,
and dialect-specific implementation Layers. `MigrationService` exposes only
status and apply-pending contracts so commands and tests can observe migration
state without importing adapter execution details.

Development rollback/reset command behavior is implemented by concrete adapters.
`@ecommerce/db-postgres` exposes its development reset and rollback commands
without adding destructive behavior to this runtime-neutral shared contract.

## Transactional outbox

`OutboxWriterService` is transaction-scoped and requires
`CurrentTransactionService`, making accidental outbox writes outside a local
transaction visible in the Effect requirements.

`OutboxClaimerService` is post-commit delivery infrastructure. It claims,
marks delivered, and marks failed records without access to domain repository
services or transaction handles. Concrete concurrent claiming semantics belong
to the PostgreSQL outbox implementation in task 3.6.
