import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { createCommercePermission } from "@ecommerce/core/permissions";

export const paymentPermissions = {
  read: createCommercePermission({
    action: "read",
    description:
      "Read payment collections, sessions, payments, captures, and refunds.",
    resource: "payment",
  }),
  write: createCommercePermission({
    action: "write",
    description:
      "Create and update payment collections, provider sessions, captures, and refunds.",
    resource: "payment",
  }),
} as const satisfies Record<string, CommercePermissionDescriptor>;

export const paymentPermissionList = [
  paymentPermissions.read,
  paymentPermissions.write,
] as const;
