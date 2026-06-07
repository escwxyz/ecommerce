## Why

The permission vocabulary exists, but permission evaluation is still duplicated at API and module call sites. Centralizing evaluation now keeps the first admin model simple while giving modules, plugins, admin metadata, and sandbox policy one shared authorization contract before more commerce modules depend on it.

## What Changes

- Add a shared authorization service interface in `packages/auth` for resolving actor classification and evaluating permission requirements.
- Move session permission extraction and permission matching behind shared helpers instead of repeating `session.user.permissions` assumptions in product routes, admin metadata, or future modules.
- Keep the initial model compatible with `basic-auth-admin-model`: Better Auth admin-capable users are store administrators, ordinary authenticated users are customers, and modules still declare their required resource/action permissions.
- Define the Better Auth admin plugin custom-permission adapter shape so the commerce permission vocabulary can be represented through Better Auth access-control statements, roles, and client/server admin plugin configuration.
- Preserve extension room for future store scoping, custom roles, plugin-declared permissions, and sandbox bridge policy without introducing a full policy engine in this slice.

## Capabilities

### New Capabilities

- `auth-permission-evaluation`: Defines shared permission evaluation, actor resolution, Better Auth custom-permission integration, and call-site consumption rules for modules, admin metadata, plugins, and sandbox policy.

### Modified Capabilities

- None.

## Impact

- Affected code areas: `packages/auth`, `packages/api`, `packages/modules/product`, future module route fragments, admin metadata composition, and plugin bridge policy contracts.
- Affected API surfaces: shared auth exports, API context/session helpers, module authorization helpers, admin metadata permission filtering, and test fixtures that construct authenticated contexts.
- Dependencies: continue using Better Auth's admin plugin and custom access-control APIs; no new dependency is expected.
- Planning context: follows `add-basic-auth-admin-model` and the Cloudflare commerce blueprint decision that `packages/auth` owns shared auth/session/permission contracts while `apps/server` owns runtime mounting.
