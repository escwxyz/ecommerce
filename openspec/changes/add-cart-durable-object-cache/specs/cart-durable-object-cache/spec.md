## ADDED Requirements

### Requirement: Cart Durable Object hot cache

The system SHALL use a Cloudflare Durable Object backed cache as the operational hot path for active cart aggregate reads and mutations in the Cloudflare server runtime.

#### Scenario: Active cart mutation uses the hot cache

- **WHEN** a visitor or authenticated customer creates or mutates an active cart through the server API
- **THEN** the mutation MUST be routed to the cart Durable Object cache before the response is returned
- **AND** the active cart aggregate returned by the API MUST reflect the state accepted by that Durable Object

#### Scenario: Cached cart is missing

- **WHEN** a cart Durable Object receives a request for an active cart aggregate that is not present in its cache storage
- **THEN** it MUST hydrate the aggregate from the configured cart projection repository when a projection exists
- **AND** it MUST return a not-found result without creating phantom cart state when no projection exists

### Requirement: Visitor and customer cart ownership scopes

The cart cache SHALL distinguish anonymous visitor cart scopes from authenticated customer cart scopes and MUST enforce that a cache caller can only access carts owned by the current scope or explicitly claimed into that scope.

#### Scenario: Visitor cart is cached

- **WHEN** an anonymous visitor creates or mutates a cart
- **THEN** the cart cache MUST associate the active cart with a stable visitor scope
- **AND** later requests using that visitor scope MUST resolve to the same active cart until the cart is completed, deleted, expired, or claimed

#### Scenario: Customer cart is cached

- **WHEN** an authenticated customer creates, reads, or mutates a cart
- **THEN** the cart cache MUST associate the active cart with the authenticated customer scope
- **AND** a different customer or visitor scope MUST NOT read or mutate that cart through the cache

#### Scenario: Visitor cart is claimed by a customer

- **WHEN** an authenticated customer explicitly claims or associates an anonymous visitor cart
- **THEN** the cart cache MUST update ownership metadata so the cart belongs to the customer scope
- **AND** the previous visitor scope MUST NOT be able to continue mutating the claimed customer cart unless the API explicitly authorizes that transition

### Requirement: D1 cart projection synchronization

The cart Durable Object cache SHALL synchronize accepted cart aggregate changes to the existing D1 cart repository so D1 remains available for admin analytics, recovery, and reconciliation.

#### Scenario: Mutation is accepted

- **WHEN** the cart Durable Object accepts a cart mutation
- **THEN** it MUST persist the updated active aggregate in Durable Object storage
- **AND** it MUST write or enqueue an idempotent projection update to the configured D1 cart repository

#### Scenario: Projection write is retried

- **WHEN** a D1 projection write fails after the Durable Object has accepted the cart mutation
- **THEN** the Durable Object MUST retain pending sync metadata sufficient to retry or reconcile the D1 projection
- **AND** retrying the projection MUST NOT duplicate line items, adjustments, or idempotent mutation effects

#### Scenario: Admin reads cart data

- **WHEN** an admin or analytics surface reads cart data outside the active cart request path
- **THEN** it MUST read from the D1 cart projection or an API backed by that projection
- **AND** it MUST NOT require direct access to Durable Object storage

### Requirement: Runtime boundary and server wiring

The Cloudflare cart cache implementation SHALL be wired through platform/server composition while keeping cart module contracts and API assembly free of Cloudflare runtime bindings.

#### Scenario: Worker composes cart routes

- **WHEN** `apps/server` creates the root API assembly for the Cloudflare runtime
- **THEN** it MUST inject cart route options that use `createD1CartRepository` for the D1 projection repository
- **AND** it MUST inject the platform Cloudflare cart Durable Object cache adapter for active cart operations

#### Scenario: Module boundary is verified

- **WHEN** code under `packages/modules/cart` or `packages/api` is checked for runtime boundary regressions
- **THEN** the check MUST fail if those packages import `cloudflare:workers`, Worker binding types, `DurableObjectNamespace`, or cart Durable Object implementation files

#### Scenario: Infra provides cart cache binding

- **WHEN** the Cloudflare infra stack provisions the server Worker
- **THEN** it MUST provide a cart Durable Object namespace binding dedicated to the cart cache
- **AND** the server Worker MUST export the matching cart Durable Object class for deployment.
