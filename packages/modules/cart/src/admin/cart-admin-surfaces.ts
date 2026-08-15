import type { AdminMetadataContribution } from "@ecommerce/core/admin";

import { cartPermissions } from "../permissions";

export const cartAdminMetadata = {
  source: {
    key: "cart",
    label: "Cart module",
    type: "module",
  },
  surfaces: [
    {
      description: "Review and manage active pre-order cart aggregates.",
      kind: "navigation",
      key: "cart:navigation",
      label: "Carts",
      operations: {
        create: { key: "cartCreate" },
        read: { key: "cartGet" },
        update: { key: "cartLineItemUpdate" },
      },
      order: 80,
      path: "/dashboard",
      permission: cartPermissions.read,
      title: "Carts",
    },
    {
      description:
        "Manage cart-owned customer, line item, address, checkout reference, adjustment, and totals snapshots.",
      kind: "resource",
      key: "cart:resource",
      label: "Cart aggregates",
      operations: {
        addLineItem: {
          key: "cartAddLineItem",
          permission: cartPermissions.write,
        },
        applyAdjustment: {
          key: "cartAdjustmentApply",
          permission: cartPermissions.write,
        },
        read: {
          key: "cartGet",
          permission: cartPermissions.read,
        },
        setReferences: {
          key: "cartSetCheckoutReferences",
          permission: cartPermissions.write,
        },
        updateTotals: {
          key: "cartTotalsUpdate",
          permission: cartPermissions.write,
        },
      },
      order: 90,
      path: "/dashboard",
      permission: cartPermissions.write,
      primitives: [
        {
          kind: "form",
          key: "cart-line-item-form",
          operation: { key: "cartAddLineItem" },
        },
        {
          kind: "table",
          key: "cart-line-item-table",
          operation: { key: "cartGet" },
        },
      ],
      title: "Cart aggregates",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const cartAdminSurfaces = cartAdminMetadata.surfaces;
