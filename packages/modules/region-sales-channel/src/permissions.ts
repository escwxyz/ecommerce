import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";

export const regionSalesChannelPermissions = {
  regionRead: {
    action: "read",
    key: "region:read",
    resource: "region",
  },
  regionWrite: {
    action: "write",
    key: "region:write",
    resource: "region",
  },
  salesChannelRead: {
    action: "read",
    key: "sales-channel:read",
    resource: "sales-channel",
  },
  salesChannelWrite: {
    action: "write",
    key: "sales-channel:write",
    resource: "sales-channel",
  },
} as const satisfies Record<string, CommercePermissionDescriptor>;

export const regionSalesChannelPermissionList = [
  regionSalesChannelPermissions.regionRead,
  regionSalesChannelPermissions.regionWrite,
  regionSalesChannelPermissions.salesChannelRead,
  regionSalesChannelPermissions.salesChannelWrite,
] as const satisfies readonly CommercePermissionDescriptor[];
