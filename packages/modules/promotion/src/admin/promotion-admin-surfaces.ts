import type { AdminMetadataContribution } from "@ecommerce/core/admin";

import { promotionPermissions } from "../permissions";

export const promotionAdminMetadata = {
  source: {
    key: "promotion",
    label: "Promotion module",
    type: "module",
  },
  surfaces: [
    {
      description:
        "Manage campaigns, discount rules, usage limits, and redemption tracking.",
      kind: "navigation",
      key: "promotion:navigation",
      label: "Promotions",
      operations: {
        read: { key: "promotionAdjustmentsCalculate" },
      },
      order: 60,
      path: "/dashboard/promotions",
      permission: promotionPermissions.read,
      title: "Promotions",
    },
    {
      description:
        "Configure promotion-owned discount adjustments without owning base prices, tax, or order financial records.",
      kind: "resource",
      key: "promotion:resource",
      label: "Promotions",
      operations: {
        calculate: {
          key: "promotionAdjustmentsCalculate",
          permission: promotionPermissions.read,
        },
        create: {
          key: "promotionCreate",
          permission: promotionPermissions.write,
        },
        recordRedemption: {
          key: "promotionRedemptionRecord",
          permission: promotionPermissions.write,
        },
      },
      order: 61,
      path: "/dashboard/promotions",
      permission: promotionPermissions.read,
      primitives: [
        {
          kind: "form",
          key: "promotion-create-form",
          operation: { key: "promotionCreate" },
        },
        {
          kind: "table",
          key: "promotion-adjustments-preview-table",
          operation: { key: "promotionAdjustmentsCalculate" },
        },
      ],
      title: "Promotions",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const promotionAdminSurfaces = promotionAdminMetadata.surfaces;
