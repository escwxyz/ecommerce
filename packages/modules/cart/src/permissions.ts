import { createCommercePermission } from "@ecommerce/core/permissions";

export const cartPermissions = {
  read: createCommercePermission({
    action: "read",
    description: "Read cart aggregates, line items, adjustments, and totals.",
    resource: "cart",
  }),
  write: createCommercePermission({
    action: "write",
    description: "Create and mutate cart-owned pre-order checkout state.",
    resource: "cart",
  }),
} as const;

export const cartPermissionList = [
  cartPermissions.read,
  cartPermissions.write,
] as const;
