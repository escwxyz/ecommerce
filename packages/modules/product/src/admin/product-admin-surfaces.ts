import type { AdminMetadataContribution } from "@ecommerce/core/admin";

import { productPermissions } from "../permissions";

export const productAdminMetadata = {
  source: {
    key: "product",
    label: "Product module",
    type: "module",
  },
  surfaces: [
    {
      description: "Create and review product drafts from the admin dashboard.",
      kind: "navigation",
      key: "navigation",
      label: "Products",
      operations: {
        list: { key: "productList" },
      },
      order: 20,
      path: "/dashboard",
      permission: productPermissions.read,
      title: "Product catalog",
    },
    {
      description: "Manage the first product management surface.",
      kind: "resource",
      key: "resource",
      label: "Product catalog",
      operations: {
        create: {
          key: "productCreate",
          permission: productPermissions.write,
        },
        list: {
          key: "productList",
          permission: productPermissions.read,
        },
      },
      order: 30,
      path: "/dashboard",
      permission: productPermissions.write,
      primitives: [
        {
          kind: "form",
          key: "product-create-form",
          operation: { key: "productCreate" },
        },
        {
          kind: "table",
          key: "product-table",
          operation: { key: "productList" },
        },
      ],
      title: "Product catalog",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const productAdminSurfaces = productAdminMetadata.surfaces;
