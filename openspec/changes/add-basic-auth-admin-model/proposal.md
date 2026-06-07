## Why

The product persistence adapter unblocks durable product data, but protected commerce operations still depend on an ad hoc permission shape in test sessions. Before expanding product, customer, cart, or order behavior, auth should define the baseline store actor model and permission source.

## What Changes

- Configure the shared auth package around Better Auth with the admin plugin enabled as the baseline privileged-user model.
- Treat admins as store administrators for back-office commerce actions and users as storefront customers.
- Preserve room to extend roles, store scoping, and customer account behavior in later changes without baking product-specific permissions into the server Worker.
- Expose shared auth/session/permission contracts so modules can check permissions without importing server runtime code.

## Capabilities

### New Capabilities

- `basic-auth-admin-model`: Defines the first auth model for store admins and customers using Better Auth's admin plugin as the privileged administration primitive.

### Modified Capabilities

- None.

## Impact

- Affected code areas: `packages/auth`, `packages/api`, `apps/server`, admin metadata permission checks, and module route authorization tests.
- Affected runtime systems: Better Auth configuration, D1 auth schema/migrations, and server auth route mounting.
- Follow-up scope: store-scoped roles and fine-grained customer account behavior can be added after the baseline admin/customer split is stable.
