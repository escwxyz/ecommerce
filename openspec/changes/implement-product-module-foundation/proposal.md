## Why

This change implements the first vertical slice chosen in `define-cloudflare-commerce-blueprint`. A product module is the best first proof that module declarations, schema ownership, API assembly, admin metadata, and tests are coherent.

## What Changes

- Create the first end-to-end `product` module slice.
- Define product-owned schema, repositories, services, API fragments, and admin metadata.
- Validate module composition rules against a real commerce domain.

## Capabilities

### New Capabilities

- `product-module-foundation`: Defines the first commerce module slice and its integration with the shared runtime.

### Modified Capabilities

- None.

## Impact

- Affected areas: planned `packages/modules/product`, `packages/api`, `apps/web`, database contracts, and tests.
- Blueprint traceability: derived from `define-cloudflare-commerce-blueprint` task `1.3` and task `2.5`.
