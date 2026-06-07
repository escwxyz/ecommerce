## Why

The auth evaluator now centralizes permission checks, but the permission vocabulary itself still lives in `packages/auth` as a hardcoded product statement. Before adding customer, cart, order, plugin, or sandbox permissions, modules should declare their own permission descriptors and a composition layer should build the auth access-control adapter from those declarations.

## What Changes

- Add a module permission descriptor contract so commerce modules can declare owned permission resources/actions alongside their other contributions.
- Add a permission composition layer that collects module and plugin permission descriptors, detects duplicates or unsupported shapes, and builds the composed permission statement consumed by auth.
- Refactor `packages/auth` so it owns actor resolution, Better Auth adapter construction, and evaluation mechanics, but receives composed permission statements/roles instead of importing module permissions or hardcoding product vocabulary.
- Update product module declarations so product permissions are declared by the product module, not manually duplicated in `packages/auth`.
- Keep Better Auth default admin `user` and `session` resources admin-only by merging them into admin roles while leaving customer/user roles empty unless explicitly granted.
- Review `add-basic-auth-admin-model` as superseded for admin plugin wiring, actor classification, and product permission assumptions; retain only any remaining D1 schema/migration verification as either a narrowed task or follow-up change.

## Capabilities

### New Capabilities

- `module-auth-permission-composition`: Defines how module/plugin permission descriptors are declared, composed, validated, and supplied to the shared auth Better Auth adapter without creating auth-to-module dependency cycles.

### Modified Capabilities

- None.

## Impact

- Affected code areas: `packages/core`, `packages/auth`, `packages/api`, `packages/modules/product`, plugin/admin metadata composition, and tests for auth, module declarations, API context, and sandbox policy.
- Affected dependency shape: modules may depend on core permission descriptor types; auth must not import module packages; API/server composition bridges module declarations into auth adapter configuration.
- Affected OpenSpec changes: `centralize-auth-permission-evaluation` remains the evaluator implementation baseline; `add-basic-auth-admin-model` should be narrowed or closed as mostly implemented/superseded by current auth plugin and evaluator work.
- Dependencies: continue using Better Auth admin plugin custom permissions; no new dependency is expected.
