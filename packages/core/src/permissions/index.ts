export type CommercePermissionKey = `${string}:${string}`;
export type CommercePermissionSourceType = "module" | "plugin";

export interface CommercePermissionDescriptor {
  readonly action: string;
  readonly description?: string;
  readonly key: CommercePermissionKey;
  readonly resource: string;
  readonly scope?: string;
}

export type CommercePermissionInput =
  | CommercePermissionDescriptor
  | CommercePermissionKey;

export interface CommercePermissionSource {
  readonly key: string;
  readonly type: CommercePermissionSourceType;
}

export interface CommercePermissionContribution {
  readonly permissions: readonly CommercePermissionDescriptor[];
  readonly source: CommercePermissionSource;
}

export type CommercePermissionStatement = Readonly<
  Record<string, readonly string[]>
>;

export interface CommercePermissionComposition {
  readonly permissions: readonly CommercePermissionDescriptor[];
  readonly sources: readonly CommercePermissionSource[];
  readonly statement: CommercePermissionStatement;
}

const assertNonEmptyString = (value: string, label: string): void => {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
};

const toPermissionKey = (
  resource: string,
  action: string
): CommercePermissionKey => `${resource}:${action}`;

export const createCommercePermission = ({
  action,
  description,
  resource,
  scope,
}: {
  readonly action: string;
  readonly description?: string;
  readonly resource: string;
  readonly scope?: string;
}): CommercePermissionDescriptor => {
  assertNonEmptyString(resource, "Commerce permission resource");
  assertNonEmptyString(action, "Commerce permission action");

  return {
    action,
    description,
    key: toPermissionKey(resource, action),
    resource,
    ...(scope ? { scope } : {}),
  };
};

export const normalizeCommercePermission = (
  permission: CommercePermissionInput
): CommercePermissionDescriptor => {
  if (typeof permission !== "string") {
    return createCommercePermission(permission);
  }

  const [resource, action, scope] = permission.split(":");

  if (!resource || !action) {
    throw new Error(`Invalid commerce permission key "${permission}".`);
  }

  return createCommercePermission({
    action,
    resource,
    scope,
  });
};

const comparePermissions = (
  left: CommercePermissionDescriptor,
  right: CommercePermissionDescriptor
): number =>
  left.resource.localeCompare(right.resource) ||
  left.action.localeCompare(right.action) ||
  left.key.localeCompare(right.key);

const appendSortedAction = (
  actions: readonly string[],
  action: string
): readonly string[] => {
  if (actions.includes(action)) {
    return actions;
  }

  const sortedActions: string[] = [];
  let inserted = false;

  for (const existingAction of actions) {
    if (!inserted && action.localeCompare(existingAction) < 0) {
      sortedActions.push(action);
      inserted = true;
    }

    sortedActions.push(existingAction);
  }

  if (!inserted) {
    sortedActions.push(action);
  }

  return sortedActions;
};

const appendSortedPermission = (
  permissions: readonly CommercePermissionDescriptor[],
  permission: CommercePermissionDescriptor
): readonly CommercePermissionDescriptor[] => {
  const sortedPermissions: CommercePermissionDescriptor[] = [];
  let inserted = false;

  for (const existingPermission of permissions) {
    if (!inserted && comparePermissions(permission, existingPermission) < 0) {
      sortedPermissions.push(permission);
      inserted = true;
    }

    sortedPermissions.push(existingPermission);
  }

  if (!inserted) {
    sortedPermissions.push(permission);
  }

  return sortedPermissions;
};

export const composeCommercePermissions = (
  contributions: readonly CommercePermissionContribution[]
): CommercePermissionComposition => {
  const permissionsByKey = new Map<string, CommercePermissionDescriptor>();
  const ownersByKey = new Map<string, CommercePermissionSource>();
  const statement: Record<string, readonly string[]> = {};

  for (const contribution of contributions) {
    assertNonEmptyString(
      contribution.source.key,
      "Commerce permission source key"
    );

    for (const permissionInput of contribution.permissions) {
      const permission = normalizeCommercePermission(permissionInput);
      const existingOwner = ownersByKey.get(permission.key);

      if (existingOwner && existingOwner.key !== contribution.source.key) {
        throw new Error(
          `Duplicate commerce permission "${permission.key}" from "${contribution.source.key}" conflicts with "${existingOwner.key}".`
        );
      }

      ownersByKey.set(permission.key, contribution.source);
      permissionsByKey.set(permission.key, permission);
      statement[permission.resource] = appendSortedAction(
        statement[permission.resource] ?? [],
        permission.action
      );
    }
  }

  const sourcesByKey = new Map<string, CommercePermissionSource>();
  let sortedPermissions: readonly CommercePermissionDescriptor[] = [];

  for (const source of ownersByKey.values()) {
    sourcesByKey.set(`${source.type}:${source.key}`, source);
  }

  for (const permission of permissionsByKey.values()) {
    sortedPermissions = appendSortedPermission(sortedPermissions, permission);
  }

  return {
    permissions: sortedPermissions,
    sources: [...sourcesByKey.values()],
    statement,
  };
};

export const createCommercePermissionValidator =
  (composition: CommercePermissionComposition) =>
  (permission: CommercePermissionInput): CommercePermissionKey => {
    const { key } = normalizeCommercePermission(permission);

    if (!composition.permissions.some((candidate) => candidate.key === key)) {
      throw new Error(`Unsupported commerce permission "${key}".`);
    }

    return key;
  };
