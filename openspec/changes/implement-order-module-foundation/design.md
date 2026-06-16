## Context

Order is the post-checkout record of truth. It stores immutable snapshots and stable references from other module contracts, but those modules keep provider-side state ownership.

## Scope

- Package boundary: `packages/modules/order`.
- Service contracts: order creation from workflow outputs, order lookup, status transitions, and selected post-purchase operations.
- Data ownership: placed orders, lines, snapshots, payment/fulfillment references, transactions, status, edits/exchanges/claims/returns/cancellations, and metadata.
- Events/workflows: order placed and order state transition events; checkout workflow step only, not orchestration ownership.
- API/admin metadata: order management procedures, permissions, navigation, and screens.
- Tests: snapshot/reference behavior, event emission, service/repository behavior, API assembly, admin metadata, and import-boundary checks.

## Non-Goals

- Cart mutation, inventory reservation, payment provider state, fulfillment provider state, pricing/promotion/tax ownership, or checkout orchestration.
