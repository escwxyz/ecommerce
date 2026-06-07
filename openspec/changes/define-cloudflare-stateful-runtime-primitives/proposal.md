# Define Cloudflare Stateful Runtime Primitives

## Summary

Add the missing foundation layer for stateful Cloudflare commerce workloads before implementing cart, inventory, checkout, order, or payment business logic.

This change defines and verifies:

- Durable Object coordination primitives for highly mutable, uniqueness-sensitive aggregates.
- Queue dispatch and consumer contracts for asynchronous platform work.
- Workflow runtime smoke paths that exercise Workflow, Queue, and Durable Object integration behind existing `packages/core` workflow contracts.
- A provider-neutral payment foundation package that can wrap PayKit-style providers without leaking a concrete provider into commerce modules.

## Motivation

The current foundation has core workflow contracts, an in-memory workflow runtime, a Cloudflare workflow adapter, database adapters, auth, plugin contracts, and API/admin composition. That is enough for simple module slices, but not enough for cart, inventory reservation, checkout, or payment flows.

`refs/merchant/src/do.ts` shows the shape of state that should not be treated as ordinary relational module persistence: carts, inventory reservations, event/webhook dispatch, and other merchant-scoped mutable state need serialization, uniqueness, and fast local mutation. Cloudflare Durable Objects are the right primitive for that coordination layer, with D1 used for primary relational records and projections rather than run-local locking.

Payment should also be isolated before business logic lands. The payment module can later expose commerce payment behavior, but provider normalization should live in a separate package so PayKit, Stripe, Adyen, or another provider can be swapped behind one contract.

## Scope

In scope:

- Define platform contracts for DO namespace resolution, typed state object dispatch, queue publishing, queue consuming, and workflow/queue/DO correlation metadata.
- Add Cloudflare adapter tests proving workflow starts can enqueue work and coordinate through a DO-shaped adapter without modules importing Cloudflare runtime types.
- Define a payment-provider foundation package contract inspired by PayKit's provider and normalized webhook/event model.
- Add import-boundary tests so `packages/core`, pure modules, and the payment-provider foundation remain free of `cloudflare:workers`, Hono server code, and concrete payment-provider SDKs.
- Capture the cart/inventory DO pattern from `refs/merchant/src/do.ts` as infrastructure guidance without copying its business schema into modules.

Out of scope:

- Implement cart, inventory, checkout, order, fulfillment, refund, customer, discount, or product-domain business logic.
- Implement a concrete PayKit adapter, Stripe adapter, or payment provider SDK integration.
- Build admin UI for monitoring DOs, queues, workflows, or payment providers.
- Replace D1/Kysely primary storage with Durable Objects.

## Affected Areas

- `packages/core`
- `packages/platform-cloudflare`
- `packages/db` and `packages/db-d1` only for optional projections or tests if required
- new provider-neutral payment foundation package, proposed as `packages/payment-provider`
- `apps/server` only for Worker binding composition tests, if needed

## Blueprint Traceability

This follows the Cloudflare commerce blueprint boundaries:

- Core contracts remain platform-free.
- Cloudflare bindings stay inside `packages/platform-cloudflare` or `apps/server` composition.
- Modules do not import Cloudflare runtime primitives directly.
- Payment provider normalization is separated from the future `packages/modules/payment` business module.
