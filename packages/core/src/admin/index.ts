export type AdminMetadataSourceType = "module" | "plugin";
export type AdminPluginTier = "native" | "sandbox";

export type AdminSurfaceKind =
  | "form"
  | "navigation"
  | "resource"
  | "table"
  | "widget";

export type HostRenderedAdminPrimitiveKind =
  | "action"
  | "form"
  | "link"
  | "stat"
  | "table";

export interface AdminPermissionDescriptor {
  readonly action: string;
  readonly key: `${string}:${string}`;
  readonly resource: string;
  readonly scope?: string;
}

export type AdminPermissionInput =
  | `${string}:${string}`
  | AdminPermissionDescriptor;

export interface AdminMetadataSource {
  readonly key: string;
  readonly label: string;
  readonly tier?: AdminPluginTier;
  readonly type: AdminMetadataSourceType;
}

export interface AdminOperationReference {
  readonly key: string;
  readonly label?: string;
  readonly permission?: AdminPermissionInput;
}

export interface AdminPrimitiveDescriptor {
  readonly key: string;
  readonly kind: HostRenderedAdminPrimitiveKind | string;
  readonly label?: string;
  readonly operation?: AdminOperationReference;
}

export interface AdminMetadataSurface {
  readonly description?: string;
  readonly key: string;
  readonly kind: AdminSurfaceKind;
  readonly label: string;
  readonly operations?: Readonly<Record<string, AdminOperationReference>>;
  readonly order?: number;
  readonly path?: string;
  readonly permission?: AdminPermissionInput;
  readonly primitive?: AdminPrimitiveDescriptor;
  readonly primitives?: readonly AdminPrimitiveDescriptor[];
  readonly title?: string;
}

export interface AdminMetadataContribution {
  readonly source: AdminMetadataSource;
  readonly surfaces: readonly AdminMetadataSurface[];
}

export interface NormalizedAdminSurface extends Omit<
  AdminMetadataSurface,
  "permission" | "primitive" | "primitives"
> {
  readonly id: string;
  readonly permission?: AdminPermissionDescriptor;
  readonly primitive?: AdminPrimitiveDescriptor;
  readonly primitives: readonly AdminPrimitiveDescriptor[];
  readonly source: AdminMetadataSource;
}

export interface AdminMetadataModel {
  readonly sources: readonly AdminMetadataSource[];
  readonly surfaces: readonly NormalizedAdminSurface[];
}

export interface ComposeAdminMetadataOptions {
  readonly contributions?: readonly AdminMetadataContribution[];
  readonly permissionValidator?: (
    permission: AdminPermissionDescriptor
  ) => void;
  readonly permissions?: readonly string[];
  readonly plugins?: readonly {
    readonly contributions: {
      readonly adminSurfaces?: readonly AdminMetadataSurface[];
    };
    readonly manifest: {
      readonly id: string;
      readonly tier: AdminPluginTier;
    };
    readonly state?: string;
  }[];
}

const supportedSandboxPrimitiveKinds = new Set<HostRenderedAdminPrimitiveKind>([
  "action",
  "form",
  "link",
  "stat",
  "table",
]);

const assertNonEmptyString = (value: string, label: string): void => {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
};

export const createAdminPermission = (
  resource: string,
  action: string,
  scope?: string
): AdminPermissionDescriptor => {
  assertNonEmptyString(resource, "Admin permission resource");
  assertNonEmptyString(action, "Admin permission action");

  return {
    action,
    key: `${resource}:${action}`,
    resource,
    ...(scope ? { scope } : {}),
  };
};

export const normalizeAdminPermission = (
  permission: AdminPermissionInput | undefined
): AdminPermissionDescriptor | undefined => {
  if (!permission) {
    return undefined;
  }

  if (typeof permission !== "string") {
    return permission;
  }

  const [resource, action] = permission.split(":");

  if (!resource || !action) {
    throw new Error(`Invalid admin permission key "${permission}".`);
  }

  return createAdminPermission(resource, action);
};

const assertValidOperationReference = (
  operation: AdminOperationReference,
  label: string,
  permissionValidator?: (permission: AdminPermissionDescriptor) => void
): void => {
  assertNonEmptyString(operation.key, label);

  const permission = normalizeAdminPermission(operation.permission);
  if (permission) {
    permissionValidator?.(permission);
  }
};

const getSurfacePrimitives = (
  surface: AdminMetadataSurface
): readonly AdminPrimitiveDescriptor[] => [
  ...(surface.primitive ? [surface.primitive] : []),
  ...(surface.primitives ?? []),
];

const assertValidPrimitive = (
  primitive: AdminPrimitiveDescriptor,
  source: AdminMetadataSource,
  permissionValidator?: (permission: AdminPermissionDescriptor) => void
): void => {
  assertNonEmptyString(primitive.key, "Admin primitive key");
  assertNonEmptyString(primitive.kind, "Admin primitive kind");

  if (
    source.tier === "sandbox" &&
    !supportedSandboxPrimitiveKinds.has(
      primitive.kind as HostRenderedAdminPrimitiveKind
    )
  ) {
    throw new Error(`Unsupported sandbox admin primitive "${primitive.kind}".`);
  }

  if (primitive.operation) {
    assertValidOperationReference(
      primitive.operation,
      "Admin primitive operation key",
      permissionValidator
    );
  }
};

const assertValidSurface = (
  surface: AdminMetadataSurface,
  source: AdminMetadataSource,
  permissionValidator?: (permission: AdminPermissionDescriptor) => void
): void => {
  assertNonEmptyString(surface.key, "Admin surface key");
  assertNonEmptyString(surface.label, "Admin surface label");
  const permission = normalizeAdminPermission(surface.permission);
  if (permission) {
    permissionValidator?.(permission);
  }

  for (const [operationName, operation] of Object.entries(
    surface.operations ?? {}
  )) {
    assertNonEmptyString(operationName, "Admin operation reference name");
    assertValidOperationReference(
      operation,
      "Admin operation reference key",
      permissionValidator
    );
  }

  for (const primitive of getSurfacePrimitives(surface)) {
    assertValidPrimitive(primitive, source, permissionValidator);
  }
};

export const defineAdminMetadataContribution = <
  const Contribution extends AdminMetadataContribution,
>(
  contribution: Contribution,
  options: {
    readonly permissionValidator?: (
      permission: AdminPermissionDescriptor
    ) => void;
  } = {}
): Contribution => {
  assertNonEmptyString(contribution.source.key, "Admin metadata source key");
  assertNonEmptyString(
    contribution.source.label,
    "Admin metadata source label"
  );

  for (const surface of contribution.surfaces) {
    assertValidSurface(
      surface,
      contribution.source,
      options.permissionValidator
    );
  }

  return contribution;
};

const toSurfaceId = (
  source: AdminMetadataSource,
  surface: AdminMetadataSurface
): string => `${source.type}:${source.key}:${surface.key}`;

const compareNormalizedSurfaces = (
  left: NormalizedAdminSurface,
  right: NormalizedAdminSurface
): number =>
  (left.order ?? 1000) - (right.order ?? 1000) ||
  left.label.localeCompare(right.label) ||
  left.id.localeCompare(right.id);

const insertSortedSurface = (
  surfaces: readonly NormalizedAdminSurface[],
  surface: NormalizedAdminSurface
): readonly NormalizedAdminSurface[] => {
  const nextSurfaces: NormalizedAdminSurface[] = [];
  let inserted = false;

  for (const existingSurface of surfaces) {
    if (!inserted && compareNormalizedSurfaces(surface, existingSurface) < 0) {
      nextSurfaces.push(surface);
      inserted = true;
    }

    nextSurfaces.push(existingSurface);
  }

  if (!inserted) {
    nextSurfaces.push(surface);
  }

  return nextSurfaces;
};

const toPluginContribution = (
  plugin: NonNullable<ComposeAdminMetadataOptions["plugins"]>[number],
  permissionValidator?: (permission: AdminPermissionDescriptor) => void
): AdminMetadataContribution | null => {
  if (plugin.state && plugin.state !== "active") {
    return null;
  }

  return defineAdminMetadataContribution(
    {
      source: {
        key: plugin.manifest.id,
        label: plugin.manifest.id,
        tier: plugin.manifest.tier,
        type: "plugin",
      },
      surfaces: plugin.contributions.adminSurfaces ?? [],
    },
    { permissionValidator }
  );
};

const canSeeSurface = (
  surface: NormalizedAdminSurface,
  permissions: ReadonlySet<string> | null
): boolean => {
  if (!surface.permission || permissions === null) {
    return true;
  }

  return permissions.has(surface.permission.key);
};

export const composeAdminMetadata = ({
  contributions = [],
  permissionValidator,
  permissions,
  plugins = [],
}: ComposeAdminMetadataOptions): AdminMetadataModel => {
  const allContributions = [
    ...contributions,
    ...plugins.flatMap((plugin) => {
      const contribution = toPluginContribution(plugin, permissionValidator);
      return contribution ? [contribution] : [];
    }),
  ];
  const seenSurfaces = new Map<string, string>();
  const normalizedSurfaces: NormalizedAdminSurface[] = [];

  for (const contribution of allContributions) {
    defineAdminMetadataContribution(contribution, { permissionValidator });

    for (const surface of contribution.surfaces) {
      const id = toSurfaceId(contribution.source, surface);
      const existingSource = seenSurfaces.get(id);

      if (existingSource) {
        throw new Error(
          `Duplicate admin surface ID "${id}" from "${existingSource}" conflicts with "${contribution.source.label}".`
        );
      }

      seenSurfaces.set(id, contribution.source.label);
      normalizedSurfaces.push({
        ...surface,
        id,
        permission: normalizeAdminPermission(surface.permission),
        primitives: getSurfacePrimitives(surface),
        source: contribution.source,
      });
    }
  }

  const permissionSet = permissions ? new Set(permissions) : null;
  let surfaces: readonly NormalizedAdminSurface[] = [];

  for (const surface of normalizedSurfaces) {
    if (canSeeSurface(surface, permissionSet)) {
      surfaces = insertSortedSurface(surfaces, surface);
    }
  }

  return {
    sources: allContributions.map((contribution) => contribution.source),
    surfaces,
  };
};
