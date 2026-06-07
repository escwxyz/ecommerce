## Why

Store configuration is the first dependency tier for later region, pricing, tax, order, and admin behavior. This change implements the store foundation after `store-module-map` is accepted.

## What Changes

- Create a pure `packages/modules/store` module for store identity, defaults, supported currencies, locale/timezone policy, metadata, and administrative settings.
- Declare store service contracts, repository boundaries, module metadata, API fragments, admin metadata, events, and tests inside the store module scope.
- Keep Worker, Cloudflare binding, Hono, frontend, and concrete database adapter code outside the store module.

## Capabilities

### New Capabilities

- `store-module-foundation`: Implements the first store service and metadata contract from `store-module-map`.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/modules/store`, shared database schema assembly, `packages/api`, `apps/web`, and tests.
- Map traceability: derived from `store-module-map`.
