import type { AdminMetadataContribution } from "@ecommerce/core/admin";

import { storePermissions } from "../permissions";

export const storeAdminMetadata = {
  source: {
    key: "store",
    label: "Store module",
    type: "module",
  },
  surfaces: [
    {
      description:
        "Review platform-wide commerce defaults used by other modules.",
      kind: "navigation",
      key: "store:navigation",
      label: "Store",
      operations: {
        read: { key: "storeSettingsGet" },
      },
      order: 10,
      path: "/dashboard",
      permission: storePermissions.read,
      title: "Store settings",
    },
    {
      description:
        "Manage store identity, currencies, locale, timezone, and administrative metadata.",
      kind: "resource",
      key: "store:resource",
      label: "Store settings",
      operations: {
        read: {
          key: "storeSettingsGet",
          permission: storePermissions.read,
        },
        update: {
          key: "storeSettingsUpdate",
          permission: storePermissions.write,
        },
      },
      order: 20,
      path: "/dashboard",
      permission: storePermissions.write,
      primitives: [
        {
          kind: "form",
          key: "store-settings-form",
          operation: { key: "storeSettingsUpdate" },
        },
        {
          kind: "stat",
          key: "store-defaults-summary",
          operation: { key: "storeDefaultsGet" },
        },
      ],
      title: "Store settings",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const storeAdminSurfaces = storeAdminMetadata.surfaces;
