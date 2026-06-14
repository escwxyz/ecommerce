import { createCommercePermission } from "@ecommerce/core/permissions";

export const taxPermissions = {
  read: createCommercePermission({
    action: "read",
    description: "Read tax configuration and calculation outputs.",
    resource: "tax",
  }),
  write: createCommercePermission({
    action: "write",
    description:
      "Create and update tax regions, rates, categories, and providers.",
    resource: "tax",
  }),
} as const;

export const taxPermissionList = [
  taxPermissions.read,
  taxPermissions.write,
] as const;
