## Why

This change implements the shared auth boundary defined by `define-cloudflare-commerce-blueprint`. Auth contracts must move fully into a reusable package before modules, admin surfaces, workflows, and plugin policies can depend on them safely.

## What Changes

- Refactor `packages/auth` into the shared source of truth for session, user, permission, and auth service contracts.
- Keep `apps/server` responsible only for auth HTTP mounting and runtime provisioning.
- Decide and document the initial permission model.

## Capabilities

### New Capabilities

- `shared-auth-boundary`: Defines reusable auth contracts and the server/runtime split for authentication.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/auth`, `apps/server`, `packages/api`, `apps/web`, and any future module or plugin auth integration.
- Blueprint traceability: derived from `define-cloudflare-commerce-blueprint` tasks `1.2`, `2.2`, and open question assignment for permission model.
