## ADDED Requirements

### Requirement: Server composes the complete checkout dependency graph

The Cloudflare server SHALL expose the existing checkout completion procedure only when store, region/sales-channel, product, pricing, promotion, tax, inventory, customer, cart, payment, fulfillment, order, and notification/event services are composed through their public contracts.

#### Scenario: Development server starts with commerce dependencies

- **WHEN** the development Worker builds its API assembly with migrated D1 storage and configured runtime adapters
- **THEN** the server MUST register the customer, tax, payment, fulfillment, order, and checkout route fragments alongside the existing commerce routes
- **AND** checkout MUST receive its dependencies through public module services rather than private repositories or provider SDKs

#### Scenario: Required checkout dependency is absent

- **WHEN** server composition lacks a required repository, provider, coordinator, or service dependency
- **THEN** composition MUST omit or reject checkout activation with the missing dependency identified rather than exposing a partially functional procedure

### Requirement: Transactional modules use persistent server repositories

The server SHALL use module-owned D1 repository adapters for cart projections, inventory, customer, tax, payment, fulfillment, order, notification/event, and the existing catalog/configuration modules participating in checkout.

#### Scenario: Checkout creates post-checkout records

- **WHEN** checkout completes through the server API
- **THEN** the resulting order, payment, inventory reservation, fulfillment, cart checkout references, and notification/event records MUST be persisted through their owning module repositories

#### Scenario: Order participates in D1 composition

- **WHEN** the server creates an order from checkout
- **THEN** the order module MUST persist and read the complete order aggregate through a D1 adapter implementing the public `OrderRepository` contract

### Requirement: Development providers are explicit and production-safe

Deterministic payment and fulfillment providers SHALL be injected explicitly for local development and automated tests, SHALL use provider keys compatible with the deterministic seed, and MUST NOT become an implicit production fallback.

#### Scenario: Local golden path uses deterministic providers

- **WHEN** the local smoke harness enables development provider mode
- **THEN** payment authorization/capture and fulfillment creation MUST execute without external credentials or network calls using the seed-compatible provider keys

#### Scenario: Production provider configuration is absent

- **WHEN** a non-development server runtime has no configured payment or fulfillment provider
- **THEN** the server MUST NOT silently register deterministic test providers as production implementations

### Requirement: Automated golden-path smoke coverage

The project SHALL include an automated server integration test covering product, pricing, inventory, customer, cart, checkout, order, payment, and fulfillment through the composed application transport.

#### Scenario: Golden checkout succeeds

- **WHEN** the test applies all D1 migrations, executes the deterministic development seed, creates an active cart for the seeded customer and product variant through public application procedures, and calls checkout completion through the Hono/oRPC server
- **THEN** the response MUST report a completed checkout with stable links to a created order, authorized or captured payment, and created fulfillment

#### Scenario: Golden checkout outcomes are durable

- **WHEN** the golden checkout response succeeds
- **THEN** the test MUST verify persisted cart totals and checkout references, inventory reservation, order aggregate, payment collection/session/payment/capture, fulfillment, and checkout event records
- **AND** those records MUST retain compatible seeded product, customer, region, currency, stock-location, and shipping-option relationships where owned by their module contracts

#### Scenario: Completed checkout is retried through a new request

- **WHEN** the same cart and checkout idempotency key are submitted through a later HTTP request
- **THEN** the server MUST return the original checkout completion result
- **AND** it MUST NOT create another payment collection or session or replace the cart's captured payment collection reference

### Requirement: Smoke test is isolated and credential-free

The local golden-path smoke test SHALL run deterministically without Cloudflare account credentials, external payment credentials, external fulfillment credentials, or a developer's existing Wrangler database.

#### Scenario: Normal server tests run

- **WHEN** the server package test task runs in local development or CI
- **THEN** the golden-path smoke test MUST create isolated migrated storage, seed it, execute the path, close its resources, and fail the task on any commerce regression

#### Scenario: Deployed health test runs separately

- **WHEN** Cloudflare credentials are unavailable
- **THEN** the local golden-path smoke test MUST still run even if the credential-gated Alchemy deployment test is skipped
