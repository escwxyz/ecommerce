## Context

The D1 adapter owns fourteen ordered SQL migrations and exposes `db:push` through Wrangler's local D1 migration command. Commerce modules already define Kysely table contracts, but a Bun process cannot directly construct the Cloudflare `D1Database` binding used by the runtime adapter. Development seed execution therefore needs to remain adapter-owned while using a format that both Wrangler and SQLite verification can execute.

The first dataset is intentionally limited to prerequisites for a golden checkout path. It must make the local admin and API useful without fabricating completed orders, payments, or notification history.

## Goals / Non-Goals

**Goals:**

- Provide one deterministic command that seeds a migrated local D1 database.
- Create connected store, region, sales-channel, catalog, pricing, inventory, tax, customer, and fulfillment records.
- Make repeated runs converge without duplicate records or changing stable identifiers.
- Keep fixture ownership and execution inside `packages/db-d1` while validating shapes against shared commerce database types.
- Verify the generated seed artifact against the same SQLite-compatible schema used by D1 migrations.

**Non-Goals:**

- Seed production, preview, or remote D1 databases automatically.
- Create completed carts, orders, payments, fulfillment records, notification events, or auth credentials.
- Replace module APIs or repositories as the normal way application data is created.
- Introduce a general fixture framework or support PostgreSQL/libSQL in this change.

## Decisions

1. **Use a typed seed manifest with deterministic SQL generation.**

   `packages/db-d1/src/seed` will define stable fixture values and produce a SQL transaction containing explicit upserts. The manifest will use shared table insert types where practical so schema drift is visible at typecheck time. Wrangler will execute the generated SQL against local D1.

   Alternative considered: call module APIs through the running server. Rejected because foundational seed data would depend on auth, transport, service composition, and a partially initialized database.

   Alternative considered: maintain a handwritten `seed.sql`. Rejected because an untyped standalone file would duplicate table knowledge without a testable generation boundary.

2. **Keep seed execution local and explicit.**

   `@ecommerce/db-d1` will expose `db:seed`, and the repository root will forward `bun run db:seed`. The command will generate the seed SQL into an ignored or temporary path and invoke `wrangler d1 execute Database --local --file ...`. It will not accept a remote flag in this first version.

   Alternative considered: automatically seed during `bun run dev`. Rejected because startup must not overwrite developer-modified data or hide seed failures inside a persistent process.

3. **Use stable IDs and convergent upserts.**

   Every seeded entity and relationship will have a fixed identifier. Writes will use SQLite-compatible `INSERT ... ON CONFLICT DO UPDATE` or equivalent conflict-safe statements. Mutable descriptive fields may converge to fixture values, while identifiers and relationship keys remain stable.

4. **Seed only golden-path prerequisites.**

   The dataset will include one default store, one US region, one default sales channel, one published product with one variant, one USD price set and amount, one stock location and inventory level, one tax category/provider/region/rate/policy, one customer and address, and one fulfillment provider/set/profile/zone/shipping option. Join records will connect the product to the sales channel and the dependent resources to the same region/currency context.

5. **Test the exact generated artifact twice.**

   Tests will apply all D1 SQL migrations to an isolated SQLite database, execute the generated seed SQL twice, and assert stable counts, IDs, foreign-key relationships, checkout-relevant values, and no duplicate join rows. This proves both schema compatibility and idempotency without requiring Cloudflare credentials.

## Risks / Trade-offs

- [Risk] Typed fixture definitions can still drift from SQL column names during generation. -> Mitigation: centralize table/column mapping in the seed generator and execute the artifact against every migration in tests.
- [Risk] Upserts can overwrite intentional local edits. -> Mitigation: seeding remains an explicit command and only converges records under reserved deterministic IDs.
- [Risk] The seed becomes too broad and expensive to maintain. -> Mitigation: restrict it to checkout prerequisites and require separate changes for demo history or additional scenarios.
- [Risk] Wrangler local storage location can vary by invocation directory. -> Mitigation: run the command from `packages/db-d1` and use the same binding name and migration directory as `db:push`.

## Migration Plan

1. Add failing tests for deterministic IDs, cross-module relationships, and double-run idempotency.
2. Add the typed fixture manifest and SQL generator in `packages/db-d1/src/seed`.
3. Add package and root `db:seed` scripts, then generate and execute the local seed artifact.
4. Apply local D1 migrations before the first seed run and query representative records for verification.
5. Roll back by removing the seed scripts and generated fixture code; existing migrated databases remain valid because no schema changes are introduced.

## Open Questions

- None for this slice. Authentication users and completed transaction history require separate seed scenarios.
