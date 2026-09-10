import type { AdminMetadataContribution } from "@ecommerce/core/admin";

import { taxPermissions } from "../permissions";

export const taxAdminMetadata = {
  source: {
    key: "tax",
    label: "Tax module",
    type: "module",
  },
  surfaces: [
    {
      description:
        "Manage tax regions, rates, categories, providers, and calculation policy.",
      kind: "navigation",
      key: "tax:navigation",
      label: "Taxes",
      operations: {
        read: { key: "taxCalculate" },
      },
      order: 70,
      path: "/dashboard/taxes",
      permission: taxPermissions.read,
      title: "Taxes",
    },
    {
      description:
        "Configure tax-owned calculation inputs while keeping region and market policy outside the tax module.",
      kind: "resource",
      key: "tax:resource",
      label: "Taxes",
      operations: {
        calculate: {
          key: "taxCalculate",
          permission: taxPermissions.read,
        },
        createCategory: {
          key: "taxCategoryCreate",
          permission: taxPermissions.write,
        },
        createRate: {
          key: "taxRateCreate",
          permission: taxPermissions.write,
        },
        createRegion: {
          key: "taxRegionCreate",
          permission: taxPermissions.write,
        },
      },
      order: 71,
      path: "/dashboard/taxes",
      permission: taxPermissions.read,
      primitives: [
        {
          kind: "form",
          key: "tax-region-create-form",
          operation: { key: "taxRegionCreate" },
        },
        {
          kind: "table",
          key: "tax-calculation-lines-table",
          operation: { key: "taxCalculate" },
        },
      ],
      title: "Taxes",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const taxAdminSurfaces = taxAdminMetadata.surfaces;
