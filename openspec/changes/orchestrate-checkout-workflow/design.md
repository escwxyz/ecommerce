## Context

The domain module map explicitly prevents checkout completion from collapsing into cart, payment, order, fulfillment, or inventory internals. This change remains blocked for implementation until prerequisite module contracts are accepted.

## Scope

- Package boundary: workflow orchestration lives in the shared workflow/module composition layer, not as private logic in a single module.
- Service contracts: consume accepted cart, customer, product, pricing, promotion, tax, inventory, payment, fulfillment, order, and notification/event contracts.
- Data ownership: workflow run/idempotency/compensation state only; domain records remain module-owned.
- Events/workflows: checkout steps, compensation, correlation, causation, workflow run ids, queue/workflow integration, and domain event publication.
- API/admin metadata: checkout-facing procedures and observability metadata where needed.
- Tests: workflow sequencing, idempotency, compensation, module-boundary enforcement, API assembly, and event emission.

## Non-Goals

- Implementing or changing prerequisite module service internals inside this change.

## Implementation Traceability

- Prerequisite contracts are present as accepted public module packages for `store`, `region-sales-channel`, `product`, `pricing`, `promotion`, `tax`, `inventory`, `customer`, `cart`, `payment`, `fulfillment`, `order`, and `notification-event`.
- Checkout orchestration is implemented as a separate `@ecommerce/checkout` module package with structural service-contract dependencies, workflow metadata, API/admin metadata, and event envelopes.
- No intentional divergence from the accepted module-map capabilities was introduced. Checkout calls public service-contract method names and does not import private repositories, provider SDKs, concrete database adapters, Hono, Cloudflare bindings, or frontend runtime code.
