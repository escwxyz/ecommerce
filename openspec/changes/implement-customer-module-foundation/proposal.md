## Why

Customer records must exist before account-owned carts and payment account-holder linkage can be implemented. This change follows `customer-module-map`.

## What Changes

- Implement commerce customer profiles, addresses, customer groups, metadata, and auth relationship contracts.
- Keep provider-specific payment account-holder state in the payment module.
- Contribute customer API/admin metadata and tests.

## Capabilities

### New Capabilities

- `customer-module-foundation`: Implements the first customer contracts from `customer-module-map`.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/modules/customer`, shared auth contracts, shared database schema assembly, `packages/api`, `apps/web`, and tests.
- Map traceability: derived from `customer-module-map`.
