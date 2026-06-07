# Design

## Context

The repo already has the first workflow/event primitive slice:

- `packages/core` defines workflow definitions, step attempts, idempotency metadata, lifecycle events, runtime contracts, and metadata store contracts.
- `packages/core/testing` provides an in-memory runtime for contract tests.
- `packages/platform-cloudflare` has a Cloudflare workflow runtime adapter surface.

That layer is necessary but not sufficient for business flows where correctness depends on serialized mutation and uniqueness. Cart mutation, inventory reservations, checkout attempts, payment webhook application, and webhook delivery state all need a stateful runtime pattern before domain modules start depending on ad hoc storage choices.

The merchant reference DO (`refs/merchant/src/do.ts`) is useful as a pattern, not as a schema to copy. It demonstrates:

- merchant-scoped Durable Object ownership
- SQLite-backed DO storage for mutable local state
- cart expiration and reservation cleanup
- event/webhook delivery tracking
- WebSocket/event subscription fanout
- local uniqueness and serialized mutation around carts, inventory, and checkout sessions

## Decisions

1. Keep DOs behind platform-owned ports.

   Pure modules should depend on contracts such as `StatefulCoordinator`, `SerializedMutationPort`, or more specific future module ports, not `DurableObjectNamespace`, `DurableObjectStub`, or `cloudflare:workers`. `packages/platform-cloudflare` owns the adapter that maps those ports to DO namespaces and stubs.

   Alternative considered: let modules own their own Cloudflare DO classes. Rejected because it would leak deployment/runtime details into module packages and make non-Cloudflare tests harder.

2. Treat DO storage as coordination state and mutable runtime state, not primary commerce records.

   DOs may own highly mutable state that needs serialized access, expiration, uniqueness, reservation bookkeeping, or runtime fanout. Long-lived primary business records still belong behind database/repository contracts and D1/Kysely adapters unless a later module-specific design proves otherwise.

   Alternative considered: store carts and inventory exclusively in D1 with transactional patterns. Rejected for this foundation pass because D1 does not provide the same per-key single-threaded coordination semantics as DOs.

3. Introduce a queue port before domain event consumers.

   Queue publishing and consuming need a foundation contract with stable message identity, correlation id, causation id, subject, retry metadata, and dead-letter/error handling shape. Domain modules should publish work through a queue/event port rather than binding directly to Cloudflare Queue APIs.

   Alternative considered: defer queues until first checkout workflow. Rejected because checkout and payment webhook handling would otherwise define incompatible retry and idempotency conventions.

4. Verify Workflow + Queue + DO together with adapter-level contract tests.

   Existing workflow tests prove in-memory semantics and basic Cloudflare adapter behavior. The next foundation slice should add tests that start a workflow, enqueue a correlated message, and coordinate a mutation through a DO-shaped adapter. These tests can use fakes, but the fakes must model platform behavior relevant to idempotency, retries, and serialization.

5. Create a provider-neutral payment foundation package before the payment module.

   PayKit exposes a useful shape: provider operations, normalized webhook events, customer/payment method/subscription/invoice abstractions, and provider sync. The commerce platform should extract a smaller stable contract in a separate package, proposed as `packages/payment-provider`, so the later `packages/modules/payment` business module can depend on normalized payment capabilities rather than PayKit or Stripe directly.

   Alternative considered: put provider normalization directly in `packages/modules/payment`. Rejected because the business module would become provider-framework-aware before its own domain contracts are stable.

6. Keep concrete PayKit integration out of this foundation pass.

   This change should define the adapter boundary and tests with fake providers. A later change can add a `PayKitPaymentProviderAdapter` once the contract is proven and dependency risk is reviewed.

## Runtime Shape

```text
apps/server Worker composition
  |
  | bindings
  v
packages/platform-cloudflare
  |-- Workflow adapter
  |-- Queue adapter
  |-- Durable Object coordinator adapter
  |-- payment-provider adapter wiring later
  |
  v
packages/core contracts
  |-- workflow runtime
  |-- event publisher
  |-- queue/work item contracts
  |-- stateful coordination contracts
  |
  v
future modules
  |-- cart
  |-- inventory
  |-- checkout/order
  |-- payment
```

## Payment Boundary

```text
packages/payment-provider
  |
  | normalized contracts
  v
PayKit adapter later     Stripe adapter later     other provider later
  |
  v
provider SDKs / webhooks

packages/modules/payment later
  |
  | depends on normalized provider contract
  v
commerce payment sessions, authorizations, captures, refunds
```

## Risks

- DOs can become hidden databases if boundaries are too broad. Mitigation: name them coordination/runtime ports and require explicit specs before a module stores primary records in a DO.
- Queue retries can duplicate work. Mitigation: require idempotency keys and consumer contracts before business consumers exist.
- PayKit may be too billing-oriented for all commerce payment needs. Mitigation: extract only provider-neutral primitives first and add concrete PayKit integration later after adapter review.
- Over-generalizing the stateful runtime can delay domain work. Mitigation: keep this slice focused on ports, fakes, adapter tests, and explicit non-goals.
