import {
  assertSandboxBridgeCapability,
  createSandboxPluginGrantPolicy,
  createSandboxRuntimeError,
  isSandboxEntrypointResponse,
  normalizeCommercePermission,
  normalizeSandboxAllowedHost,
} from "@ecommerce/core";
import type {
  CommercePermissionInput,
  SandboxAuditEvent,
  SandboxBridgeCapability,
  SandboxBridgeContext,
  SandboxBridgePermissionCheckInput,
  SandboxEntrypointResponse,
  SandboxPluginBundleReference,
  SandboxPluginGrantPolicy,
  SandboxPluginLifecycleState,
  SandboxPluginManifest,
  SandboxPluginRuntimeError,
} from "@ecommerce/core";

export interface CloudflareWorkerCode {
  readonly compatibilityDate: string;
  readonly mainModule: string;
  readonly modules: Readonly<Record<string, string>>;
  readonly globalOutbound: null | {
    readonly allowedHosts: readonly string[];
  };
}

export interface CloudflareDynamicWorkerEntrypoint {
  fetch(request: Request, env?: unknown): Promise<Response | unknown>;
}

export interface CloudflareDynamicWorkerStub {
  getEntrypoint(name?: string): CloudflareDynamicWorkerEntrypoint;
}

export interface CloudflareWorkerLoaderBinding {
  load(code: CloudflareWorkerCode): CloudflareDynamicWorkerStub;
  get(
    id: string,
    getCode: () => Promise<CloudflareWorkerCode>
  ): CloudflareDynamicWorkerStub;
}

export interface SandboxPluginRunnerInput {
  readonly manifest: SandboxPluginManifest;
  readonly policy: SandboxPluginGrantPolicy;
  readonly entrypointKey: string;
  readonly request?: Request;
  readonly bridgeContext: SandboxBridgeContext;
  readonly compatibilityDate: string;
  readonly useCache?: boolean;
}

export interface SandboxPluginRunnerResult {
  readonly response: SandboxEntrypointResponse;
  readonly cacheId: string;
  readonly auditEvents: readonly SandboxAuditEvent[];
}

export interface SandboxPluginRunner {
  invoke(input: SandboxPluginRunnerInput): Promise<SandboxPluginRunnerResult>;
}

export interface CreateSandboxPluginRunnerOptions {
  readonly loader?: CloudflareWorkerLoaderBinding;
  readonly audit?: SandboxAuditSink;
}

export interface SandboxAuditSink {
  emit(event: SandboxAuditEvent): void | Promise<void>;
}

export interface SandboxPluginBundleObjectReference {
  readonly bucket: string;
  readonly key: string;
  readonly version: string;
  readonly integrity: SandboxPluginBundleReference["integrity"];
  readonly contentType?: string;
}

export interface SandboxPluginMetadataRecord {
  readonly pluginId: string;
  readonly version: string;
  readonly state: SandboxPluginLifecycleState;
  readonly manifest: SandboxPluginManifest;
  readonly activeBundle: SandboxPluginBundleObjectReference;
  readonly grantedPolicy: SandboxPluginGrantPolicy;
  readonly storageNamespaces: readonly string[];
  readonly updatedAt: string;
}

export interface SandboxPluginMetadataStore {
  get(pluginId: string): Promise<SandboxPluginMetadataRecord | null>;
  upsert(record: SandboxPluginMetadataRecord): Promise<void>;
  list(): Promise<readonly SandboxPluginMetadataRecord[]>;
}

export interface SandboxPluginAuditIndexRecord {
  readonly pluginId: string;
  readonly correlationId: string;
  readonly operationType: string;
  readonly decision: SandboxAuditEvent["decision"];
  readonly reason: string;
  readonly tenantId: string;
  readonly createdAt: string;
}

export interface SandboxPluginLifecycleTransitionContext {
  readonly pluginId: string;
  readonly fromState: SandboxPluginLifecycleState;
  readonly toState: SandboxPluginLifecycleState;
  readonly fromVersion?: string;
  readonly toVersion?: string;
}

export interface ActivateSandboxPluginInput {
  readonly manifest: SandboxPluginManifest;
  readonly bundle: SandboxPluginBundleObjectReference;
  readonly grantedCapabilities: readonly SandboxBridgeCapability[];
  readonly grantedAllowedHosts?: readonly string[];
  readonly grantedStorageNamespaces?: readonly string[];
  readonly workerLoaderAvailable: boolean;
  readonly now: Date;
}

export interface ActivatedSandboxPlugin {
  readonly record: SandboxPluginMetadataRecord;
  readonly auditEvents: readonly SandboxAuditEvent[];
}

export interface SandboxPluginDispatchComposition {
  readonly activePlugins: readonly SandboxPluginMetadataRecord[];
  readonly routeKeys: readonly string[];
  readonly hookKeys: readonly string[];
  readonly workflowStepKeys: readonly string[];
  readonly adminSurfaceKeys: readonly string[];
}

export interface CreateSandboxPluginUpgradeInput {
  readonly current: SandboxPluginMetadataRecord;
  readonly nextManifest: SandboxPluginManifest;
  readonly nextBundle: SandboxPluginBundleObjectReference;
  readonly now: Date;
}

export interface SandboxPluginUpgradePlan {
  readonly transition: SandboxPluginLifecycleTransitionContext;
  readonly pendingRecord: SandboxPluginMetadataRecord;
}

export interface SandboxStoragePort {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
}

export interface SandboxBridge {
  log(level: "debug" | "error" | "info" | "warn", message: string): void;
  emitEvent(name: string, payload: unknown): Promise<void>;
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  storageRead(namespace: string, key: string): Promise<unknown>;
  storageWrite(namespace: string, key: string, value: unknown): Promise<void>;
  commerceAction(action: string, input: unknown): Promise<unknown>;
  routeResponse(response: SandboxEntrypointResponse): SandboxEntrypointResponse;
}

export interface CreateSandboxBridgeOptions {
  readonly context: SandboxBridgeContext;
  readonly audit?: SandboxAuditSink;
  readonly storage?: SandboxStoragePort;
  readonly fetcher?: (
    input: string | URL | Request,
    init?: RequestInit
  ) => Promise<Response>;
  readonly commerceActions?: Readonly<
    Record<string, (input: unknown) => Promise<unknown>>
  >;
  readonly commerceActionPermissions?: Readonly<
    Record<string, CommercePermissionInput>
  >;
  readonly permissionValidator?: (permission: CommercePermissionInput) => void;
  readonly authorizeCommerceAction?: (
    input: SandboxBridgePermissionCheckInput
  ) => boolean | Promise<boolean>;
  readonly eventSink?: (name: string, payload: unknown) => Promise<void>;
}

export const createSandboxPluginCacheId = ({
  manifest,
  entrypointKey,
}: {
  readonly manifest: SandboxPluginManifest;
  readonly entrypointKey: string;
}): string =>
  [
    "sandbox-plugin",
    manifest.id,
    manifest.version,
    manifest.bundle.version,
    manifest.bundle.integrity.value,
    entrypointKey,
  ].join(":");

const emitAudit = async (
  sink: SandboxAuditSink | undefined,
  event: SandboxAuditEvent
) => {
  await sink?.emit(event);
};

const createAuditEvent = ({
  context,
  operationType,
  decision,
  reason,
  resource,
  entrypointKey,
}: {
  readonly context: SandboxBridgeContext;
  readonly operationType: string;
  readonly decision: SandboxAuditEvent["decision"];
  readonly reason: string;
  readonly resource?: string;
  readonly entrypointKey?: string;
}): SandboxAuditEvent => ({
  correlationId: context.correlationId,
  decision,
  entrypointKey,
  lifecycleState: context.lifecycleState,
  operationType,
  pluginId: context.pluginId,
  reason,
  resource,
  tenantId: context.tenantId,
});

const requireCapability = async ({
  context,
  operationType,
  capability,
  resource,
  audit,
}: {
  readonly context: SandboxBridgeContext;
  readonly operationType: string;
  readonly capability: SandboxBridgeCapability;
  readonly resource?: string;
  readonly audit?: SandboxAuditSink;
}): Promise<SandboxAuditEvent | null> => {
  const denial = assertSandboxBridgeCapability(context, {
    capability,
    resource,
    type: operationType as never,
  });

  if (denial) {
    await emitAudit(audit, denial);
    return denial;
  }

  await emitAudit(
    audit,
    createAuditEvent({
      context,
      decision: "allow",
      operationType,
      reason: `Capability "${capability}" granted.`,
      resource,
    })
  );
  return null;
};

const scopedStorageKey = ({
  context,
  namespace,
  key,
}: {
  readonly context: SandboxBridgeContext;
  readonly namespace: string;
  readonly key: string;
}): string =>
  [
    context.tenantId,
    context.pluginId,
    context.pluginVersion,
    namespace,
    key,
  ].join(":");

const assertStorageNamespace = async ({
  context,
  namespace,
  audit,
}: {
  readonly context: SandboxBridgeContext;
  readonly namespace: string;
  readonly audit?: SandboxAuditSink;
}): Promise<void> => {
  if (context.grantedStorageNamespaces.includes(namespace)) {
    return;
  }

  const event = createAuditEvent({
    context,
    decision: "deny",
    operationType: "storage",
    reason: `Storage namespace "${namespace}" is not granted.`,
    resource: namespace,
  });
  await emitAudit(audit, event);
  throw createSandboxRuntimeError({
    code: "storage-denied",
    message: event.reason,
    pluginId: context.pluginId,
    correlationId: context.correlationId,
    reason: namespace,
  });
};

export const isSandboxOutboundHostAllowed = (
  context: SandboxBridgeContext,
  input: string | URL | Request
): boolean => {
  let url: URL;

  if (input instanceof Request) {
    url = new URL(input.url);
  } else if (input instanceof URL) {
    url = input;
  } else {
    url = new URL(input);
  }

  const host = normalizeSandboxAllowedHost(url.hostname);

  return context.grantedAllowedHosts.includes(host);
};

export const createInMemorySandboxStorage = (): SandboxStoragePort & {
  readonly records: Map<string, unknown>;
} => {
  const records = new Map<string, unknown>();

  return {
    records,
    get: (key: string) => Promise.resolve(records.get(key)),
    put: (key: string, value: unknown) => {
      records.set(key, value);
      return Promise.resolve();
    },
  };
};

export const createInMemorySandboxPluginMetadataStore =
  (): SandboxPluginMetadataStore & {
    readonly records: Map<string, SandboxPluginMetadataRecord>;
  } => {
    const records = new Map<string, SandboxPluginMetadataRecord>();

    return {
      records,
      get: (pluginId: string) => Promise.resolve(records.get(pluginId) ?? null),
      list: () => Promise.resolve([...records.values()]),
      upsert: (record: SandboxPluginMetadataRecord) => {
        records.set(record.pluginId, record);
        return Promise.resolve();
      },
    };
  };

export const createSandboxBridge = ({
  context,
  audit,
  storage,
  fetcher = fetch,
  commerceActions = {},
  commerceActionPermissions = {},
  permissionValidator,
  authorizeCommerceAction,
  eventSink,
}: CreateSandboxBridgeOptions): SandboxBridge => {
  for (const permission of Object.values(commerceActionPermissions)) {
    permissionValidator?.(permission);
  }

  return {
    commerceAction: async (action: string, input: unknown) => {
      const denial = await requireCapability({
        audit,
        capability: "commerce:read",
        context,
        operationType: "commerce",
        resource: action,
      });

      if (denial) {
        throw createSandboxRuntimeError({
          code: "capability-denied",
          message: denial.reason,
          pluginId: context.pluginId,
          correlationId: context.correlationId,
          reason: action,
        });
      }

      const requiredPermissionInput = commerceActionPermissions[action];
      const requiredPermission = requiredPermissionInput
        ? normalizeCommercePermission(requiredPermissionInput).key
        : undefined;

      if (requiredPermission) {
        const allowed =
          authorizeCommerceAction?.({
            context,
            permission: requiredPermission,
            resource: action,
          }) ?? false;

        if (!(await allowed)) {
          const event = createAuditEvent({
            context,
            decision: "deny",
            operationType: "commerce",
            reason: `Permission "${requiredPermission}" is not granted.`,
            resource: action,
          });
          await emitAudit(audit, event);
          throw createSandboxRuntimeError({
            code: "invalid-auth-scope",
            message: event.reason,
            pluginId: context.pluginId,
            correlationId: context.correlationId,
            reason: requiredPermission,
          });
        }
      }

      const handler = commerceActions[action];

      if (!handler) {
        throw createSandboxRuntimeError({
          code: "invalid-input",
          message: `Unsupported sandbox commerce action "${action}".`,
          pluginId: context.pluginId,
          correlationId: context.correlationId,
          reason: action,
        });
      }

      return handler(input);
    },
    emitEvent: async (name: string, payload: unknown) => {
      const denial = await requireCapability({
        audit,
        capability: "bridge:events",
        context,
        operationType: "emitEvent",
        resource: name,
      });

      if (denial) {
        throw createSandboxRuntimeError({
          code: "capability-denied",
          message: denial.reason,
          pluginId: context.pluginId,
          correlationId: context.correlationId,
          reason: name,
        });
      }

      await eventSink?.(name, payload);
    },
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const denial = await requireCapability({
        audit,
        capability: "bridge:fetch",
        context,
        operationType: "fetch",
      });

      if (denial) {
        throw createSandboxRuntimeError({
          code: "capability-denied",
          message: denial.reason,
          pluginId: context.pluginId,
          correlationId: context.correlationId,
        });
      }

      if (!isSandboxOutboundHostAllowed(context, input)) {
        const event = createAuditEvent({
          context,
          decision: "deny",
          operationType: "fetch",
          reason: "Outbound host is not granted.",
          resource: input instanceof Request ? input.url : String(input),
        });
        await emitAudit(audit, event);
        throw createSandboxRuntimeError({
          code: "egress-denied",
          message: event.reason,
          pluginId: context.pluginId,
          correlationId: context.correlationId,
          reason: event.resource,
        });
      }

      return fetcher(input, init);
    },
    log: (level: "debug" | "error" | "info" | "warn", message: string) => {
      void emitAudit(
        audit,
        createAuditEvent({
          context,
          decision: "allow",
          operationType: "log",
          reason: `${level}:${message}`,
        })
      );
    },
    routeResponse: (response: SandboxEntrypointResponse) => {
      if (!isSandboxEntrypointResponse(response)) {
        throw createSandboxRuntimeError({
          code: "invalid-response",
          message: "Sandbox route response shape is invalid.",
          pluginId: context.pluginId,
          correlationId: context.correlationId,
        });
      }

      return response;
    },
    storageRead: async (namespace: string, key: string) => {
      const denial = await requireCapability({
        audit,
        capability: "bridge:storage",
        context,
        operationType: "storageRead",
        resource: namespace,
      });

      if (denial) {
        throw createSandboxRuntimeError({
          code: "capability-denied",
          message: denial.reason,
          pluginId: context.pluginId,
          correlationId: context.correlationId,
          reason: namespace,
        });
      }

      await assertStorageNamespace({ audit, context, namespace });
      return storage?.get(scopedStorageKey({ context, key, namespace }));
    },
    storageWrite: async (namespace: string, key: string, value: unknown) => {
      const denial = await requireCapability({
        audit,
        capability: "bridge:storage",
        context,
        operationType: "storageWrite",
        resource: namespace,
      });

      if (denial) {
        throw createSandboxRuntimeError({
          code: "capability-denied",
          message: denial.reason,
          pluginId: context.pluginId,
          correlationId: context.correlationId,
          reason: namespace,
        });
      }

      await assertStorageNamespace({ audit, context, namespace });
      await storage?.put(scopedStorageKey({ context, key, namespace }), value);
    },
  };
};

const createWorkerCode = (
  manifest: SandboxPluginManifest,
  policy: SandboxPluginGrantPolicy,
  compatibilityDate: string
): CloudflareWorkerCode => ({
  compatibilityDate,
  globalOutbound:
    policy.grantedAllowedHosts.length === 0
      ? null
      : {
          allowedHosts: policy.grantedAllowedHosts,
        },
  mainModule: manifest.bundle.mainModule,
  modules: manifest.bundle.modules ?? {
    [manifest.bundle.mainModule]:
      "export default { fetch() { return Response.json({ type: 'hook', decision: 'continue' }); } };",
  },
});

const parseEntrypointResponse = async (
  value: Response | unknown,
  pluginId: string,
  correlationId: string
): Promise<SandboxEntrypointResponse> => {
  const candidate = value instanceof Response ? await value.json() : value;

  if (!isSandboxEntrypointResponse(candidate)) {
    throw createSandboxRuntimeError({
      code: "invalid-response",
      message: "Sandbox entrypoint returned an invalid response shape.",
      pluginId,
      correlationId,
    });
  }

  return candidate;
};

export const createCloudflareSandboxPluginRunner = ({
  loader,
  audit,
}: CreateSandboxPluginRunnerOptions): SandboxPluginRunner => ({
  invoke: async (input: SandboxPluginRunnerInput) => {
    if (!loader) {
      throw createSandboxRuntimeError({
        code: "platform-capability-unavailable",
        message: "Cloudflare Worker Loader binding is required.",
        pluginId: input.manifest.id,
        correlationId: input.bridgeContext.correlationId,
      });
    }

    const entrypoint = input.manifest.entrypoints.find(
      (candidate) => candidate.key === input.entrypointKey
    );

    if (!entrypoint) {
      throw createSandboxRuntimeError({
        code: "invalid-input",
        message: `Sandbox entrypoint "${input.entrypointKey}" is not declared.`,
        pluginId: input.manifest.id,
        correlationId: input.bridgeContext.correlationId,
      });
    }

    const cacheId = createSandboxPluginCacheId({
      entrypointKey: input.entrypointKey,
      manifest: input.manifest,
    });
    const code = () =>
      Promise.resolve(
        createWorkerCode(input.manifest, input.policy, input.compatibilityDate)
      );
    const worker = input.useCache
      ? loader.get(cacheId, code)
      : loader.load(await code());
    const workerEntrypoint = worker.getEntrypoint(entrypoint.exportName);
    const events: SandboxAuditEvent[] = [];
    const auditSink: SandboxAuditSink = {
      emit: (event) => {
        events.push(event);
        return audit?.emit(event);
      },
    };
    const bridge = createSandboxBridge({
      audit: auditSink,
      context: input.bridgeContext,
    });

    await emitAudit(
      auditSink,
      createAuditEvent({
        context: input.bridgeContext,
        decision: "allow",
        entrypointKey: input.entrypointKey,
        operationType: "invoke",
        reason: "Sandbox plugin invocation started.",
      })
    );

    try {
      const response = await parseEntrypointResponse(
        await workerEntrypoint.fetch(
          input.request ??
            new Request("https://sandbox-plugin.internal/entrypoint", {
              method: "POST",
            }),
          {
            bridge,
            context: input.bridgeContext,
          }
        ),
        input.manifest.id,
        input.bridgeContext.correlationId
      );

      return {
        auditEvents: events,
        cacheId,
        response,
      };
    } catch (error) {
      const runtimeError = createSandboxRuntimeError({
        code:
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "string"
            ? (error.code as SandboxPluginRuntimeError["code"])
            : "platform-execution-failed",
        message:
          error instanceof Error
            ? error.message
            : "Sandbox plugin execution failed.",
        pluginId: input.manifest.id,
        correlationId: input.bridgeContext.correlationId,
      });

      await emitAudit(
        auditSink,
        createAuditEvent({
          context: input.bridgeContext,
          decision: "deny",
          entrypointKey: input.entrypointKey,
          operationType: "invoke",
          reason: runtimeError.message,
        })
      );
      throw runtimeError;
    }
  },
});

export const activateSandboxPlugin = ({
  manifest,
  bundle,
  grantedCapabilities,
  grantedAllowedHosts,
  grantedStorageNamespaces,
  workerLoaderAvailable,
  now,
}: ActivateSandboxPluginInput): ActivatedSandboxPlugin => {
  if (!workerLoaderAvailable) {
    throw createSandboxRuntimeError({
      code: "platform-capability-unavailable",
      message: "Cloudflare Worker Loader binding is required.",
      pluginId: manifest.id,
    });
  }

  if (
    bundle.integrity.algorithm !== manifest.bundle.integrity.algorithm ||
    bundle.integrity.value !== manifest.bundle.integrity.value
  ) {
    throw createSandboxRuntimeError({
      code: "invalid-input",
      message: "Sandbox plugin bundle integrity does not match manifest.",
      pluginId: manifest.id,
    });
  }

  const grantedPolicy = createSandboxPluginGrantPolicy({
    grantedAllowedHosts,
    grantedCapabilities,
    grantedStorageNamespaces,
    manifest,
  });

  if (!grantedPolicy.canActivate) {
    throw createSandboxRuntimeError({
      code: "capability-denied",
      message: "Sandbox plugin activation policy denies requested access.",
      pluginId: manifest.id,
    });
  }

  const record: SandboxPluginMetadataRecord = {
    activeBundle: bundle,
    grantedPolicy,
    manifest,
    pluginId: manifest.id,
    state: "active",
    storageNamespaces: grantedPolicy.grantedStorageNamespaces,
    updatedAt: now.toISOString(),
    version: manifest.version,
  };

  return {
    auditEvents: [
      {
        correlationId: `activate:${manifest.id}:${manifest.version}`,
        decision: "allow",
        lifecycleState: "active",
        operationType: "lifecycle",
        pluginId: manifest.id,
        reason: "Sandbox plugin activated.",
        tenantId: "platform",
      },
    ],
    record,
  };
};

export const filterActiveSandboxPlugins = <
  Plugin extends { readonly state: SandboxPluginLifecycleState },
>(
  plugins: readonly Plugin[]
): readonly Plugin[] => plugins.filter((plugin) => plugin.state === "active");

const assertUniqueContributionKeys = ({
  keys,
  label,
}: {
  readonly keys: readonly string[];
  readonly label: string;
}) => {
  const seen = new Map<string, string>();

  for (const key of keys) {
    const owner = seen.get(key);

    if (owner) {
      throw new Error(
        `Duplicate sandbox plugin ${label} "${key}" conflicts with "${owner}".`
      );
    }

    seen.set(key, key);
  }
};

export const composeSandboxPluginDispatch = (
  records: readonly SandboxPluginMetadataRecord[]
): SandboxPluginDispatchComposition => {
  const activePlugins = filterActiveSandboxPlugins(records);
  const routeKeys = activePlugins.flatMap(
    (record) => record.manifest.contributions?.routes ?? []
  );
  const hookKeys = activePlugins.flatMap(
    (record) => record.manifest.contributions?.hooks ?? []
  );
  const workflowStepKeys = activePlugins.flatMap(
    (record) => record.manifest.contributions?.workflowSteps ?? []
  );
  const adminSurfaceKeys = activePlugins.flatMap(
    (record) => record.manifest.contributions?.adminSurfaces ?? []
  );

  assertUniqueContributionKeys({ keys: routeKeys, label: "route key" });
  assertUniqueContributionKeys({
    keys: adminSurfaceKeys,
    label: "admin surface key",
  });

  return {
    activePlugins,
    adminSurfaceKeys,
    hookKeys,
    routeKeys,
    workflowStepKeys,
  };
};

export const createSandboxPluginUpgradePlan = ({
  current,
  nextManifest,
  nextBundle,
  now,
}: CreateSandboxPluginUpgradeInput): SandboxPluginUpgradePlan => ({
  pendingRecord: {
    ...current,
    activeBundle: nextBundle,
    manifest: nextManifest,
    state: "upgrade-pending",
    updatedAt: now.toISOString(),
    version: nextManifest.version,
  },
  transition: {
    fromState: current.state,
    fromVersion: current.version,
    pluginId: current.pluginId,
    toState: "upgrade-pending",
    toVersion: nextManifest.version,
  },
});
