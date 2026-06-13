import { createCommercePermission } from "@ecommerce/core/permissions";

export const customerPermissions = {
  read: createCommercePermission({
    action: "read",
    description:
      "Read customer profile, address, group, and auth-link records.",
    resource: "customer",
  }),
  write: createCommercePermission({
    action: "write",
    description:
      "Create and update customer profile, address, group, and auth-link records.",
    resource: "customer",
  }),
} as const;

export const customerPermissionList = [
  customerPermissions.read,
  customerPermissions.write,
] as const;
