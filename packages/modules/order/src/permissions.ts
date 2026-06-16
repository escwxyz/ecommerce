export const orderPermissions = {
  read: {
    action: "read",
    key: "order:read",
    resource: "order",
  },
  write: {
    action: "write",
    key: "order:write",
    resource: "order",
  },
} as const;

export const orderPermissionList = [
  orderPermissions.read,
  orderPermissions.write,
] as const;
