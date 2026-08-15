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
      key: "product:navigation",
      label: "Products",
      operations: {
        create: { key: "productCreate" },
        list: { key: "productList" },
        update: { key: "productCatalogUpdate" },
      },
      order: 20,
      path: "/dashboard",
      permission: productPermissions.read,
      title: "Product catalog",
    },
    {
      description: "Manage the first product management surface.",
      kind: "resource",
      key: "product:resource",
      label: "Product catalog",
      operations: {
        create: {
          key: "productCreate",
          permission: productPermissions.write,
        },
        update: {
          key: "productCatalogUpdate",
          permission: productPermissions.write,
        },
        validateVariant: {
          key: "productVariantValidate",
          permission: productPermissions.read,
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
    {
      description:
        "Manage product-owned variants, options, collections, categories, media, tags, metadata, and publishable/search attributes.",
      kind: "resource",
      key: "product:catalog-structure",
      label: "Catalog structure",
      operations: {
        read: {
          key: "productGet",
          permission: productPermissions.read,
        },
        update: {
          key: "productCatalogUpdate",
          permission: productPermissions.write,
        },
        validateVariant: {
          key: "productVariantValidate",
          permission: productPermissions.read,
        },
      },
      order: 40,
      path: "/dashboard",
      permission: productPermissions.write,
      primitives: [
        {
          kind: "form",
          key: "product-catalog-structure-form",
          operation: { key: "productCatalogUpdate" },
        },
        {
          kind: "table",
          key: "product-variant-table",
          operation: { key: "productGet" },
        },
      ],
      title: "Catalog structure",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const productAdminSurfaces = productAdminMetadata.surfaces;
