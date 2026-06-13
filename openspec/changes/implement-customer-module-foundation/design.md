## Context

The customer module links commerce customers to shared auth actors without importing Better Auth runtime construction or server Worker internals.

## Scope

- Package boundary: `packages/modules/customer`.
- Service contracts: customer profile, address, group, metadata, and auth relationship resolution.
- Data ownership: customer records, addresses, groups, metadata, and stable auth/customer links.
- Events/workflows: customer created/updated events and workflow steps for checkout/customer resolution.
- API/admin metadata: customer management procedures, permissions, navigation, and screens.
- Tests: auth-contract integration, service/repository behavior, API assembly, admin metadata, and import-boundary checks.

## Non-Goals

- Payment account-holder provider records, cart snapshots, order snapshots, or Better Auth runtime configuration.
