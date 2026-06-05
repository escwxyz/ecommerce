import { createCommercePermission } from "@ecommerce/core/permissions";

export const productPermissions = {
  read: createCommercePermission({
    action: "read",
    description: "Read product catalog records.",
    resource: "product",
  }),
  write: createCommercePermission({
    action: "write",
    description: "Create and update product catalog records.",
    resource: "product",
  }),
} as const;

export const productPermissionList = [
  productPermissions.read,
  productPermissions.write,
] as const;
