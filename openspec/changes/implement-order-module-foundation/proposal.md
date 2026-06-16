## Why

Order owns post-checkout records and must consume workflow outputs rather than reading cart, payment, fulfillment, inventory, or pricing internals. This change follows `order-module-map`.

## What Changes

- Implement placed orders, order lines, item snapshots, addresses, totals snapshots, payment/fulfillment references, transactions, status transitions, edits, exchanges, claims, returns, cancellations, and metadata as selected for the foundation slice.
- Publish order domain events through shared event contracts.
- Keep checkout orchestration separate.

## Capabilities

### New Capabilities

- `order-module-foundation`: Implements the first order contracts from `order-module-map`.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/modules/order`, shared database schema assembly, workflow/event contracts, `packages/api`, `apps/web`, and tests.
- Map traceability: derived from `order-module-map`.
