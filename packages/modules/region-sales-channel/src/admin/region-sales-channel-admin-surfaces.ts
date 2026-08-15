import type { AdminMetadataContribution } from "@ecommerce/core/admin";

import { regionSalesChannelPermissions } from "../permissions";

export const regionSalesChannelAdminMetadata = {
  source: {
    key: "region-sales-channel",
    label: "Region and sales-channel module",
    type: "module",
  },
  surfaces: [
    {
      description:
        "Manage region currency, country, tax, payment, and fulfillment availability references.",
      kind: "navigation",
      key: "region-sales-channel:regions-navigation",
      label: "Regions",
      operations: {
        read: { key: "regionList" },
      },
      order: 30,
      path: "/dashboard/regions",
      permission: regionSalesChannelPermissions.regionRead,
      title: "Regions",
    },
    {
      description: "Create and review region market constraints.",
      kind: "resource",
      key: "region-sales-channel:regions-resource",
      label: "Regions",
      operations: {
        create: {
          key: "regionCreate",
          permission: regionSalesChannelPermissions.regionWrite,
        },
        read: {
          key: "regionList",
          permission: regionSalesChannelPermissions.regionRead,
        },
      },
      order: 31,
      path: "/dashboard/regions",
      permission: regionSalesChannelPermissions.regionRead,
      primitives: [
        {
          kind: "table",
          key: "regions-table",
          operation: { key: "regionList" },
        },
        {
          kind: "form",
          key: "region-create-form",
          operation: { key: "regionCreate" },
        },
      ],
      title: "Regions",
    },
    {
      description: "Manage sales-channel publishability and storefront scope.",
      kind: "navigation",
      key: "region-sales-channel:sales-channels-navigation",
      label: "Sales channels",
      operations: {
        read: { key: "salesChannelList" },
      },
      order: 40,
      path: "/dashboard/sales-channels",
      permission: regionSalesChannelPermissions.salesChannelRead,
      title: "Sales channels",
    },
    {
      description: "Create channels and publish products into channel scope.",
      kind: "resource",
      key: "region-sales-channel:sales-channels-resource",
      label: "Sales channels",
      operations: {
        create: {
          key: "salesChannelCreate",
          permission: regionSalesChannelPermissions.salesChannelWrite,
        },
        publish: {
          key: "salesChannelProductPublish",
          permission: regionSalesChannelPermissions.salesChannelWrite,
        },
        read: {
          key: "salesChannelList",
          permission: regionSalesChannelPermissions.salesChannelRead,
        },
      },
      order: 41,
      path: "/dashboard/sales-channels",
      permission: regionSalesChannelPermissions.salesChannelRead,
      primitives: [
        {
          kind: "table",
          key: "sales-channels-table",
          operation: { key: "salesChannelList" },
        },
        {
          kind: "form",
          key: "sales-channel-create-form",
          operation: { key: "salesChannelCreate" },
        },
      ],
      title: "Sales channels",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const regionSalesChannelAdminSurfaces =
  regionSalesChannelAdminMetadata.surfaces;
