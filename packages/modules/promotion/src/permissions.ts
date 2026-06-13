import { createCommercePermission } from "@ecommerce/core/permissions";

export const promotionPermissions = {
  read: createCommercePermission({
    action: "read",
    description: "Read promotion configuration and adjustment outputs.",
    resource: "promotion",
  }),
  write: createCommercePermission({
    action: "write",
    description: "Create and update promotion campaigns, rules, and limits.",
    resource: "promotion",
  }),
} as const;

export const promotionPermissionList = [
  promotionPermissions.read,
  promotionPermissions.write,
] as const;
