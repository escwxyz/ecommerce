# Effect PostgreSQL and Drizzle Layer Conventions

`@ecommerce/db-postgres` is the first concrete relational adapter for the
Effect backend architecture. It owns PostgreSQL connectivity and Drizzle
database construction; core and module domain contracts continue to depend on
runtime-neutral repository services.

## Layer responsibilities

- `createPostgresClientLayer` creates the scoped `@effect/sql-pg` client Layer.
- `createPostgresDrizzleLayer` creates `PostgresDrizzleService` from the
  provided `PgClient`.
- `createPostgresDatabaseLayer` composes both Layers for application/runtime
  roots.
- `runPostgresMigrations` runs the checked-in Drizzle migration baseline through
  the Effect Postgres migrator.
- `getPostgresMigrationStatus` compares checked-in Drizzle migrations with the
  Drizzle migration journal.
- `rollbackPostgresDevelopmentDatabase` and
  `resetPostgresDevelopmentDatabase` execute development-only reset plans after
  explicit destructive confirmation.

The Layer constructors do not open a connection until the Layer is built by an
Effect runtime. Credential-free tests therefore verify composition and type
shape without requiring a local PostgreSQL server.

## Drizzle parser rule

Drizzle must own date/time normalization. The PostgreSQL client Layer installs
pg type parsers that return raw text for the date/time OIDs documented by
Drizzle's Effect Postgres connection guide, while preserving pg's normal
fallback parser behavior for other types.

## Transaction rule

Repository adapters should use `PostgresDrizzleService.withTransaction` for
local transaction boundaries. It delegates to Drizzle's Effect transaction API,
which is backed by `PgClient.withTransaction` from `@effect/sql-pg`.

Do not pass transaction handles through domain APIs. Transaction handles are an
adapter implementation detail used only inside PostgreSQL repository Layers.

## Baseline schema rule

The task 3.3 baseline is intentionally limited to shared persistence
infrastructure:

- `commerce_migration_audit`
- `commerce_outbox`
- `commerce_outbox_dead_letter`

Module aggregate tables are added by their vertical-slice migration tasks. Do
not copy Kysely or D1 migration history into the PostgreSQL baseline.

## Migration command rule

`@ecommerce/db-postgres` owns package-local migration commands:

- `bun run db:status`
- `bun run db:migrate`
- `bun run db:rollback-development`
- `bun run db:reset-development`

All commands require `POSTGRES_URL`. Status is read-only and reports pending,
applied, and failed records by comparing local Drizzle migration files with the
Drizzle migration journal. The rollback and reset commands are development-only
because this migration has no production data. They require explicit destructive
confirmation with `-- --confirm-development-reset` and only drop adapter-owned
foundation objects plus Drizzle's migration schema.

## Repository contract harness rule

`@ecommerce/db-postgres/testing` exposes
`createLocalPostgresRepositoryContractHarness` for module repository contract
suites. The harness composes a module repository Layer with
`PostgresDrizzleService`, runs the checked-in migration baseline before each
case by default, and accepts adapter-specific reset Effects for module tables.

Live PostgreSQL contract execution is opt-in. The harness returns a skipped
result unless the suite passes an explicit database URL or `POSTGRES_URL` is
present. This keeps ordinary unit tests credential-free while letting local and
future integration jobs run the same contract cases against PostgreSQL.

Task 3.8 adds a dedicated live verification suite:

- `POSTGRES_URL=postgres://... bun run test:live`

That suite resets the adapter-owned development objects, reapplies the checked-in
baseline, and verifies migrations, transaction commit/rollback, duplicate-key
constraint failures, row decoding, and concurrent outbox claims.

## Transactional outbox rule

`@ecommerce/db-postgres/outbox` exposes `createPostgresOutboxLayer`, which
provides the core `OutboxWriterService` and `OutboxClaimerService` contracts.
The writer inserts `commerce_outbox` records using the current
`CurrentTransactionService` metadata, so module mutations can commit domain
state and outbox records in the same local transaction.

The claimer is post-commit infrastructure. It reserves pending rows by topic
with PostgreSQL `FOR UPDATE SKIP LOCKED`, stamps a claim id, increments
attempts, and returns runtime-neutral `OutboxRecord` values for delivery.
Delivered records transition to `delivered`; terminal failures transition to
`failed` and insert a `commerce_outbox_dead_letter` record.

## Deferred work

- Task 3.9 owns the first real Cloudflare/Hyperdrive PostgreSQL connection
  smoke test.
