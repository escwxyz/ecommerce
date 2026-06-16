## Why

Cart is the pre-order checkout aggregate and must be implemented after pricing, promotion, tax, inventory, customer, product, store, and region/channel contracts are accepted. This change follows `cart-module-map`.

## What Changes

- Implement cart-owned pre-order state, line items, customer association, addresses, region/channel selection, shipping/payment references, adjustments, total snapshots, and metadata.
- Use shared coordination for mutable cart aggregates where required.
- Keep order creation, payment provider calls, fulfillment creation, and inventory adjustments in declared workflows/contracts.

## Capabilities

### New Capabilities

- `cart-module-foundation`: Implements the first cart contracts from `cart-module-map`.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/modules/cart`, shared database schema assembly, stateful coordination contracts, `packages/api`, `apps/web`, and tests.
- Map traceability: derived from `cart-module-map`.
