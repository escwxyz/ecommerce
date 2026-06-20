# Development Data

The local D1 database has an explicit deterministic seed workflow. Migrations
must run before the seed:

```sh
bun run db:push
bun run db:seed
```

`db:seed` targets only Wrangler's local `Database` binding. It creates stable
checkout prerequisites for store, region, sales channel, product, pricing,
inventory, tax, customer, and fulfillment data. It does not create auth users,
carts, orders, payments, fulfillments, or notification history.

The command is idempotent. Rerunning it converges records under reserved
development IDs without duplicating entities or relationship rows.
