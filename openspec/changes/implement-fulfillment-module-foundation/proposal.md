## Why

Fulfillment must expose shipping options, provider contracts, and shipment/fulfillment records before checkout/order workflows can create fulfillments. This change follows `fulfillment-module-map`.

## What Changes

- Implement fulfillment sets, shipping profiles, shipping options, service zones, fulfillments, shipment records, return shipment linkage, and provider records.
- Keep payment, pricing, promotion, and tax state outside fulfillment.
- Contribute fulfillment API/admin metadata and tests.

## Capabilities

### New Capabilities

- `fulfillment-module-foundation`: Implements the first fulfillment contracts from `fulfillment-module-map`.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/modules/fulfillment`, shared database schema assembly, `packages/api`, `apps/web`, and tests.
- Map traceability: derived from `fulfillment-module-map`.
