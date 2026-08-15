import type { AdminMetadataContribution } from "@ecommerce/core/admin";

import { orderPermissions } from "../permissions";

export const orderAdminMetadata = {
  source: {
    key: "order",
    label: "Order module",
    type: "module",
  },
  surfaces: [
    {
      description: "Review placed orders and post-checkout history.",
      kind: "navigation",
      key: "order:navigation",
      label: "Orders",
      operations: {
        list: { key: "orderList" },
        read: { key: "orderGet" },
      },
      order: 80,
      path: "/dashboard",
      permission: orderPermissions.read,
      title: "Orders",
    },
    {
      description:
        "Manage order-owned snapshots, references, status transitions, and transaction history.",
      kind: "resource",
      key: "order:resource",
      label: "Orders",
      operations: {
        createFromCheckout: {
          key: "orderCreateFromCheckout",
          permission: orderPermissions.write,
        },
        list: {
          key: "orderList",
          permission: orderPermissions.read,
        },
        read: {
          key: "orderGet",
          permission: orderPermissions.read,
        },
        recordTransaction: {
          key: "orderRecordTransaction",
          permission: orderPermissions.write,
        },
        transitionStatus: {
          key: "orderTransitionStatus",
          permission: orderPermissions.write,
        },
      },
      order: 90,
      path: "/dashboard",
      permission: orderPermissions.read,
      primitives: [
        {
          kind: "table",
          key: "order-table",
          operation: { key: "orderList" },
        },
        {
          kind: "form",
          key: "order-status-transition-form",
          operation: { key: "orderTransitionStatus" },
        },
      ],
      title: "Order management",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const orderAdminSurfaces = orderAdminMetadata.surfaces;
