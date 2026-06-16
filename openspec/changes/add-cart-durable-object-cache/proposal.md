## Why

Cart mutations need a low-latency, serialized hot path for visitor and authenticated customer carts without making D1 the request-time coordination layer. This change introduces a Cloudflare Durable Object cart cache that plays the same operational role Redis plays for Medusa carts, while keeping D1 as the admin analytics and projection store.

## What Changes

- Add a cart Durable Object cache capability for active visitor and authenticated customer carts.
- Define runtime-neutral cart cache and projection-sync contracts so `packages/modules/cart` stays free of Cloudflare binding imports.
- Add Cloudflare platform/runtime wiring for a cart-specific Durable Object namespace, hot cart aggregate storage, mutation serialization, hydration, and D1 projection sync.
- Wire `apps/server` cart routes with the existing D1 cart repository adapter through `createD1CartRepository` and the new Durable Object cache adapter.
- Preserve D1 cart tables as the admin analytics/projection surface instead of the cart request hot path.

## Capabilities

### New Capabilities

- `cart-durable-object-cache`: Defines cart hot-cache behavior, visitor/customer ownership scopes, Durable Object mutation coordination, and D1 projection synchronization.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/modules/cart`, `packages/platform-cloudflare`, `packages/infra`, `apps/server`, cart API assembly, Cloudflare Worker bindings, D1 cart repository wiring, and tests.
- Architecture constraints: commerce module code remains runtime-neutral; Cloudflare Durable Object classes and binding access belong in platform/server composition.
- Operational impact: active cart reads and mutations use Durable Objects; D1 receives synchronized cart projections for admin views, analytics, recovery, and reconciliation.
