# Development Data

The local D1 database has an explicit deterministic seed workflow. Migrations
must run before the seed:

```sh
bun run db:push
bun run db:seed
```

`db:seed` targets only Wrangler's local `Database` binding. It creates stable
checkout prerequisites only for legacy modules that still depend on D1 seed
data. It does not
create store records, customer records, product records, product variants,
region records, sales-channel records, pricing records, inventory records,
auth users, carts, orders, payments, fulfillments, or notification history.

The store tracer slice, customer/product/region-sales-channel/pricing/inventory
foundational slices, and cart/promotion/tax/fulfillment transactional slices
have migrated off the legacy D1/Kysely path. Local checkout smoke tests still
need store defaults, customer payment-identity lookup, product variant
validation, region constraints, sales-channel publishability, pricing
calculation, inventory availability/reservation, tax, and fulfillment behavior
while checkout remains on the legacy runtime. The server composition therefore
provides temporary deterministic compatibility facades for that path. Those
facades are owned by the checkout migration gap and must be deleted in task
8.6, when checkout orchestration moves to Effect and consumes migrated module
service Layers directly.

Do not reintroduce D1 `store`, `customer`, `product`, `product_variant`,
`region`, `region_country`, `sales_channel`, `sales_channel_product`,
`pricing_currency`, `pricing_price_set`, `pricing_price_list`,
`pricing_money_amount`, `pricing_price_rule`, `pricing_price_preference`,
`inventory_item`, `inventory_stock_location`, `inventory_level`,
`inventory_reservation`, `inventory_adjustment_event`, `fulfillment_provider`,
`fulfillment_set`, `shipping_profile`, `service_zone`, `shipping_option`,
`fulfillment`, `shipment`, or `return_shipment_link` tables or seed rows for
migrated behavior.

The command is idempotent. Rerunning it converges records under reserved
development IDs without duplicating entities or relationship rows.

## Golden Checkout Smoke Test

The server package includes a credential-free integration test that applies the
same D1 migrations and seed artifact to isolated SQLite storage, drives cart and
checkout operations through the Hono/oRPC transport, and verifies persisted
order, payment, fulfillment, and event outcomes. Inventory
availability/reservation, tax behavior, and fulfillment behavior are supplied
by temporary server-owned checkout facades until task 8.6 removes the legacy
checkout path:

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
