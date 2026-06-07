export interface AuthPermission {
  action: string;
  resource: string;
  scope?: string;
}

export type AuthPermissionKey = `${string}:${string}`;
export type AuthPermissionStatement = Readonly<
  Record<string, readonly string[]>
>;

export const createPermissionKey = (
  resource: string,
  action: string
): AuthPermissionKey => `${resource}:${action}`;

export const normalizePermission = (
  permission: AuthPermission | AuthPermissionKey
): AuthPermission => {
  if (typeof permission !== "string") {
    return permission;
  }

  const [resource, action, scope] = permission.split(":");

  if (!resource || !action) {
    throw new Error(`Invalid auth permission key "${permission}".`);
  }

  return {
    action,
    resource,
    ...(scope ? { scope } : {}),
  };
};

export const normalizePermissionKey = (
  permission: AuthPermission | AuthPermissionKey
): AuthPermissionKey => {
  if (typeof permission === "string") {
    normalizePermission(permission);
    return permission;
  }

  return createPermissionKey(permission.resource, permission.action);
};

export const isSupportedPermissionKey = (
  permission: string,
  statement: AuthPermissionStatement = {}
): permission is AuthPermissionKey => {
  let normalized: AuthPermission;

  try {
    normalized = normalizePermission(permission as AuthPermissionKey);
  } catch {
    return false;
  }

  return statement[normalized.resource]?.includes(normalized.action) ?? false;
};

export const assertSupportedPermission = (
  permission: AuthPermission | AuthPermissionKey,
  statement: AuthPermissionStatement = {}
): AuthPermissionKey => {
  const key = normalizePermissionKey(permission);

  if (!isSupportedPermissionKey(key, statement)) {
    throw new Error(`Unsupported auth permission "${key}".`);
  }

  return key;
};

export const emptyPermissionStatement =
  {} as const satisfies AuthPermissionStatement;
