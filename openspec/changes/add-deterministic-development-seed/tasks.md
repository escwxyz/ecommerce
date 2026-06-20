## 1. Seed Contract And Fixtures

- [x] 1.1 Define stable reserved identifiers and typed fixture records for the golden checkout prerequisites.
- [x] 1.2 Define the ordered table and relationship writes needed for store, region/sales-channel, product, pricing, inventory, tax, customer, and fulfillment data.
- [x] 1.3 Keep completed transaction history and authentication credentials outside the initial fixture.

## 2. Test-First Seed Verification

- [x] 2.1 Add a failing test that applies every D1 SQL migration and executes the generated seed artifact against isolated SQLite.
- [x] 2.2 Add failing assertions for representative checkout-ready relationships and stable fixture values.
- [x] 2.3 Add a failing double-run assertion proving stable counts, identifiers, unique values, and join rows.

## 3. Seed Generation And Commands

- [x] 3.1 Implement the adapter-owned typed seed manifest and deterministic SQLite-compatible SQL generator.
- [x] 3.2 Implement convergent upserts for entities and conflict-safe inserts for relationship rows.
- [x] 3.3 Add a package-local `db:seed` command that generates the artifact and invokes Wrangler against the local `Database` binding only.
- [x] 3.4 Add the root `db:seed` forwarding command and document that migrations must run before seeding.

## 4. Local Application And Verification

- [x] 4.1 Run the complete local D1 migration set with `bun run db:push`.
- [x] 4.2 Run `bun run db:seed` twice and confirm both executions succeed without duplicate data.
- [x] 4.3 Query representative store, catalog, pricing, inventory, tax, customer, and fulfillment rows from local D1.
- [x] 4.4 Run targeted seed tests, D1 adapter tests, repository typecheck, and formatting/static checks.

## 5. Planning State

- [x] 5.1 Sync the `deterministic-development-data` delta spec after implementation if accepted behavior changes.
- [x] 5.2 Run `openspec status --change "add-deterministic-development-seed"` and confirm all artifacts and tasks are complete.
