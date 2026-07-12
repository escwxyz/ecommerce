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

## Deferred work

- Task 3.4 owns migration command behavior.
- Task 3.5 owns repository contract harnesses.
- Task 3.6 owns concrete transactional outbox persistence and concurrent
  claiming.
- Task 3.9 owns the first real Cloudflare/Hyperdrive PostgreSQL connection
  smoke test.
