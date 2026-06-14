import { createCommercePermission } from "@ecommerce/core/permissions";

export const inventoryPermissions = {
  read: createCommercePermission({
    action: "read",
    description:
      "Read inventory items, locations, levels, reservations, and availability.",
    resource: "inventory",
  }),
  write: createCommercePermission({
    action: "write",
    description:
      "Create and update inventory items, locations, levels, reservations, and adjustments.",
    resource: "inventory",
  }),
} as const;

export const inventoryPermissionList = [
  inventoryPermissions.read,
  inventoryPermissions.write,
] as const;
