import type { AdminMetadataContribution } from "@ecommerce/core/admin";

import { pricingPermissions } from "../permissions";

export const pricingAdminMetadata = {
  source: {
    key: "pricing",
    label: "Pricing module",
    type: "module",
  },
  surfaces: [
    {
      description:
        "Manage currencies, price sets, price lists, rules, and calculated price traces.",
      kind: "navigation",
      key: "navigation",
      label: "Pricing",
      operations: {
        read: { key: "pricingCurrencyList" },
      },
      order: 50,
      path: "/dashboard/pricing",
      permission: pricingPermissions.read,
      title: "Pricing",
    },
    {
      description:
        "Configure base and rule-based prices without owning promotions or tax.",
      kind: "resource",
      key: "resource",
      label: "Pricing",
      operations: {
        calculate: {
          key: "pricingCalculate",
          permission: pricingPermissions.read,
        },
        create: {
          key: "pricingPriceSetCreate",
          permission: pricingPermissions.write,
        },
        read: {
          key: "pricingCurrencyList",
          permission: pricingPermissions.read,
        },
      },
      order: 51,
      path: "/dashboard/pricing",
      permission: pricingPermissions.read,
      primitives: [
        {
          kind: "table",
          key: "pricing-currencies-table",
          operation: { key: "pricingCurrencyList" },
        },
        {
          kind: "form",
          key: "pricing-price-set-create-form",
          operation: { key: "pricingPriceSetCreate" },
        },
      ],
      title: "Pricing",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const pricingAdminSurfaces = pricingAdminMetadata.surfaces;
