## Why

This change implements the API composition boundary from `define-cloudflare-commerce-blueprint`. `packages/api` must become a router assembler before multiple modules and plugins can contribute API fragments cleanly.

## What Changes

- Refactor `packages/api` into an oRPC router assembly layer.
- Define how auth, modules, and plugins contribute route fragments.
- Preserve Hono as the transport mounted by `apps/server`.

## Capabilities

### New Capabilities

- `module-api-assembly`: Defines module and plugin API composition through shared router contracts.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/api`, `apps/server`, shared API types, and later admin client usage.
- Blueprint traceability: derived from `define-cloudflare-commerce-blueprint` task `2.4`.
