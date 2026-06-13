## Why

Pricing must exist before cart totals can safely depend on price sets, price lists, price rules, and calculated price outputs. This change follows `pricing-module-map`.

## What Changes

- Implement a pure pricing module for currencies, price sets, price lists, price rules, price preferences, money amounts, and calculated prices.
- Keep promotions and tax as separate calculation outputs.
- Contribute pricing API/admin metadata and tests.

## Capabilities

### New Capabilities

- `pricing-module-foundation`: Implements the first pricing contracts from `pricing-module-map`.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/modules/pricing`, shared database schema assembly, `packages/api`, `apps/web`, and tests.
- Map traceability: derived from `pricing-module-map`.
