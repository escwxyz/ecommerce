import { Effect } from "effect";
import type { Effect as EffectType } from "effect/Effect";

import type { AdminPermissionDescriptor } from "../admin/index";
import { normalizeAdminPermission } from "../admin/index";
import type {
  CommerceAdminSurface,
  CommerceModuleApiFragment,
  CommerceModuleDefinition,
} from "../modules/index";
import {
  composeCommerceModules,
  getCommerceModulePermissionContributions,
} from "../modules/index";
import type {
  CommercePermissionComposition,
  CommercePermissionDescriptor,
  CommercePermissionInput,
} from "../permissions/index";
import {
  composeCommercePermissions,
  createCommercePermissionValidator,
} from "../permissions/index";
import type {
  CommerceWorkflowDefinition,
  CommerceWorkflowStep,
} from "../workflows/index";
import { createNativePluginManifest } from "./native-plugin-manifest";
import type {
  NativePluginManifest,
  NativePluginManifestInput,
} from "./native-plugin-manifest";

export {
  NativePluginCapabilityKeySchema,
  NativePluginCapabilityListSchema,
  NativePluginCapabilitySchema,
  NativePluginIdSchema,
  NativePluginManifestSchema,
  NativePluginSchemaVersionSchema,
  NativePluginTrimmedStringSchema,
  NativePluginVersionSchema,
  createNativePluginManifest,
  decodeNativePluginManifest,
  type NativePluginCapability,
  type NativePluginManifest,
  type NativePluginManifestInput,
} from "./native-plugin-manifest";

export type CommercePluginTier = "native" | "sandbox";

export type SandboxPluginEntrypointKind =
  | "adminMetadata"
  | "hook"
  | "lifecycle"
  | "route"
  | "workflowStep";

export type SandboxBridgeCapability =
  | "bridge:events"
  | "bridge:fetch"
  | "bridge:log"
  | "bridge:storage"
  | "commerce:read"
  | "commerce:write"
  | "route:respond";

export type SandboxBridgeOperationType =
  | "commerce"
  | "emitEvent"
  | "fetch"
  | "log"
  | "routeResponse"
  | "storageRead"
  | "storageWrite";

export type SandboxPluginLifecycleState =
  | "registered"
  | "installed"
  | "active"
  | "inactive"
  | "uninstalling"
  | "uninstalled"
  | "upgrade-pending"
  | "failed";

export type NativePluginLifecycleState =
  | "registered"
  | "installed"
  | "active"
  | "inactive"
  | "uninstalled";

export type NativePluginLifecycleEvent =
  | "register"
  | "install"
  | "activate"
  | "deactivate"
  | "uninstall"
  | "upgrade";

export interface CommercePluginStorageDeclaration {
  readonly namespace: string;
  readonly description?: string;
}

export interface SandboxPluginBundleIntegrity {
  readonly algorithm: "sha256";
  readonly value: string;
}

export interface SandboxPluginBundleReference {
  readonly version: string;
  readonly r2Key: string;
  readonly mainModule: string;
  readonly integrity: SandboxPluginBundleIntegrity;
  readonly modules?: Readonly<Record<string, string>>;
}

export interface SandboxPluginEntrypoint {
  readonly key: string;
  readonly kind: SandboxPluginEntrypointKind;
  readonly exportName?: string;
}

export interface CommercePluginProviderDescriptor<
  Implementation = unknown,
  Kind extends string = string,
> {
  readonly key: string;
  readonly contractKey: string;
  readonly kind: Kind;
  readonly label?: string;
  readonly implementation?: Implementation;
}

export interface CommercePluginExtensionPoint {
  readonly type: "api" | "hook" | "workflow" | "provider" | "admin" | "storage";
  readonly name: string;
}

export interface CommercePluginContributionSet {
  readonly extensionPoints?: readonly CommercePluginExtensionPoint[];
  readonly routes?: readonly string[];
  readonly hooks?: readonly string[];
  readonly workflowSteps?: readonly string[];
  readonly adminSurfaces?: readonly string[];
  readonly permissionRequirements?: readonly CommercePermissionInput[];
}

export interface CommercePluginManifest {
  readonly id: string;
  readonly version: string;
  readonly tier: CommercePluginTier;
  readonly capabilities: readonly string[];
  readonly allowedHosts?: readonly string[];
  readonly storage?: readonly CommercePluginStorageDeclaration[];
  readonly contributions?: CommercePluginContributionSet;
}

export interface SandboxPluginLifecycleCompatibility {
  readonly minHostVersion?: string;
  readonly supportsUpgrade?: boolean;
}

export interface SandboxPluginManifest extends Omit<
  CommercePluginManifest,
  "capabilities" | "tier"
> {
  readonly tier: "sandbox";
  readonly capabilities: readonly SandboxBridgeCapability[];
  readonly entrypoints: readonly SandboxPluginEntrypoint[];
  readonly bundle: SandboxPluginBundleReference;
  readonly lifecycleCompatibility?: SandboxPluginLifecycleCompatibility;
}

export interface SandboxPluginRegistration {
  readonly manifest: SandboxPluginManifest;
  readonly state: SandboxPluginLifecycleState;
}

export interface SandboxPluginGrantPolicy {
  readonly pluginId: string;
  readonly grantedCapabilities: readonly SandboxBridgeCapability[];
  readonly deniedCapabilities: readonly SandboxBridgeCapability[];
  readonly grantedAllowedHosts: readonly string[];
  readonly deniedAllowedHosts: readonly string[];
  readonly grantedStorageNamespaces: readonly string[];
  readonly deniedStorageNamespaces: readonly string[];
  readonly canActivate: boolean;
}

export interface SandboxBridgeAuthContext {
  readonly sessionId?: string;
  readonly userId?: string;
  readonly permissions?: readonly string[];
}

export interface SandboxBridgeContext {
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly tenantId: string;
  readonly scopeId?: string;
  readonly correlationId: string;
  readonly lifecycleState: SandboxPluginLifecycleState;
  readonly grantedCapabilities: readonly SandboxBridgeCapability[];
  readonly grantedAllowedHosts: readonly string[];
  readonly grantedStorageNamespaces: readonly string[];
  readonly auth?: SandboxBridgeAuthContext;
  readonly operationInput?: unknown;
}

export interface SandboxBridgePermissionCheckInput {
  readonly context: SandboxBridgeContext;
  readonly permission: string;
  readonly resource?: string;
}

export interface SandboxBridgeOperation {
  readonly type: SandboxBridgeOperationType;
  readonly capability: SandboxBridgeCapability;
  readonly resource?: string;
}

export type SandboxAuditDecision = "allow" | "deny";

export interface SandboxAuditEvent {
  readonly pluginId: string;
  readonly operationType: string;
  readonly decision: SandboxAuditDecision;
  readonly reason: string;
  readonly correlationId: string;
  readonly tenantId: string;
  readonly lifecycleState?: SandboxPluginLifecycleState;
  readonly entrypointKey?: string;
  readonly resource?: string;
}

export interface SandboxPluginRuntimeError {
  readonly code:
    | "capability-denied"
    | "egress-denied"
    | "invalid-auth-scope"
    | "invalid-input"
    | "invalid-response"
    | "platform-capability-unavailable"
    | "platform-execution-failed"
    | "storage-denied";
  readonly message: string;
  readonly pluginId: string;
  readonly correlationId?: string;
  readonly reason?: string;
}

export interface SandboxRouteResponse {
  readonly type: "routeResponse";
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

export interface SandboxHookResponse {
  readonly type: "hook";
  readonly decision: "continue" | "stop";
  readonly output?: unknown;
}

export interface SandboxWorkflowStepResponse {
  readonly type: "workflowStep";
  readonly output?: unknown;
}

export interface SandboxAdminMetadataResponse {
  readonly type: "adminMetadata";
  readonly surfaces: readonly CommerceAdminSurface[];
}

export interface SandboxLifecycleResponse {
  readonly type: "lifecycle";
  readonly output?: unknown;
}

export type SandboxEntrypointResponse =
  | SandboxAdminMetadataResponse
  | SandboxHookResponse
  | SandboxLifecycleResponse
  | SandboxRouteResponse
  | SandboxWorkflowStepResponse;

const supportedSandboxCapabilities = new Set<SandboxBridgeCapability>([
  "bridge:events",
  "bridge:fetch",
  "bridge:log",
  "bridge:storage",
  "commerce:read",
  "commerce:write",
  "route:respond",
]);

export interface NativePluginLifecycleContext {
  readonly pluginId: string;
  readonly event: NativePluginLifecycleEvent;
  readonly fromState: NativePluginLifecycleState;
  readonly toState: NativePluginLifecycleState;
  readonly fromVersion?: string;
  readonly toVersion?: string;
}

export type NativePluginLifecycleHook<Error = never, Requirements = never> = (
  context: NativePluginLifecycleContext
) => EffectType<void, Error, Requirements>;

export interface NativePluginLifecycle<Error = never, Requirements = never> {
  readonly onRegister?: NativePluginLifecycleHook<Error, Requirements>;
  readonly onInstall?: NativePluginLifecycleHook<Error, Requirements>;
  readonly onActivate?: NativePluginLifecycleHook<Error, Requirements>;
  readonly onDeactivate?: NativePluginLifecycleHook<Error, Requirements>;
  readonly onUninstall?: NativePluginLifecycleHook<Error, Requirements>;
  readonly onUpgrade?: NativePluginLifecycleHook<Error, Requirements>;
}

export interface NativePluginContributions {
  readonly modules?: readonly CommerceModuleDefinition[];
  readonly permissions?: readonly CommercePermissionDescriptor[];
  readonly apiFragments?: readonly CommerceModuleApiFragment[];
  readonly providers?: readonly CommercePluginProviderDescriptor[];
  readonly lifecycleHooks?: readonly string[];
  readonly workflowSteps?: readonly CommerceWorkflowStep[];
  readonly workflows?: readonly CommerceWorkflowDefinition[];
  readonly adminSurfaces?: readonly CommerceAdminSurface[];
  readonly storage?: readonly CommercePluginStorageDeclaration[];
}

export interface CommercePluginRegistration {
  readonly manifest: CommercePluginManifest;
  readonly modules?: readonly string[];
}

export interface NativePluginRegistration<
  Contributions extends NativePluginContributions = NativePluginContributions,
> {
  readonly manifest: NativePluginManifest;
  readonly contributions: Contributions;
  readonly lifecycle?: NativePluginLifecycle;
  readonly state: NativePluginLifecycleState;
}

export interface NativePluginComposition {
  readonly plugins: readonly NativePluginRegistration[];
  readonly activePlugins: readonly NativePluginRegistration[];
  readonly modules: readonly CommerceModuleDefinition[];
  readonly moduleGraph: ReturnType<typeof composeCommerceModules>;
  readonly permissions: CommercePermissionComposition;
  readonly apiFragments: readonly CommerceModuleApiFragment[];
  readonly providers: readonly CommercePluginProviderDescriptor[];
  readonly workflowSteps: readonly CommerceWorkflowStep[];
  readonly workflows: readonly CommerceWorkflowDefinition[];
  readonly adminSurfaces: readonly CommerceAdminSurface[];
  readonly storage: readonly CommercePluginStorageDeclaration[];
}

export interface NativePluginCompositionOptions {
  readonly permissionValidator?: (
    permission: AdminPermissionDescriptor
  ) => void;
}

export interface NativePluginLifecycleTransitionInput {
  readonly event: NativePluginLifecycleEvent;
  readonly from: NativePluginLifecycleState;
}

export interface NativePluginLifecycleTransition {
  readonly hook: keyof NativePluginLifecycle;
  readonly to: NativePluginLifecycleState;
}

/**
 * Defines a trusted plugin only after its serializable manifest decodes.
 *
 * Executable contributions remain separate from the manifest so platform
 * resources can be supplied later through portable Effect requirements.
 */
export const defineNativePlugin = <
  const Contributions extends NativePluginContributions =
    NativePluginContributions,
>(registration: {
  readonly contributions?: Contributions;
  readonly lifecycle?: NativePluginLifecycle;
  readonly manifest: NativePluginManifestInput;
  readonly modules?: readonly string[];
  readonly state?: NativePluginLifecycleState;
}): NativePluginRegistration<Contributions> => ({
  ...registration,
  contributions: (registration.contributions ?? {}) as Contributions,
  manifest: createNativePluginManifest(registration.manifest),
  state: registration.state ?? "active",
});

const assertNonEmptyString = (value: string, label: string): void => {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
};

const toUniqueSorted = <Value extends string>(
  values: readonly Value[]
): readonly Value[] => {
  let sortedValues: readonly Value[] = [];

  for (const value of new Set(values)) {
    const nextValues: Value[] = [];
    let inserted = false;

    for (const existingValue of sortedValues) {
      if (!inserted && value.localeCompare(existingValue) < 0) {
        nextValues.push(value);
        inserted = true;
      }

      nextValues.push(existingValue);
    }

    if (!inserted) {
      nextValues.push(value);
    }

    sortedValues = nextValues;
  }

  return sortedValues;
};

export const normalizeSandboxAllowedHost = (host: string): string => {
  const trimmed = host.trim().toLowerCase();

  if (trimmed.length === 0) {
    throw new Error("Sandbox plugin allowed host must be a non-empty string.");
  }

  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
      .hostname;
  } catch {
    throw new Error(`Invalid sandbox plugin allowed host "${host}".`);
  }
};

const assertSupportedSandboxCapabilities = (
  capabilities: readonly SandboxBridgeCapability[]
): void => {
  for (const capability of capabilities) {
    if (!supportedSandboxCapabilities.has(capability)) {
      throw new Error(`Unsupported sandbox plugin capability "${capability}".`);
    }
  }
};

const assertValidContributionSet = (
  contributions: CommercePluginContributionSet | undefined,
  permissionValidator?: (permission: CommercePermissionInput) => void
): void => {
  if (!contributions) {
    return;
  }

  for (const extensionPoint of contributions.extensionPoints ?? []) {
    assertNonEmptyString(extensionPoint.name, "Sandbox extension point name");
  }

  for (const route of contributions.routes ?? []) {
    assertNonEmptyString(route, "Sandbox route contribution");
  }

  for (const hook of contributions.hooks ?? []) {
    assertNonEmptyString(hook, "Sandbox hook contribution");
  }

  for (const workflowStep of contributions.workflowSteps ?? []) {
    assertNonEmptyString(workflowStep, "Sandbox workflow step contribution");
  }

  for (const adminSurface of contributions.adminSurfaces ?? []) {
    assertNonEmptyString(adminSurface, "Sandbox admin surface contribution");
  }

  for (const permission of contributions.permissionRequirements ?? []) {
    permissionValidator?.(permission);
  }
};

const assertValidSandboxBundle = (
  bundle: SandboxPluginBundleReference
): void => {
  assertNonEmptyString(bundle.version, "Sandbox plugin bundle version");
  assertNonEmptyString(bundle.r2Key, "Sandbox plugin bundle R2 key");
  assertNonEmptyString(bundle.mainModule, "Sandbox plugin bundle main module");

  if (bundle.integrity.algorithm !== "sha256") {
    throw new Error(
      `Unsupported sandbox plugin bundle integrity algorithm "${bundle.integrity.algorithm}".`
    );
  }

  assertNonEmptyString(
    bundle.integrity.value,
    "Sandbox plugin bundle integrity value"
  );
};

const assertValidSandboxEntrypoints = (
  entrypoints: readonly SandboxPluginEntrypoint[]
): void => {
  if (entrypoints.length === 0) {
    throw new Error(
      "Sandbox plugin manifest must declare at least one entrypoint."
    );
  }

  const entrypointKeys = new Set<string>();

  for (const entrypoint of entrypoints) {
    assertNonEmptyString(entrypoint.key, "Sandbox plugin entrypoint key");

    if (entrypointKeys.has(entrypoint.key)) {
      throw new Error(
        `Duplicate sandbox plugin entrypoint key "${entrypoint.key}".`
      );
    }

    entrypointKeys.add(entrypoint.key);
  }
};

export const defineSandboxPlugin = (registration: {
  readonly manifest: Omit<SandboxPluginManifest, "tier">;
  readonly permissionValidator?: (permission: CommercePermissionInput) => void;
  readonly state?: SandboxPluginLifecycleState;
}): SandboxPluginRegistration => {
  const manifest: SandboxPluginManifest = {
    ...registration.manifest,
    allowedHosts: toUniqueSorted(
      (registration.manifest.allowedHosts ?? []).map(
        normalizeSandboxAllowedHost
      )
    ),
    capabilities: toUniqueSorted(registration.manifest.capabilities),
    storage: registration.manifest.storage
      ? [...registration.manifest.storage]
      : undefined,
    tier: "sandbox",
  };

  assertNonEmptyString(manifest.id, "Sandbox plugin ID");
  assertNonEmptyString(manifest.version, "Sandbox plugin version");
  assertSupportedSandboxCapabilities(manifest.capabilities);
  assertValidSandboxBundle(manifest.bundle);
  assertValidSandboxEntrypoints(manifest.entrypoints);
  assertValidContributionSet(
    manifest.contributions,
    registration.permissionValidator
  );

  for (const storage of manifest.storage ?? []) {
    assertNonEmptyString(storage.namespace, "Sandbox storage namespace");
  }

  return {
    manifest,
    state: registration.state ?? "registered",
  };
};

export const createSandboxPluginGrantPolicy = ({
  manifest,
  grantedCapabilities,
  grantedAllowedHosts = manifest.allowedHosts ?? [],
  grantedStorageNamespaces = (manifest.storage ?? []).map(
    (storage) => storage.namespace
  ),
}: {
  readonly manifest: SandboxPluginManifest;
  readonly grantedCapabilities: readonly SandboxBridgeCapability[];
  readonly grantedAllowedHosts?: readonly string[];
  readonly grantedStorageNamespaces?: readonly string[];
}): SandboxPluginGrantPolicy => {
  assertSupportedSandboxCapabilities(grantedCapabilities);

  const requestedCapabilities = new Set(manifest.capabilities);
  const normalizedGrantedHosts = toUniqueSorted(
    grantedAllowedHosts.map(normalizeSandboxAllowedHost)
  );
  const requestedHosts = new Set(manifest.allowedHosts);
  const requestedStorageNamespaces = new Set(
    (manifest.storage ?? []).map((storage) => storage.namespace)
  );

  const acceptedCapabilities = toUniqueSorted(
    grantedCapabilities.filter((capability) =>
      requestedCapabilities.has(capability)
    )
  );
  const deniedCapabilities = toUniqueSorted(
    manifest.capabilities.filter(
      (capability) => !acceptedCapabilities.includes(capability)
    )
  );
  const acceptedHosts = toUniqueSorted(
    normalizedGrantedHosts.filter((host) => requestedHosts.has(host))
  );
  const deniedHosts = toUniqueSorted(
    (manifest.allowedHosts ?? []).filter(
      (host) => !acceptedHosts.includes(host)
    )
  );
  const acceptedStorage = toUniqueSorted(
    grantedStorageNamespaces.filter((namespace) =>
      requestedStorageNamespaces.has(namespace)
    )
  );
  const deniedStorage = toUniqueSorted(
    [...requestedStorageNamespaces].filter(
      (namespace) => !acceptedStorage.includes(namespace)
    )
  );

  return {
    canActivate:
      deniedCapabilities.length === 0 &&
      deniedHosts.length === 0 &&
      deniedStorage.length === 0,
    deniedAllowedHosts: deniedHosts,
    deniedCapabilities,
    deniedStorageNamespaces: deniedStorage,
    grantedAllowedHosts: acceptedHosts,
    grantedCapabilities: acceptedCapabilities,
    grantedStorageNamespaces: acceptedStorage,
    pluginId: manifest.id,
  };
};

export const createSandboxRuntimeError = (
  error: SandboxPluginRuntimeError
): SandboxPluginRuntimeError => error;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isSandboxEntrypointResponse = (
  value: unknown
): value is SandboxEntrypointResponse => {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "adminMetadata": {
      return Array.isArray(value.surfaces);
    }
    case "hook": {
      return value.decision === "continue" || value.decision === "stop";
    }
    case "lifecycle":
    case "workflowStep": {
      return true;
    }
    case "routeResponse": {
      return (
        typeof value.status === "number" &&
        Number.isInteger(value.status) &&
        value.status >= 100 &&
        value.status <= 599
      );
    }
    default: {
      return false;
    }
  }
};

export const assertSandboxBridgeCapability = (
  context: SandboxBridgeContext,
  operation: SandboxBridgeOperation
): SandboxAuditEvent | null => {
  if (context.grantedCapabilities.includes(operation.capability)) {
    return null;
  }

  return {
    correlationId: context.correlationId,
    decision: "deny",
    lifecycleState: context.lifecycleState,
    operationType: operation.type,
    pluginId: context.pluginId,
    reason: `Capability "${operation.capability}" is not granted.`,
    resource: operation.resource,
    tenantId: context.tenantId,
  };
};

const assertUniqueValue = ({
  errorLabel,
  ownerLabel,
  seen,
  value,
}: {
  readonly errorLabel: string;
  readonly ownerLabel: string;
  readonly seen: Map<string, string>;
  readonly value: string;
}): void => {
  const existingOwner = seen.get(value);

  if (existingOwner) {
    throw new Error(
      `Duplicate native plugin ${errorLabel} "${value}" from "${ownerLabel}" conflicts with "${existingOwner}".`
    );
  }

  seen.set(value, ownerLabel);
};

const collectActiveContributions = <Contribution>(
  plugins: readonly NativePluginRegistration[],
  getContributions: (
    plugin: NativePluginRegistration
  ) => readonly Contribution[] | undefined
): Contribution[] => {
  const contributions: Contribution[] = [];

  for (const plugin of plugins) {
    contributions.push(...(getContributions(plugin) ?? []));
  }

  return contributions;
};

export const composeNativePlugins = <
  const Plugins extends readonly NativePluginRegistration[],
>(
  plugins: Plugins,
  options: NativePluginCompositionOptions = {}
): NativePluginComposition => {
  const pluginIds = new Map<string, string>();

  for (const plugin of plugins) {
    assertUniqueValue({
      errorLabel: "ID",
      ownerLabel: plugin.manifest.id,
      seen: pluginIds,
      value: plugin.manifest.id,
    });
  }

  const activePlugins = plugins.filter((plugin) => plugin.state === "active");
  const modules = collectActiveContributions(
    activePlugins,
    (plugin) => plugin.contributions.modules
  );
  const moduleGraph = composeCommerceModules(modules);
  const permissions = composeCommercePermissions([
    ...getCommerceModulePermissionContributions(modules),
    ...activePlugins.map((plugin) => ({
      permissions: plugin.contributions.permissions ?? [],
      source: {
        key: plugin.manifest.id,
        type: "plugin" as const,
      },
    })),
  ]);
  const composedPermissionValidator =
    createCommercePermissionValidator(permissions);
  const adminPermissionValidator =
    options.permissionValidator ?? composedPermissionValidator;
  const adminSurfaceKeys = new Map<string, string>();

  for (const plugin of activePlugins) {
    for (const surface of plugin.contributions.adminSurfaces ?? []) {
      const permission = normalizeAdminPermission(surface.permission);
      if (permission) {
        adminPermissionValidator(permission);
      }

      assertUniqueValue({
        errorLabel: "admin surface key",
        ownerLabel: plugin.manifest.id,
        seen: adminSurfaceKeys,
        value: surface.key,
      });
    }
  }

  return {
    activePlugins,
    adminSurfaces: collectActiveContributions(
      activePlugins,
      (plugin) => plugin.contributions.adminSurfaces
    ),
    apiFragments: collectActiveContributions(
      activePlugins,
      (plugin) => plugin.contributions.apiFragments
    ),
    moduleGraph,
    modules,
    permissions,
    plugins,
    providers: collectActiveContributions(
      activePlugins,
      (plugin) => plugin.contributions.providers
    ),
    storage: collectActiveContributions(
      activePlugins,
      (plugin) => plugin.contributions.storage
    ),
    workflowSteps: collectActiveContributions(
      activePlugins,
      (plugin) => plugin.contributions.workflowSteps
    ),
    workflows: collectActiveContributions(
      activePlugins,
      (plugin) => plugin.contributions.workflows
    ),
  };
};

type NativePluginLifecycleTransitionTable = Record<
  NativePluginLifecycleEvent,
  Partial<Record<NativePluginLifecycleState, NativePluginLifecycleTransition>>
>;

const lifecycleTransitions: NativePluginLifecycleTransitionTable = {
  activate: {
    installed: {
      hook: "onActivate",
      to: "active",
    },
    inactive: {
      hook: "onActivate",
      to: "active",
    },
  },
  deactivate: {
    active: {
      hook: "onDeactivate",
      to: "inactive",
    },
  },
  install: {
    registered: {
      hook: "onInstall",
      to: "installed",
    },
  },
  register: {
    registered: {
      hook: "onRegister",
      to: "registered",
    },
  },
  uninstall: {
    inactive: {
      hook: "onUninstall",
      to: "uninstalled",
    },
    installed: {
      hook: "onUninstall",
      to: "uninstalled",
    },
  },
  upgrade: {
    active: {
      hook: "onUpgrade",
      to: "active",
    },
    inactive: {
      hook: "onUpgrade",
      to: "inactive",
    },
    installed: {
      hook: "onUpgrade",
      to: "installed",
    },
  },
};

export const getNativePluginLifecycleTransition = ({
  event,
  from,
}: NativePluginLifecycleTransitionInput): NativePluginLifecycleTransition => {
  const transition = lifecycleTransitions[event][from];

  if (!transition) {
    throw new Error(
      `Invalid native plugin lifecycle transition "${event}" from "${from}".`
    );
  }

  return transition;
};

export interface RunNativePluginLifecycleHookInput {
  readonly event: NativePluginLifecycleEvent;
  readonly fromState: NativePluginLifecycleState;
  readonly fromVersion?: string;
  readonly toVersion?: string;
}

export const runNativePluginLifecycleHook = <
  Error = never,
  Requirements = never,
>(
  plugin: NativePluginRegistration,
  input: RunNativePluginLifecycleHookInput
): EffectType<void, Error, Requirements> => {
  const transition = getNativePluginLifecycleTransition({
    event: input.event,
    from: input.fromState,
  });
  const hook = plugin.lifecycle?.[transition.hook] as
    | NativePluginLifecycleHook<Error, Requirements>
    | undefined;

  if (!hook) {
    return Effect.void as EffectType<void, Error, Requirements>;
  }

  return hook({
    event: input.event,
    fromState: input.fromState,
    fromVersion: input.fromVersion,
    pluginId: plugin.manifest.id,
    toState: transition.to,
    toVersion: input.toVersion,
  });
};
