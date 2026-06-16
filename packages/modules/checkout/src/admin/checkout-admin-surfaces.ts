import type { AdminMetadataContribution } from "@ecommerce/core/admin";

import { checkoutPermissions } from "../permissions";

export const checkoutAdminMetadata = {
  source: {
    key: "checkout",
    label: "Checkout workflow",
    type: "module",
  },
  surfaces: [
    {
      description: "Observe checkout workflow runs and completion outcomes.",
      kind: "resource",
      key: "resource",
      label: "Checkout",
      operations: {
        complete: {
          key: "checkoutComplete",
          permission: checkoutPermissions.execute,
        },
      },
      order: 95,
      path: "/dashboard",
      permission: checkoutPermissions.read,
      primitives: [
        {
          kind: "form",
          key: "checkout-complete-form",
          operation: { key: "checkoutComplete" },
        },
      ],
      title: "Checkout workflow",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const checkoutAdminSurfaces = checkoutAdminMetadata.surfaces;
