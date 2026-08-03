# Development Data

Commerce development data is now PostgreSQL-first through the
`@ecommerce/db-postgres` Effect/Drizzle adapter. The old D1/Kysely seed workflow
has been removed.

```sh
bun run db:migrate
```

Better Auth still owns a provider-private D1 table baseline generated under
`packages/auth/src/migrations/sql/0000_auth.sql`. That D1 seam is for auth
session/account/verification storage only and is not a commerce seed path.

The store tracer slice, customer/product/region-sales-channel/pricing/inventory
foundational slices, and cart/promotion/tax/fulfillment/payment transactional
slices have migrated off the legacy D1/Kysely path. Local checkout smoke tests
still need store defaults, customer payment-identity lookup, product variant
validation, region constraints, sales-channel publishability, pricing
calculation, inventory availability/reservation, tax, payment, and fulfillment
behavior while checkout remains on the legacy runtime. The server composition
therefore provides temporary deterministic compatibility facades for that path.
Those facades are owned by the remaining checkout dependency-contract gap and
must be deleted when checkout consumes migrated Effect services directly.

Do not reintroduce D1 `store`, `customer`, `product`, `product_variant`,
`region`, `region_country`, `sales_channel`, `sales_channel_product`,
`pricing_currency`, `pricing_price_set`, `pricing_price_list`,
`pricing_money_amount`, `pricing_price_rule`, `pricing_price_preference`,
`inventory_item`, `inventory_stock_location`, `inventory_level`,
`inventory_reservation`, `inventory_adjustment_event`, `fulfillment_provider`,
`fulfillment_set`, `shipping_profile`, `service_zone`, `shipping_option`,
`fulfillment`, `shipment`, `return_shipment_link`, `payment_provider`,
`payment_account_holder`, `payment_method`, `payment_collection`,
`payment_session`, `payment`, `payment_capture`, or `payment_refund` tables or
seed rows for migrated behavior.

The server-owned development IDs are constants, not database seed rows.

## Golden Checkout Smoke Test

The server package includes a credential-free integration test that drives cart
and checkout operations through the Effect HTTP transport and verifies
persisted order, payment, fulfillment, and event outcomes. Inventory
availability/reservation, tax behavior, payment behavior, and fulfillment
behavior are supplied by temporary server-owned checkout facades until task
12.5 removes the completed bridge path:

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
