## Context

Cart and order workflows need replaceable fulfillment providers without reading provider internals or letting fulfillment mutate payment/order financial state.

## Scope

- Package boundary: `packages/modules/fulfillment`.
- Service contracts: shipping option lookup, fulfillment set/profile management, rating/validation/create/cancel/track provider actions.
- Data ownership: fulfillment sets, shipping profiles/options, service zones, fulfillments, shipment records, return shipment linkage, and provider records.
- Events/workflows: fulfillment and shipment events plus checkout/order workflow steps; no checkout orchestration ownership.
- API/admin metadata: fulfillment management procedures, permissions, navigation, and screens.
- Tests: fake-provider contract tests, service/repository behavior, API assembly, admin metadata, and import-boundary checks.

## Non-Goals

- Payment authorization/capture/refund, pricing, promotion, tax, or order financial state.
