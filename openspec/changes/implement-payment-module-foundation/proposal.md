## Why

Payment must be modeled as ecommerce payments before checkout authorization/capture and order financial references are implemented. This change follows `payment-module-map`.

## What Changes

- Implement payment collections, sessions, payments, captures, refunds, account holders, provider records, payment methods where supported, and status transitions.
- Define normalized provider actions and webhook action extraction.
- Keep PayKit as an adapter candidate, not the public payment model.

## Capabilities

### New Capabilities

- `payment-module-foundation`: Implements the first payment contracts from `payment-module-map`.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/modules/payment`, `packages/payment-provider` if needed, shared database schema assembly, `packages/api`, `apps/web`, and tests.
- Map traceability: derived from `payment-module-map`.
