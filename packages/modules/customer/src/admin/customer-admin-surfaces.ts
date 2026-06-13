import type { AdminMetadataContribution } from "@ecommerce/core/admin";

import { customerPermissions } from "../permissions";

export const customerAdminMetadata = {
  source: {
    key: "customer",
    label: "Customer module",
    type: "module",
  },
  surfaces: [
    {
      description: "Review and manage commerce customer profiles.",
      kind: "navigation",
      key: "navigation",
      label: "Customers",
      operations: {
        list: { key: "customerList" },
        update: { key: "customerProfileUpdate" },
      },
      order: 50,
      path: "/dashboard",
      permission: customerPermissions.read,
      title: "Customers",
    },
    {
      description:
        "Manage customer-owned profiles, addresses, auth links, groups, and metadata.",
      kind: "resource",
      key: "resource",
      label: "Customer profiles",
      operations: {
        assignGroup: {
          key: "customerGroupAssign",
          permission: customerPermissions.write,
        },
        create: {
          key: "customerCreate",
          permission: customerPermissions.write,
        },
        linkAuth: {
          key: "customerAuthLink",
          permission: customerPermissions.write,
        },
        list: {
          key: "customerList",
          permission: customerPermissions.read,
        },
        update: {
          key: "customerProfileUpdate",
          permission: customerPermissions.write,
        },
      },
      order: 60,
      path: "/dashboard",
      permission: customerPermissions.write,
      primitives: [
        {
          kind: "form",
          key: "customer-profile-form",
          operation: { key: "customerProfileUpdate" },
        },
        {
          kind: "table",
          key: "customer-table",
          operation: { key: "customerList" },
        },
      ],
      title: "Customer profiles",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const customerAdminSurfaces = customerAdminMetadata.surfaces;
