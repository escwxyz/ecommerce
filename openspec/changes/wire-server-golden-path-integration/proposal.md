## Why

Checkout orchestration and deterministic prerequisite data exist, but the Cloudflare server does not compose all checkout-dependent module services, so the complete commerce path cannot run through the development API. A server-level integration test is needed before admin dashboard work can depend on real transactional behavior.

## What Changes

- Compose customer, tax, payment, fulfillment, order, and checkout routes in `apps/server` alongside the existing store, region/sales-channel, product, pricing, promotion, inventory, cart, and notification/event routes.
- Provide D1-backed repositories and explicit local-safe payment and fulfillment providers through the server composition boundary.
- Add a deterministic automated integration/smoke test that migrates and seeds an isolated database, creates the transactional cart state through public application surfaces, completes checkout through the server API, and verifies persisted order, payment, inventory, fulfillment, cart, and event outcomes.
- Keep credential-gated deployed-stack health coverage separate from the local commerce integration test so the golden path runs in normal development and CI without Cloudflare account credentials.
- Document the local command and runtime prerequisites for repeating the golden-path verification during development.

## Capabilities

### New Capabilities

- `server-golden-path-integration`: Defines complete server composition for checkout-dependent modules and a deterministic automated smoke test across product, pricing, inventory, customer, cart, checkout, order, payment, and fulfillment.

### Modified Capabilities

None.

## Impact

- Affected code: `apps/server`, server/API composition tests, module D1 adapter wiring, local test harnesses, root or package test scripts, and development documentation.
- Affected APIs: the existing module and `checkoutComplete` oRPC procedures become available from the composed server runtime; no new commerce-domain API contract is expected.
- Affected runtime systems: local D1-compatible storage plus existing Cloudflare cart/inventory coordination adapters where the test harness can provide deterministic substitutes.
- Dependencies: existing checkout workflow, module service contracts, D1 migrations/adapters, deterministic development seed, fake provider contracts, Hono, and oRPC. No external payment, fulfillment, or Cloudflare credentials are required for the local smoke test.
