import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { createCommercePermission } from "@ecommerce/core/permissions";

export const fulfillmentPermissions = {
  read: createCommercePermission({
    action: "read",
    description:
      "Read fulfillment sets, shipping options, fulfillments, and shipment records.",
    resource: "fulfillment",
  }),
  write: createCommercePermission({
    action: "write",
    description:
      "Create and update fulfillment sets, shipping options, fulfillments, and shipments.",
    resource: "fulfillment",
  }),
} as const satisfies Record<string, CommercePermissionDescriptor>;

export const fulfillmentPermissionList = [
  fulfillmentPermissions.read,
  fulfillmentPermissions.write,
] as const;
