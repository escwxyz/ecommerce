## Why

Region and sales-channel constraints must exist before pricing, tax, fulfillment, payment availability, inventory availability, cart totals, and storefront publishability are implemented. This change follows `region-sales-channel-module-map`.

## What Changes

- Implement initial region and sales-channel foundations with separately declared service surfaces.
- Own region market constraints and sales-channel publishability/availability scope.
- Contribute API/admin metadata and tests for the combined foundation package if implemented together.

## Capabilities

### New Capabilities

- `region-sales-channel-module-foundation`: Implements the first region and sales-channel contracts from `region-sales-channel-module-map`.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/modules/region-sales-channel` or separate `region` and `sales-channel` packages, database schema assembly, `packages/api`, `apps/web`, and tests.
- Map traceability: derived from `region-sales-channel-module-map`.
