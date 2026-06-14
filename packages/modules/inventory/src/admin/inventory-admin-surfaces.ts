import type { AdminMetadataContribution } from "@ecommerce/core/admin";

import { inventoryPermissions } from "../permissions";

export const inventoryAdminMetadata = {
  source: {
    key: "inventory",
    label: "Inventory module",
    type: "module",
  },
  surfaces: [
    {
      description:
        "Manage inventory items, stock locations, levels, reservations, and adjustment events.",
      kind: "navigation",
      key: "navigation",
      label: "Inventory",
      operations: {
        read: { key: "inventoryAvailabilityCheck" },
      },
      order: 60,
      path: "/dashboard/inventory",
      permission: inventoryPermissions.read,
      title: "Inventory",
    },
    {
      description:
        "Reserve stock and inspect availability through declared location and channel scope.",
      kind: "resource",
      key: "resource",
      label: "Inventory",
      operations: {
        adjust: {
          key: "inventoryAdjust",
          permission: inventoryPermissions.write,
        },
        create: {
          key: "inventoryItemCreate",
          permission: inventoryPermissions.write,
        },
        read: {
          key: "inventoryAvailabilityCheck",
          permission: inventoryPermissions.read,
        },
        reserve: {
          key: "inventoryReserve",
          permission: inventoryPermissions.write,
        },
      },
      order: 61,
      path: "/dashboard/inventory",
      permission: inventoryPermissions.read,
      primitives: [
        {
          kind: "form",
          key: "inventory-item-create-form",
          operation: { key: "inventoryItemCreate" },
        },
        {
          kind: "form",
          key: "inventory-reservation-form",
          operation: { key: "inventoryReserve" },
        },
      ],
      title: "Inventory",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const inventoryAdminSurfaces = inventoryAdminMetadata.surfaces;
