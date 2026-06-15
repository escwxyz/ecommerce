## Context

Cart coordinates many module contracts but must not hide checkout completion or order creation inside private cart services.

## Scope

- Package boundary: `packages/modules/cart`.
- Service contracts: cart creation, line mutation, customer/email/address association, region/channel selection, shipping/payment references, adjustments, totals snapshots, and metadata.
- Data ownership: cart and line-item pre-order state only.
- Events/workflows: cart mutation events and checkout-preparation workflow steps; checkout completion is separate.
- API/admin metadata: cart management procedures, permissions, navigation, and screens as needed.
- Tests: concurrent mutation/idempotency, service/repository behavior, dependency-contract use, API assembly, admin metadata, and import-boundary checks.

## Non-Goals

- Private order creation, payment SDK calls, fulfillment creation, inventory adjustment, or checkout orchestration.
