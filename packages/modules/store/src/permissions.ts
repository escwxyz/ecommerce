import { createCommercePermission } from "@ecommerce/core/permissions";

export const storePermissions = {
  read: createCommercePermission({
    action: "read",
    description: "Read store settings and commerce defaults.",
    resource: "store",
  }),
  write: createCommercePermission({
    action: "write",
    description: "Update store settings and administrative defaults.",
    resource: "store",
  }),
} as const;

export const storePermissionList = [
  storePermissions.read,
  storePermissions.write,
] as const;
