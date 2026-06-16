export const checkoutPermissions = {
  execute: {
    action: "execute",
    key: "checkout:execute",
    resource: "checkout",
  },
  read: {
    action: "read",
    key: "checkout:read",
    resource: "checkout",
  },
} as const;

export const checkoutPermissionList = [
  checkoutPermissions.read,
  checkoutPermissions.execute,
] as const;
