import type { AdminMetadataContribution } from "@ecommerce/core/admin";

import { fulfillmentPermissions } from "../permissions";

export const fulfillmentAdminMetadata = {
  source: {
    key: "fulfillment",
    label: "Fulfillment module",
    type: "module",
  },
  surfaces: [
    {
      description:
        "Review fulfillment sets, shipping options, fulfillments, and shipments.",
      kind: "navigation",
      key: "fulfillment:navigation",
      label: "Fulfillment",
      operations: {
        list: { key: "fulfillmentList" },
      },
      order: 100,
      path: "/dashboard",
      permission: fulfillmentPermissions.read,
      title: "Fulfillment",
    },
    {
      description:
        "Manage provider-backed shipping options and fulfillment lifecycle actions.",
      kind: "resource",
      key: "fulfillment:resource",
      label: "Fulfillments",
      operations: {
        cancel: {
          key: "fulfillmentCancel",
          permission: fulfillmentPermissions.write,
        },
        create: {
          key: "fulfillmentCreate",
          permission: fulfillmentPermissions.write,
        },
        list: {
          key: "fulfillmentList",
          permission: fulfillmentPermissions.read,
        },
        shippingOptions: {
          key: "fulfillmentShippingOptionList",
          permission: fulfillmentPermissions.read,
        },
        track: {
          key: "fulfillmentTrackShipment",
          permission: fulfillmentPermissions.write,
        },
      },
      order: 101,
      path: "/dashboard",
      permission: fulfillmentPermissions.write,
      primitives: [
        {
          kind: "table",
          key: "fulfillment-table",
          operation: { key: "fulfillmentList" },
        },
        {
          kind: "form",
          key: "fulfillment-action-form",
          operation: { key: "fulfillmentCreate" },
        },
      ],
      title: "Fulfillments",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const fulfillmentAdminSurfaces = fulfillmentAdminMetadata.surfaces;
