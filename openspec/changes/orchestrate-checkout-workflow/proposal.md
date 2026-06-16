## Why

Checkout touches cart, customer, product, pricing, promotion, tax, inventory, payment, fulfillment, notification/event, and order. It must be planned as orchestration after prerequisite module contracts are accepted, not hidden inside any one module.

## What Changes

- Define a checkout workflow orchestration change that depends on prerequisite module contracts.
- Coordinate cart validation, pricing, promotion, tax, inventory reservation, payment authorization/capture policy, fulfillment selection, order creation, and notification/event publication through declared contracts.
- Keep module internals private and use workflow/event primitives for sequencing, idempotency, compensation, and observability.

## Capabilities

### New Capabilities

- `checkout-workflow-orchestration`: Implements checkout as a separate workflow after prerequisite module contracts are accepted.

### Modified Capabilities

- None.

## Impact

- Affected areas: workflow/event contracts, module service contracts, `packages/api`, `apps/server`, `apps/web`, and tests.
- Map traceability: derived from `commerce-domain-module-map`, `cart-module-map`, `inventory-module-map`, `payment-module-map`, `fulfillment-module-map`, `order-module-map`, and related calculation maps.
