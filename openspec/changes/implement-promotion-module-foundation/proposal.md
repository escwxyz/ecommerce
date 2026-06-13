## Why

Promotion rules must be separate from pricing and tax so cart totals can explain base price, discount, and tax components independently. This change follows `promotion-module-map`.

## What Changes

- Implement a promotion module for campaigns, promotions, rule definitions, discount application policy, usage limits, redemption tracking, and metadata.
- Return traceable adjustment outputs instead of letting cart read promotion internals.
- Contribute promotion API/admin metadata and tests.

## Capabilities

### New Capabilities

- `promotion-module-foundation`: Implements the first promotion contracts from `promotion-module-map`.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/modules/promotion`, shared database schema assembly, `packages/api`, `apps/web`, and tests.
- Map traceability: derived from `promotion-module-map`.
