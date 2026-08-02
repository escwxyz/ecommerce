import { Schema } from "effect";

const pluginIdentifierPattern =
  /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*(?::[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*)*$/u;
const semanticVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const isPositiveInteger = (value: number): boolean =>
  Number.isInteger(value) && value > 0;

const hasUniqueEntrypointKeys = (
  entrypoints: readonly SandboxPluginEntrypoint[]
): boolean =>
  new Set(entrypoints.map((entrypoint) => entrypoint.key)).size ===
  entrypoints.length;

export const SandboxPluginTrimmedStringSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.makeFilter((value: string) => value.trim() === value))
);

export const SandboxPluginIdSchema = SandboxPluginTrimmedStringSchema.pipe(
  Schema.check(Schema.isPattern(pluginIdentifierPattern))
);

export const SandboxPluginVersionSchema = SandboxPluginTrimmedStringSchema.pipe(
  Schema.check(Schema.isPattern(semanticVersionPattern))
);

export const SandboxPluginSchemaVersionSchema = Schema.Number.pipe(
  Schema.check(Schema.makeFilter(isPositiveInteger))
);

export const SandboxBridgeCapabilitySchema = Schema.Literals([
  "bridge:events",
  "bridge:fetch",
  "bridge:log",
  "bridge:storage",
  "commerce:read",
  "commerce:write",
  "route:respond",
]);

export const SandboxBridgeCapabilityListSchema = Schema.Array(
  SandboxBridgeCapabilitySchema
);

export const SandboxPluginAllowedHostSchema = SandboxPluginTrimmedStringSchema;

export const SandboxPluginLifecycleStateSchema = Schema.Literals([
  "active",
  "failed",
  "inactive",
  "installed",
  "registered",
  "uninstalled",
  "uninstalling",
  "upgrade-pending",
]);

export const SandboxPluginEntrypointKindSchema = Schema.Literals([
  "adminMetadata",
  "hook",
  "lifecycle",
  "route",
  "workflowStep",
]);

export const SandboxBridgeOperationTypeSchema = Schema.Literals([
  "commerce",
  "emitEvent",
  "fetch",
  "log",
  "routeResponse",
  "storageRead",
  "storageWrite",
]);

export const CommercePluginStorageDeclarationSchema = Schema.Struct({
  description: Schema.optional(SandboxPluginTrimmedStringSchema),
  namespace: SandboxPluginTrimmedStringSchema,
});

export type CommercePluginStorageDeclaration =
  typeof CommercePluginStorageDeclarationSchema.Type;

export const CommercePluginExtensionPointSchema = Schema.Struct({
  name: SandboxPluginTrimmedStringSchema,
  type: Schema.Literals([
    "admin",
    "api",
    "hook",
    "provider",
    "storage",
    "workflow",
  ]),
});

export type CommercePluginExtensionPoint =
  typeof CommercePluginExtensionPointSchema.Type;

export const CommercePermissionKeySchema =
  SandboxPluginTrimmedStringSchema.pipe(
    Schema.check(
      Schema.makeFilter((value: string): boolean => value.includes(":"))
    )
  );

export const CommercePermissionDescriptorSchema = Schema.Struct({
  action: SandboxPluginTrimmedStringSchema,
  key: CommercePermissionKeySchema,
  resource: SandboxPluginTrimmedStringSchema,
  scope: Schema.optional(SandboxPluginTrimmedStringSchema),
});

export const CommercePermissionInputSchema = Schema.Union([
  CommercePermissionKeySchema,
  CommercePermissionDescriptorSchema,
]);

export const CommercePluginContributionSetSchema = Schema.Struct({
  adminSurfaces: Schema.optional(
    Schema.Array(SandboxPluginTrimmedStringSchema)
  ),
  extensionPoints: Schema.optional(
    Schema.Array(CommercePluginExtensionPointSchema)
  ),
  hooks: Schema.optional(Schema.Array(SandboxPluginTrimmedStringSchema)),
  permissionRequirements: Schema.optional(
    Schema.Array(CommercePermissionInputSchema)
  ),
  routes: Schema.optional(Schema.Array(SandboxPluginTrimmedStringSchema)),
  workflowSteps: Schema.optional(
    Schema.Array(SandboxPluginTrimmedStringSchema)
  ),
});

export type CommercePluginContributionSet =
  typeof CommercePluginContributionSetSchema.Type;

export const SandboxPluginBundleIntegritySchema = Schema.Struct({
  algorithm: Schema.Literal("sha256"),
  value: SandboxPluginTrimmedStringSchema,
});

export type SandboxPluginBundleIntegrity =
  typeof SandboxPluginBundleIntegritySchema.Type;

export const SandboxPluginBundleReferenceSchema = Schema.Struct({
  integrity: SandboxPluginBundleIntegritySchema,
  mainModule: SandboxPluginTrimmedStringSchema,
  modules: Schema.optional(
    Schema.Record(
      SandboxPluginTrimmedStringSchema,
      SandboxPluginTrimmedStringSchema
    )
  ),
  r2Key: SandboxPluginTrimmedStringSchema,
  version: SandboxPluginTrimmedStringSchema,
});

export type SandboxPluginBundleReference =
  typeof SandboxPluginBundleReferenceSchema.Type;

export const SandboxPluginEntrypointSchema = Schema.Struct({
  exportName: Schema.optional(SandboxPluginTrimmedStringSchema),
  key: SandboxPluginTrimmedStringSchema,
  kind: SandboxPluginEntrypointKindSchema,
});

export type SandboxPluginEntrypoint = typeof SandboxPluginEntrypointSchema.Type;

export const SandboxPluginEntrypointListSchema = Schema.Array(
  SandboxPluginEntrypointSchema
).pipe(
  Schema.check(
    Schema.makeFilter(
      (entrypoints: readonly SandboxPluginEntrypoint[]): boolean =>
        entrypoints.length > 0 && hasUniqueEntrypointKeys(entrypoints)
    )
  )
);

export const SandboxPluginLifecycleCompatibilitySchema = Schema.Struct({
  minHostVersion: Schema.optional(SandboxPluginVersionSchema),
  supportsUpgrade: Schema.optional(Schema.Boolean),
});

export type SandboxPluginLifecycleCompatibility =
  typeof SandboxPluginLifecycleCompatibilitySchema.Type;

/**
 * Versioned, serializable manifest for an isolated sandbox plugin.
 *
 * Host bridge grants and executable Worker Loader values stay outside this
 * manifest; every declared capability is a portable bridge identifier decoded
 * before the plugin can execute.
 */
export const SandboxPluginManifestSchema = Schema.Struct({
  allowedHosts: Schema.optional(Schema.Array(SandboxPluginAllowedHostSchema)),
  bundle: SandboxPluginBundleReferenceSchema,
  capabilities: SandboxBridgeCapabilityListSchema,
  contributions: Schema.optional(CommercePluginContributionSetSchema),
  entrypoints: SandboxPluginEntrypointListSchema,
  id: SandboxPluginIdSchema,
  lifecycleCompatibility: Schema.optional(
    SandboxPluginLifecycleCompatibilitySchema
  ),
  schemaVersion: SandboxPluginSchemaVersionSchema,
  storage: Schema.optional(
    Schema.Array(CommercePluginStorageDeclarationSchema)
  ),
  tier: Schema.Literal("sandbox"),
  version: SandboxPluginVersionSchema,
});

export type SandboxPluginManifest = typeof SandboxPluginManifestSchema.Type;
export type SandboxPluginManifestInput = Omit<
  typeof SandboxPluginManifestSchema.Encoded,
  "schemaVersion" | "tier"
> & {
  readonly schemaVersion?: number;
};

export const SandboxPluginRegistrationSchema = Schema.Struct({
  manifest: SandboxPluginManifestSchema,
  state: SandboxPluginLifecycleStateSchema,
});

export type SandboxPluginRegistration =
  typeof SandboxPluginRegistrationSchema.Type;

export const SandboxPluginGrantPolicySchema = Schema.Struct({
  canActivate: Schema.Boolean,
  deniedAllowedHosts: Schema.Array(SandboxPluginAllowedHostSchema),
  deniedCapabilities: SandboxBridgeCapabilityListSchema,
  deniedStorageNamespaces: Schema.Array(SandboxPluginTrimmedStringSchema),
  grantedAllowedHosts: Schema.Array(SandboxPluginAllowedHostSchema),
  grantedCapabilities: SandboxBridgeCapabilityListSchema,
  grantedStorageNamespaces: Schema.Array(SandboxPluginTrimmedStringSchema),
  pluginId: SandboxPluginIdSchema,
});

export type SandboxPluginGrantPolicy =
  typeof SandboxPluginGrantPolicySchema.Type;

export const SandboxBridgeAuthContextSchema = Schema.Struct({
  permissions: Schema.optional(Schema.Array(SandboxPluginTrimmedStringSchema)),
  sessionId: Schema.optional(SandboxPluginTrimmedStringSchema),
  userId: Schema.optional(SandboxPluginTrimmedStringSchema),
});

export type SandboxBridgeAuthContext =
  typeof SandboxBridgeAuthContextSchema.Type;

export const SandboxBridgeContextSchema = Schema.Struct({
  auth: Schema.optional(SandboxBridgeAuthContextSchema),
  correlationId: SandboxPluginTrimmedStringSchema,
  grantedAllowedHosts: Schema.Array(SandboxPluginAllowedHostSchema),
  grantedCapabilities: SandboxBridgeCapabilityListSchema,
  grantedStorageNamespaces: Schema.Array(SandboxPluginTrimmedStringSchema),
  lifecycleState: SandboxPluginLifecycleStateSchema,
  operationInput: Schema.optional(Schema.Unknown),
  pluginId: SandboxPluginIdSchema,
  pluginVersion: SandboxPluginVersionSchema,
  scopeId: Schema.optional(SandboxPluginTrimmedStringSchema),
  tenantId: SandboxPluginTrimmedStringSchema,
});

export type SandboxBridgeContext = typeof SandboxBridgeContextSchema.Type;

export const SandboxBridgePermissionCheckInputSchema = Schema.Struct({
  context: SandboxBridgeContextSchema,
  permission: SandboxPluginTrimmedStringSchema,
  resource: Schema.optional(SandboxPluginTrimmedStringSchema),
});

export type SandboxBridgePermissionCheckInput =
  typeof SandboxBridgePermissionCheckInputSchema.Type;

const operationCapabilityPairs = {
  commerce: ["commerce:read", "commerce:write"],
  emitEvent: ["bridge:events"],
  fetch: ["bridge:fetch"],
  log: ["bridge:log"],
  routeResponse: ["route:respond"],
  storageRead: ["bridge:storage"],
  storageWrite: ["bridge:storage"],
} as const;

export const SandboxBridgeOperationSchema = Schema.Struct({
  capability: SandboxBridgeCapabilitySchema,
  resource: Schema.optional(SandboxPluginTrimmedStringSchema),
  type: SandboxBridgeOperationTypeSchema,
}).pipe(
  Schema.check(
    Schema.makeFilter(
      (operation: {
        readonly capability: string;
        readonly type: keyof typeof operationCapabilityPairs;
      }): boolean => {
        for (const capability of operationCapabilityPairs[operation.type]) {
          if (capability === operation.capability) {
            return true;
          }
        }

        return false;
      }
    )
  )
);

export type SandboxBridgeOperation = typeof SandboxBridgeOperationSchema.Type;

export const SandboxAuditDecisionSchema = Schema.Literals(["allow", "deny"]);

export const SandboxAuditEventSchema = Schema.Struct({
  correlationId: SandboxPluginTrimmedStringSchema,
  decision: SandboxAuditDecisionSchema,
  entrypointKey: Schema.optional(SandboxPluginTrimmedStringSchema),
  lifecycleState: Schema.optional(SandboxPluginLifecycleStateSchema),
  operationType: SandboxPluginTrimmedStringSchema,
  pluginId: SandboxPluginIdSchema,
  reason: SandboxPluginTrimmedStringSchema,
  resource: Schema.optional(SandboxPluginTrimmedStringSchema),
  tenantId: SandboxPluginTrimmedStringSchema,
});

export type SandboxAuditEvent = typeof SandboxAuditEventSchema.Type;

export const SandboxPluginRuntimeErrorSchema = Schema.Struct({
  code: Schema.Literals([
    "capability-denied",
    "egress-denied",
    "invalid-auth-scope",
    "invalid-input",
    "invalid-response",
    "platform-capability-unavailable",
    "platform-execution-failed",
    "storage-denied",
  ]),
  correlationId: Schema.optional(SandboxPluginTrimmedStringSchema),
  message: SandboxPluginTrimmedStringSchema,
  pluginId: SandboxPluginIdSchema,
  reason: Schema.optional(SandboxPluginTrimmedStringSchema),
});

export type SandboxPluginRuntimeError =
  typeof SandboxPluginRuntimeErrorSchema.Type;

export const SandboxRouteResponseSchema = Schema.Struct({
  body: Schema.optional(Schema.Unknown),
  headers: Schema.optional(
    Schema.Record(
      SandboxPluginTrimmedStringSchema,
      SandboxPluginTrimmedStringSchema
    )
  ),
  status: Schema.Int.pipe(
    Schema.check(
      Schema.makeFilter(
        (value: number): boolean => value >= 100 && value <= 599
      )
    )
  ),
  type: Schema.Literal("routeResponse"),
});

export type SandboxRouteResponse = typeof SandboxRouteResponseSchema.Type;

export const SandboxHookResponseSchema = Schema.Struct({
  decision: Schema.Literals(["continue", "stop"]),
  output: Schema.optional(Schema.Unknown),
  type: Schema.Literal("hook"),
});

export type SandboxHookResponse = typeof SandboxHookResponseSchema.Type;

export const SandboxWorkflowStepResponseSchema = Schema.Struct({
  output: Schema.optional(Schema.Unknown),
  type: Schema.Literal("workflowStep"),
});

export type SandboxWorkflowStepResponse =
  typeof SandboxWorkflowStepResponseSchema.Type;

const AdminPermissionInputSchema = Schema.Union([
  CommercePermissionKeySchema,
  CommercePermissionDescriptorSchema,
]);

const AdminOperationReferenceSchema = Schema.Struct({
  key: SandboxPluginTrimmedStringSchema,
  label: Schema.optional(SandboxPluginTrimmedStringSchema),
  permission: Schema.optional(AdminPermissionInputSchema),
});

const AdminPrimitiveDescriptorSchema = Schema.Struct({
  key: SandboxPluginTrimmedStringSchema,
  kind: SandboxPluginTrimmedStringSchema,
  label: Schema.optional(SandboxPluginTrimmedStringSchema),
  operation: Schema.optional(AdminOperationReferenceSchema),
});

const AdminMetadataSurfaceSchema = Schema.Struct({
  description: Schema.optional(SandboxPluginTrimmedStringSchema),
  key: SandboxPluginTrimmedStringSchema,
  kind: Schema.Literals(["form", "navigation", "resource", "table", "widget"]),
  label: SandboxPluginTrimmedStringSchema,
  operations: Schema.optional(
    Schema.Record(
      SandboxPluginTrimmedStringSchema,
      AdminOperationReferenceSchema
    )
  ),
  order: Schema.optional(Schema.Number),
  path: Schema.optional(SandboxPluginTrimmedStringSchema),
  permission: Schema.optional(AdminPermissionInputSchema),
  primitive: Schema.optional(AdminPrimitiveDescriptorSchema),
  primitives: Schema.optional(Schema.Array(AdminPrimitiveDescriptorSchema)),
  title: Schema.optional(SandboxPluginTrimmedStringSchema),
});

export const SandboxAdminMetadataResponseSchema = Schema.Struct({
  surfaces: Schema.Array(AdminMetadataSurfaceSchema),
  type: Schema.Literal("adminMetadata"),
});

export type SandboxAdminMetadataResponse =
  typeof SandboxAdminMetadataResponseSchema.Type;

export const SandboxLifecycleResponseSchema = Schema.Struct({
  output: Schema.optional(Schema.Unknown),
  type: Schema.Literal("lifecycle"),
});

export type SandboxLifecycleResponse =
  typeof SandboxLifecycleResponseSchema.Type;

export const SandboxEntrypointResponseSchema = Schema.Union([
  SandboxAdminMetadataResponseSchema,
  SandboxHookResponseSchema,
  SandboxLifecycleResponseSchema,
  SandboxRouteResponseSchema,
  SandboxWorkflowStepResponseSchema,
]);

export type SandboxEntrypointResponse =
  typeof SandboxEntrypointResponseSchema.Type;

export const decodeSandboxPluginManifest = (
  input: unknown
): SandboxPluginManifest => {
  const manifest = Schema.decodeUnknownSync(SandboxPluginManifestSchema)(input);

  return {
    ...manifest,
    allowedHosts: manifest.allowedHosts?.toSorted((left, right) =>
      left.localeCompare(right)
    ),
    capabilities: manifest.capabilities.toSorted((left, right) =>
      left.localeCompare(right)
    ),
  };
};

export const createSandboxPluginManifest = (
  input: unknown
): SandboxPluginManifest =>
  decodeSandboxPluginManifest({
    ...(typeof input === "object" && input !== null ? input : {}),
    schemaVersion:
      typeof input === "object" &&
      input !== null &&
      "schemaVersion" in input &&
      typeof input.schemaVersion === "number"
        ? input.schemaVersion
        : 1,
    tier: "sandbox",
  });
