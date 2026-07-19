# Development Data

The local D1 database has an explicit deterministic seed workflow. Migrations
must run before the seed:

```sh
bun run db:push
bun run db:seed
```

`db:seed` targets only Wrangler's local `Database` binding. It creates stable
checkout prerequisites for region, sales channel availability, pricing,
inventory, tax, and fulfillment data. It does not create store records,
customer records, product records, product variants, auth users, carts, orders,
payments, fulfillments, or notification history.

The store tracer slice and customer/product foundational slices have migrated off the
legacy D1/Kysely path. Local checkout smoke tests still need store defaults and
a customer payment-identity lookup plus product variant validation while
checkout and its dependent modules remain on the legacy runtime, so the server
composition provides temporary in-memory compatibility facades for that path.
Do not reintroduce D1 `store`, `customer`, `product`, or `product_variant`
tables or seed rows for migrated behavior.

The command is idempotent. Rerunning it converges records under reserved
development IDs without duplicating entities or relationship rows.

## Golden Checkout Smoke Test

The server package includes a credential-free integration test that applies the
same D1 migrations and seed artifact to isolated SQLite storage, drives cart and
checkout operations through the Hono/oRPC transport, and verifies persisted
order, payment, inventory reservation, fulfillment, and event outcomes:

```sh
cd apps/server
bun run test
```

This test does not read or modify Wrangler's development database and does not
require Cloudflare, payment-provider, or fulfillment-provider credentials.
Alchemy development sets `COMMERCE_PROVIDER_MODE=development`, which explicitly
registers deterministic payment and fulfillment providers under the seeded
`manual` provider key. Non-development stacks set the mode to `disabled`; they
do not expose checkout until production provider registries are configured.

The root `bun run test:integration` command remains a separate,
credential-gated Alchemy deployment and health check. A skipped deployment test
does not skip or replace the local golden checkout smoke test.
