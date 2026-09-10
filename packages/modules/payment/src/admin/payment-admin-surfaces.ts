import type { AdminMetadataContribution } from "@ecommerce/core/admin";

import { paymentPermissions } from "../permissions";

export const paymentAdminMetadata = {
  source: {
    key: "payment",
    label: "Payment module",
    type: "module",
  },
  surfaces: [
    {
      description:
        "Review payment collections, sessions, authorizations, captures, and refunds.",
      kind: "navigation",
      key: "navigation",
      label: "Payments",
      operations: {
        list: { key: "paymentCollectionList" },
      },
      order: 95,
      path: "/dashboard",
      permission: paymentPermissions.read,
      title: "Payments",
    },
    {
      description:
        "Manage ecommerce payment state through normalized provider actions.",
      kind: "resource",
      key: "resource",
      label: "Payment collections",
      operations: {
        authorize: {
          key: "paymentAuthorizeSession",
          permission: paymentPermissions.write,
        },
        capture: {
          key: "paymentCapture",
          permission: paymentPermissions.write,
        },
        create: {
          key: "paymentCollectionCreate",
          permission: paymentPermissions.write,
        },
        list: {
          key: "paymentCollectionList",
          permission: paymentPermissions.read,
        },
        refund: {
          key: "paymentRefund",
          permission: paymentPermissions.write,
        },
      },
      order: 96,
      path: "/dashboard",
      permission: paymentPermissions.write,
      primitives: [
        {
          kind: "table",
          key: "payment-collection-table",
          operation: { key: "paymentCollectionList" },
        },
        {
          kind: "form",
          key: "payment-action-form",
          operation: { key: "paymentCapture" },
        },
      ],
      title: "Payment collections",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const paymentAdminSurfaces = paymentAdminMetadata.surfaces;
