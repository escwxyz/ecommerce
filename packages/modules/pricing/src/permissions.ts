import { createCommercePermission } from "@ecommerce/core/permissions";

export const pricingPermissions = {
  read: createCommercePermission({
    action: "read",
    description: "Read pricing configuration and calculated price outputs.",
    resource: "pricing",
  }),
  write: createCommercePermission({
    action: "write",
    description: "Create and update pricing configuration.",
    resource: "pricing",
  }),
} as const;

export const pricingPermissionList = [
  pricingPermissions.read,
  pricingPermissions.write,
] as const;
