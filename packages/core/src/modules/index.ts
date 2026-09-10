import * as Cause from "effect/Cause";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import type { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import type { AdminMetadataSurface, AdminSurfaceKind } from "../admin/index";
import {
  CyclicModuleDependencyError,
  DuplicateModuleError,
  MissingModuleDependencyError,
} from "../errors/index";
import type { CommerceEventEnvelope } from "../events/index";
import type {
  CommercePermissionComposition,
  CommercePermissionContribution,
  CommercePermissionDescriptor,
} from "../permissions/index";
import { composeCommercePermissions } from "../permissions/index";
import type { CommercePluginContributionSet } from "../plugins/index";
import { withOperationTelemetry } from "../telemetry/index";
import type {
  CommerceWorkflowDefinition,
  CommerceWorkflowStep,
} from "../workflows/index";
import { CommerceModuleCompositionError } from "./commerce-module-composition-error";
import { CommerceModuleLifecycleError } from "./commerce-module-lifecycle-error";

export {
  CommerceModuleCompositionError,
  type CommerceModuleCompositionErrorDetail,
} from "./commerce-module-composition-error";
export { CommerceModuleLifecycleError } from "./commerce-module-lifecycle-error";

export type CommerceModuleKey = string;
export type CommerceAdminSurfaceKind = AdminSurfaceKind;
export type CommerceAdminSurface = AdminMetadataSurface;
export type CommerceModuleHttpSurface = "admin" | "storefront";
export type CommerceModuleLifecyclePhase =
  | "bootstrap"
  | "register"
  | "shutdown";

const MODULE_SHUTDOWN_TIMEOUT = "30 seconds";

export type CommerceModuleLifecycleHook<
  Error = never,
  Requirements = never,
> = Effect.Effect<void, Error, Requirements>;

export interface CommerceModuleLifecycle<Error = never, Requirements = never> {
  readonly onRegister?: CommerceModuleLifecycleHook<Error, Requirements>;
  readonly onBootstrap?: CommerceModuleLifecycleHook<Error, Requirements>;
  readonly onShutdown?: CommerceModuleLifecycleHook<Error, Requirements>;
}

export type CommerceModuleExecutableContributionKind =
  | "ApiGroup"
  | "EventHandler"
  | "Provider"
  | "Service"
  | "Workflow";

/** Covariant marker used to retain heterogeneous executable contributions. */
export interface CommerceModuleExecutableContribution<
  Kind extends CommerceModuleExecutableContributionKind =
    CommerceModuleExecutableContributionKind,
> {
  readonly _tag: Kind;
  readonly key: string;
}

/** A portable service tag paired with the Layer that implements it. */
export interface CommerceModuleServiceContribution<
  Identifier = unknown,
  Service = unknown,
  LayerError = never,
  Requirements = never,
> extends CommerceModuleExecutableContribution<"Service"> {
  readonly layer: Layer.Layer<Identifier, LayerError, Requirements>;
  readonly service: Context.Key<Identifier, Service>;
}

/** A provider contract paired with its runtime-neutral implementation Layer. */
export interface CommerceModuleProviderContribution<
  Identifier = unknown,
  Provider = unknown,
  LayerError = never,
  Requirements = never,
> extends CommerceModuleExecutableContribution<"Provider"> {
  readonly contractKey: string;
  readonly kind: string;
  readonly label?: string;
  readonly layer: Layer.Layer<Identifier, LayerError, Requirements>;
  readonly provider: Context.Key<Identifier, Provider>;
}

export type CommerceModuleApiHandlerLayer =
  | Layer.Layer<HttpApiGroup.ApiGroup<string, string>, never, unknown>
  | Layer.Layer<never, never, unknown>;

/** Effect HTTP contract and handlers owned by a built-in module. */
export interface CommerceModuleApiGroupContribution<
  Surface extends CommerceModuleHttpSurface = CommerceModuleHttpSurface,
  Group extends HttpApiGroup.Any = HttpApiGroup.Any,
  Handlers extends CommerceModuleApiHandlerLayer =
    CommerceModuleApiHandlerLayer,
> extends CommerceModuleExecutableContribution<"ApiGroup"> {
  readonly group: Group;
  readonly handlers: Handlers;
  readonly owner: "module";
  readonly surface: Surface;
}

/** Executable workflow and the Layer satisfying its portable requirements. */
export interface CommerceModuleWorkflowContribution<
  Input = unknown,
  Output = unknown,
  WorkflowError = never,
  WorkflowRequirements = never,
  LayerError = never,
  Requirements = never,
> extends CommerceModuleExecutableContribution<"Workflow"> {
  readonly layer: Layer.Layer<WorkflowRequirements, LayerError, Requirements>;
  readonly workflow: CommerceWorkflowDefinition<
    Input,
    Output,
    WorkflowError,
    WorkflowRequirements
  >;
}

/** Effect-native event handler enabled and disabled with its owning module. */
export interface CommerceModuleEventHandlerContribution<
  EventName extends string = string,
  Payload = unknown,
  HandlerError = never,
  HandlerRequirements = never,
  LayerError = never,
  Requirements = never,
> extends CommerceModuleExecutableContribution<"EventHandler"> {
  readonly eventName: EventName;
  readonly handler: (
    event: CommerceEventEnvelope<EventName, Payload>
  ) => Effect.Effect<void, HandlerError, HandlerRequirements>;
  readonly layer: Layer.Layer<HandlerRequirements, LayerError, Requirements>;
}

export interface CommerceModuleContributions {
  readonly adminSurfaces?: readonly CommerceAdminSurface[];
  readonly apiGroups?: readonly CommerceModuleExecutableContribution<"ApiGroup">[];
  readonly eventHandlers?: readonly CommerceModuleExecutableContribution<"EventHandler">[];
  readonly eventTypes?: readonly string[];
  readonly permissions?: readonly CommercePermissionDescriptor[];
  readonly pluginContributions?: CommercePluginContributionSet;
  readonly providers?: readonly CommerceModuleExecutableContribution<"Provider">[];
  readonly services?: readonly CommerceModuleExecutableContribution<"Service">[];
  readonly workflowSteps?: readonly CommerceWorkflowStep[];
  readonly workflows?: readonly (
    | CommerceModuleExecutableContribution<"Workflow">
    | CommerceWorkflowDefinition
  )[];
}

export interface CommerceModuleSchemaContribution {
  readonly storageNamespaces?: readonly string[];
  readonly tables?: readonly string[];
}

export interface CommerceModuleDefinition<
  Key extends CommerceModuleKey = CommerceModuleKey,
  Dependencies extends readonly CommerceModuleKey[] =
    readonly CommerceModuleKey[],
  Contributions extends CommerceModuleContributions =
    CommerceModuleContributions,
  LifecycleError = unknown,
  LifecycleRequirements = unknown,
> {
  readonly contributions?: Contributions;
  readonly dependencies?: Dependencies;
  readonly key: Key;
  readonly lifecycle?: CommerceModuleLifecycle<
    LifecycleError,
    LifecycleRequirements
  >;
  readonly schema?: CommerceModuleSchemaContribution;
}

export type ModuleKeyUnion<
  Modules extends readonly CommerceModuleDefinition[],
> = Modules[number]["key"];

export type MissingDependencyKeys<
  Modules extends readonly CommerceModuleDefinition[],
> = Exclude<
  Modules[number]["dependencies"] extends readonly string[]
    ? Modules[number]["dependencies"][number]
    : never,
  ModuleKeyUnion<Modules>
>;

export type ValidateModuleDependencies<
  Modules extends readonly CommerceModuleDefinition[],
> = [MissingDependencyKeys<Modules>] extends [never] ? true : false;

export interface CommerceModuleGraph<
  Modules extends readonly CommerceModuleDefinition[] =
    readonly CommerceModuleDefinition[],
> {
  readonly byKey: ReadonlyMap<CommerceModuleKey, CommerceModuleDefinition>;
  readonly modules: Modules;
  readonly orderedKeys: readonly CommerceModuleKey[];
  readonly permissions: CommercePermissionComposition;
}

type RuntimeLayerContribution = CommerceModuleExecutableContribution & {
  readonly layer: Layer.Layer<unknown, unknown, unknown>;
};

type ModuleContributionsOf<Module> =
  Module extends CommerceModuleDefinition<
    string,
    readonly string[],
    infer Contributions,
    unknown,
    unknown
  >
    ? Contributions
    : never;

type ContributionValues<
  Modules,
  Key extends keyof CommerceModuleContributions,
> = Modules extends readonly (infer Module)[]
  ? Module extends CommerceModuleDefinition
    ? Key extends keyof ModuleContributionsOf<Module>
      ? NonNullable<
          ModuleContributionsOf<Module>[Key]
        > extends readonly (infer Value)[]
        ? Value
        : never
      : never
    : never
  : never;

type ContributionLayer<Contribution> = Contribution extends {
  readonly layer: infer ServiceLayer;
}
  ? ServiceLayer
  : never;

type LayerOutput<ServiceLayer> =
  ServiceLayer extends Layer.Layer<
    infer Output,
    infer _Failure,
    infer _Requirements
  >
    ? Output
    : never;

type LayerFailure<ServiceLayer> =
  ServiceLayer extends Layer.Layer<
    infer _Output,
    infer Failure,
    infer _Requirements
  >
    ? Failure
    : never;

type LayerRequirements<ServiceLayer> =
  ServiceLayer extends Layer.Layer<
    infer _Output,
    infer _Failure,
    infer Requirements
  >
    ? Requirements
    : never;

type ExecutableLayer<Modules> = ContributionLayer<
  | ContributionValues<Modules, "eventHandlers">
  | ContributionValues<Modules, "providers">
  | ContributionValues<Modules, "services">
  | ContributionValues<Modules, "workflows">
>;

type ModuleLifecycleRequirements<Modules> =
  Modules extends readonly (infer Module)[]
    ? Module extends CommerceModuleDefinition<
        string,
        readonly string[],
        CommerceModuleContributions,
        unknown,
        infer Requirements
      >
      ? Requirements
      : never
    : never;

export interface CommerceModuleLifecycleController<Requirements = never> {
  readonly shutdown: Effect.Effect<
    void,
    CommerceModuleLifecycleError,
    Requirements
  >;
  readonly start: Effect.Effect<
    void,
    CommerceModuleLifecycleError,
    Requirements
  >;
}

export interface CommerceApplicationComposition<
  Modules extends readonly CommerceModuleDefinition[],
> extends CommerceModuleGraph<Modules> {
  readonly adminSurfaces: readonly CommerceAdminSurface[];
  readonly apiGroups: readonly CommerceModuleApiGroupContribution[];
  readonly applicationLayer: Layer.Layer<
    LayerOutput<ExecutableLayer<Modules>>,
    CommerceModuleLifecycleError | LayerFailure<ExecutableLayer<Modules>>,
    Exclude<
      | LayerRequirements<ExecutableLayer<Modules>>
      | ModuleLifecycleRequirements<Modules>,
      LayerOutput<ExecutableLayer<Modules>>
    >
  >;
  readonly eventHandlers: readonly CommerceModuleEventHandlerContribution[];
  readonly eventTypes: readonly string[];
  readonly lifecycle: CommerceModuleLifecycleController<
    ModuleLifecycleRequirements<Modules>
  >;
  readonly providers: readonly CommerceModuleProviderContribution[];
  readonly schema: readonly {
    readonly moduleKey: CommerceModuleKey;
    readonly storageNamespaces: readonly string[];
    readonly tables: readonly string[];
  }[];
  readonly services: readonly CommerceModuleServiceContribution[];
  readonly workflowSteps: readonly CommerceWorkflowStep[];
  readonly workflows: readonly (
    | CommerceModuleWorkflowContribution
    | CommerceWorkflowDefinition
  )[];
}

/** Preserves the service tag and Layer requirements of a module contribution. */
export const defineCommerceModuleServiceContribution = <
  Identifier,
  Service,
  LayerError,
  Requirements,
>(
  contribution: Omit<
    CommerceModuleServiceContribution<
      Identifier,
      Service,
      LayerError,
      Requirements
    >,
    "_tag"
  >
): CommerceModuleServiceContribution<
  Identifier,
  Service,
  LayerError,
  Requirements
> => ({ ...contribution, _tag: "Service" });

/** Adds built-in module ownership while preserving Effect HTTP inference. */
export const defineCommerceModuleApiGroupContribution = <
  const Contribution extends Omit<
    CommerceModuleApiGroupContribution,
    "_tag" | "owner"
  >,
>(
  contribution: Contribution
): Contribution & { readonly _tag: "ApiGroup"; readonly owner: "module" } => ({
  ...contribution,
  _tag: "ApiGroup",
  owner: "module",
});

/** Preserves provider Layer inference for a module definition. */
export const defineCommerceModuleProviderContribution = <
  Identifier,
  Provider,
  LayerError,
  Requirements,
>(
  contribution: Omit<
    CommerceModuleProviderContribution<
      Identifier,
      Provider,
      LayerError,
      Requirements
    >,
    "_tag"
  >
): CommerceModuleProviderContribution<
  Identifier,
  Provider,
  LayerError,
  Requirements
> => ({ ...contribution, _tag: "Provider" });

/** Preserves executable workflow Layer inference for a module definition. */
export const defineCommerceModuleWorkflowContribution = <
  Input,
  Output,
  WorkflowError,
  WorkflowRequirements,
  LayerError,
  Requirements,
>(
  contribution: Omit<
    CommerceModuleWorkflowContribution<
      Input,
      Output,
      WorkflowError,
      WorkflowRequirements,
      LayerError,
      Requirements
    >,
    "_tag"
  >
): CommerceModuleWorkflowContribution<
  Input,
  Output,
  WorkflowError,
  WorkflowRequirements,
  LayerError,
  Requirements
> => ({ ...contribution, _tag: "Workflow" });

/** Preserves executable event-handler Layer inference for a module definition. */
export const defineCommerceModuleEventHandlerContribution = <
  const EventName extends string,
  Payload,
  HandlerError,
  HandlerRequirements,
  LayerError,
  Requirements,
>(
  contribution: Omit<
    CommerceModuleEventHandlerContribution<
      EventName,
      Payload,
      HandlerError,
      HandlerRequirements,
      LayerError,
      Requirements
    >,
    "_tag"
  >
): CommerceModuleEventHandlerContribution<
  EventName,
  Payload,
  HandlerError,
  HandlerRequirements,
  LayerError,
  Requirements
> => ({ ...contribution, _tag: "EventHandler" });

type ContributionListIsExecutable<
  Contributions,
  Key extends keyof CommerceModuleContributions,
  Executable,
> = Key extends keyof Contributions
  ? NonNullable<Contributions[Key]> extends readonly (infer Value)[]
    ? Value extends Executable
      ? unknown
      : never
    : never
  : unknown;

type ValidateExecutableModuleContributions<Contributions> =
  CommerceModuleContributions extends Contributions
    ? unknown
    : ContributionListIsExecutable<
        Contributions,
        "apiGroups",
        { readonly group: object; readonly handlers: object }
      > &
        ContributionListIsExecutable<
          Contributions,
          "eventHandlers",
          { readonly handler: object; readonly layer: object }
        > &
        ContributionListIsExecutable<
          Contributions,
          "providers",
          { readonly layer: object; readonly provider: object }
        > &
        ContributionListIsExecutable<
          Contributions,
          "services",
          { readonly layer: object; readonly service: object }
        >;

/** Defines the one immutable registration value owned by a commerce module. */
export const defineCommerceModule = <
  const Key extends CommerceModuleKey,
  const Dependencies extends readonly CommerceModuleKey[] = [],
  const Contributions extends CommerceModuleContributions =
    CommerceModuleContributions,
  LifecycleError = never,
  LifecycleRequirements = never,
>(
  definition: CommerceModuleDefinition<
    Key,
    Dependencies,
    Contributions,
    LifecycleError,
    LifecycleRequirements
  > &
    ValidateExecutableModuleContributions<Contributions>
): CommerceModuleDefinition<
  Key,
  Dependencies,
  Contributions,
  LifecycleError,
  LifecycleRequirements
> => definition;

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, "en");

const sortModuleKeys = (
  values: Iterable<CommerceModuleKey>
): CommerceModuleKey[] => {
  const sorted: CommerceModuleKey[] = [];
  for (const value of values) {
    const insertionIndex = sorted.findIndex(
      (existingValue) => compareText(value, existingValue) < 0
    );
    if (insertionIndex === -1) {
      sorted.push(value);
    } else {
      sorted.splice(insertionIndex, 0, value);
    }
  }
  return sorted;
};

const getDependencies = (
  moduleDefinition: CommerceModuleDefinition
): readonly CommerceModuleKey[] => moduleDefinition.dependencies ?? [];

const getStableModuleOrder = (
  modules: readonly CommerceModuleDefinition[]
): readonly CommerceModuleKey[] => {
  const dependencyCount = new Map(
    modules.map(
      (module) => [module.key, getDependencies(module).length] as const
    )
  );
  const dependants = new Map<CommerceModuleKey, CommerceModuleKey[]>();

  for (const module of modules) {
    for (const dependency of getDependencies(module)) {
      const values = dependants.get(dependency) ?? [];
      values.push(module.key);
      dependants.set(dependency, values);
    }
  }

  const available = sortModuleKeys(
    modules
      .filter((module) => dependencyCount.get(module.key) === 0)
      .map((module) => module.key)
  );
  const ordered: CommerceModuleKey[] = [];

  while (available.length > 0) {
    const moduleKey = available.shift();
    if (!moduleKey) {
      continue;
    }
    ordered.push(moduleKey);

    for (const dependant of sortModuleKeys(dependants.get(moduleKey) ?? [])) {
      const remaining = (dependencyCount.get(dependant) ?? 0) - 1;
      dependencyCount.set(dependant, remaining);
      if (remaining === 0) {
        const insertionIndex = available.findIndex(
          (availableKey) => compareText(dependant, availableKey) < 0
        );
        if (insertionIndex === -1) {
          available.push(dependant);
        } else {
          available.splice(insertionIndex, 0, dependant);
        }
      }
    }
  }

  return ordered;
};

const assertUniqueValue = ({
  contributionKind,
  key,
  owner,
  seen,
}: {
  readonly contributionKind: string;
  readonly key: string;
  readonly owner: CommerceModuleKey;
  readonly seen: Map<string, CommerceModuleKey>;
}): void => {
  const existingOwner = seen.get(key);
  if (existingOwner) {
    throw new CommerceModuleCompositionError({
      _tag: "DuplicateContribution",
      contributionKind,
      existingOwner,
      key,
      owner,
    });
  }
  seen.set(key, owner);
};

type HttpApiGroupWithEndpoints = HttpApiGroup.Any & {
  readonly endpoints: Readonly<Record<string, HttpApiEndpoint.Any>>;
};

type HttpApiEndpointWithRoute = HttpApiEndpoint.Any & {
  readonly method: string;
  readonly path: string;
};

const isEndpointWithRoute = (
  endpoint: HttpApiEndpoint.Any
): endpoint is HttpApiEndpointWithRoute =>
  "method" in endpoint &&
  typeof endpoint.method === "string" &&
  "path" in endpoint &&
  typeof endpoint.path === "string";

const getApiRoutes = (
  contribution: CommerceModuleApiGroupContribution
): readonly string[] => {
  const { endpoints } =
    contribution.group as Partial<HttpApiGroupWithEndpoints>;
  if (!endpoints) {
    return [];
  }

  return Object.values(endpoints)
    .filter(isEndpointWithRoute)
    .map(
      (endpoint) =>
        `${contribution.surface}:${endpoint.method.toUpperCase()} ${endpoint.path}`
    );
};

const getWorkflowKey = (
  workflow:
    | CommerceModuleExecutableContribution<"Workflow">
    | CommerceWorkflowDefinition
): string => workflow.key;

type ContributionKeysByKind = Map<string, Map<string, CommerceModuleKey>>;

const getSeenContributionKeys = (
  seenByKind: ContributionKeysByKind,
  kind: string
): Map<string, CommerceModuleKey> => {
  const existing = seenByKind.get(kind);
  if (existing) {
    return existing;
  }
  const created = new Map<string, CommerceModuleKey>();
  seenByKind.set(kind, created);
  return created;
};

const validateServiceContributionKeys = (
  module: CommerceModuleDefinition,
  seenByKind: ContributionKeysByKind
): void => {
  for (const service of module.contributions?.services ?? []) {
    if (!("layer" in service) || !Layer.isLayer(service.layer)) {
      throw new CommerceModuleCompositionError({
        _tag: "MissingExecutableContributionField",
        contributionKind: "service",
        field: "layer",
        key: service.key,
        owner: module.key,
      });
    }
    if (!("service" in service)) {
      throw new CommerceModuleCompositionError({
        _tag: "MissingExecutableContributionField",
        contributionKind: "service",
        field: "service",
        key: service.key,
        owner: module.key,
      });
    }
    if (!service.key.startsWith(`${module.key}:`)) {
      throw new CommerceModuleCompositionError({
        _tag: "InvalidServiceContributionKey",
        key: service.key,
        owner: module.key,
      });
    }
    assertUniqueValue({
      contributionKind: "service",
      key: service.key,
      owner: module.key,
      seen: getSeenContributionKeys(seenByKind, "service"),
    });
  }
};

const validateGenericExecutableContributionKeys = (
  module: CommerceModuleDefinition,
  seenByKind: ContributionKeysByKind
): void => {
  const keyedKinds = [
    ["event-handler", module.contributions?.eventHandlers],
    ["provider", module.contributions?.providers],
  ] as const;
  for (const [kind, values] of keyedKinds) {
    for (const value of values ?? []) {
      const executable = value as unknown as Record<string, unknown>;
      if (!Layer.isLayer(executable.layer)) {
        throw new CommerceModuleCompositionError({
          _tag: "MissingExecutableContributionField",
          contributionKind: kind,
          field: "layer",
          key: value.key,
          owner: module.key,
        });
      }
      const contractField = kind === "provider" ? "provider" : "handler";
      if (!(contractField in executable)) {
        throw new CommerceModuleCompositionError({
          _tag: "MissingExecutableContributionField",
          contributionKind: kind,
          field: contractField,
          key: value.key,
          owner: module.key,
        });
      }
      assertUniqueValue({
        contributionKind: kind,
        key: value.key,
        owner: module.key,
        seen: getSeenContributionKeys(seenByKind, kind),
      });
    }
  }
};

const validateHttpContributionKeys = (
  module: CommerceModuleDefinition,
  seenByKind: ContributionKeysByKind
): void => {
  for (const apiGroup of module.contributions?.apiGroups ?? []) {
    const contribution = apiGroup as CommerceModuleApiGroupContribution;
    assertUniqueValue({
      contributionKind: "api-group",
      key: contribution.key,
      owner: module.key,
      seen: getSeenContributionKeys(seenByKind, "api-group"),
    });
    if (!("group" in contribution) || !contribution.group) {
      throw new CommerceModuleCompositionError({
        _tag: "MissingExecutableContributionField",
        contributionKind: "HTTP group",
        field: "group",
        key: contribution.key,
        owner: module.key,
      });
    }
    if (
      !("handlers" in contribution) ||
      !Layer.isLayer(contribution.handlers)
    ) {
      throw new CommerceModuleCompositionError({
        _tag: "MissingExecutableContributionField",
        contributionKind: "HTTP group",
        field: "handlers",
        key: contribution.key,
        owner: module.key,
      });
    }
    assertUniqueValue({
      contributionKind: "HTTP group",
      key: `${contribution.surface}:${contribution.group.identifier}`,
      owner: module.key,
      seen: getSeenContributionKeys(seenByKind, "http-group"),
    });
    for (const route of getApiRoutes(contribution)) {
      assertUniqueValue({
        contributionKind: "HTTP route",
        key: route,
        owner: module.key,
        seen: getSeenContributionKeys(seenByKind, "http-route"),
      });
    }
  }
};

const validateWorkflowContributionKeys = (
  module: CommerceModuleDefinition,
  seenByKind: ContributionKeysByKind
): void => {
  for (const workflow of module.contributions?.workflows ?? []) {
    assertUniqueValue({
      contributionKind: "workflow",
      key: getWorkflowKey(workflow),
      owner: module.key,
      seen: getSeenContributionKeys(seenByKind, "workflow"),
    });
  }
  for (const workflowStep of module.contributions?.workflowSteps ?? []) {
    assertUniqueValue({
      contributionKind: "workflow step",
      key: workflowStep.name,
      owner: module.key,
      seen: getSeenContributionKeys(seenByKind, "workflow-step"),
    });
  }
};

const validateMetadataContributionKeys = (
  module: CommerceModuleDefinition,
  seenByKind: ContributionKeysByKind
): void => {
  for (const eventType of module.contributions?.eventTypes ?? []) {
    assertUniqueValue({
      contributionKind: "event type",
      key: eventType,
      owner: module.key,
      seen: getSeenContributionKeys(seenByKind, "event-type"),
    });
  }
  for (const permission of module.contributions?.permissions ?? []) {
    assertUniqueValue({
      contributionKind: "permission",
      key: permission.key,
      owner: module.key,
      seen: getSeenContributionKeys(seenByKind, "permission"),
    });
  }
  for (const surface of module.contributions?.adminSurfaces ?? []) {
    assertUniqueValue({
      contributionKind: "admin surface",
      key: `${module.key}:${surface.key}`,
      owner: module.key,
      seen: getSeenContributionKeys(seenByKind, "admin-surface"),
    });
  }
  const storageNamespaces = [
    ...(module.schema?.storageNamespaces ?? []),
    ...(module.schema?.tables ?? []),
  ];
  for (const storageNamespace of storageNamespaces) {
    assertUniqueValue({
      contributionKind: "storage namespace",
      key: storageNamespace,
      owner: module.key,
      seen: getSeenContributionKeys(seenByKind, "storage"),
    });
  }
};

const validateContributionKeys = (
  orderedModules: readonly CommerceModuleDefinition[]
): void => {
  const seenByKind: ContributionKeysByKind = new Map();

  for (const module of orderedModules) {
    validateServiceContributionKeys(module, seenByKind);
    validateGenericExecutableContributionKeys(module, seenByKind);
    validateHttpContributionKeys(module, seenByKind);
    validateWorkflowContributionKeys(module, seenByKind);
    validateMetadataContributionKeys(module, seenByKind);
  }
};

export const validateCommerceModules = <
  const Modules extends readonly CommerceModuleDefinition[],
>(
  modules: Modules
): void => {
  const byKey = new Map<CommerceModuleKey, CommerceModuleDefinition>();

  for (const moduleDefinition of modules) {
    if (byKey.has(moduleDefinition.key)) {
      throw new DuplicateModuleError(moduleDefinition.key);
    }
    byKey.set(moduleDefinition.key, moduleDefinition);
  }

  for (const moduleDefinition of modules) {
    for (const dependencyKey of getDependencies(moduleDefinition)) {
      if (!byKey.has(dependencyKey)) {
        throw new MissingModuleDependencyError(
          moduleDefinition.key,
          dependencyKey
        );
      }
    }
  }

  const orderedKeys = getStableModuleOrder(modules);
  if (orderedKeys.length !== modules.length) {
    const unresolved = sortModuleKeys(
      modules
        .map((module) => module.key)
        .filter((key) => !orderedKeys.includes(key))
    );
    throw new CyclicModuleDependencyError([...unresolved, unresolved[0] ?? ""]);
  }

  validateContributionKeys(
    orderedKeys.flatMap((key) => {
      const module = byKey.get(key);
      return module ? [module] : [];
    })
  );
};

export const composeCommerceModules = <
  const Modules extends readonly CommerceModuleDefinition[],
>(
  modules: Modules
): CommerceModuleGraph<Modules> => {
  validateCommerceModules(modules);
  const byKey = new Map<CommerceModuleKey, CommerceModuleDefinition>(
    modules.map((module) => [module.key, module] as const)
  );

  return {
    byKey,
    modules,
    orderedKeys: getStableModuleOrder(modules),
    permissions: composeCommerceModulePermissions(modules),
  };
};

const isRuntimeLayerContribution = (
  contribution:
    | CommerceModuleExecutableContribution
    | CommerceWorkflowDefinition
): contribution is RuntimeLayerContribution => "layer" in contribution;

const runLifecycleHook = ({
  hook,
  moduleKey,
  phase,
}: {
  readonly hook: CommerceModuleLifecycleHook<unknown, unknown> | undefined;
  readonly moduleKey: CommerceModuleKey;
  readonly phase: CommerceModuleLifecyclePhase;
}): Effect.Effect<void, CommerceModuleLifecycleError, unknown> =>
  (hook
    ? hook.pipe(
        Effect.mapError(
          (reason) =>
            new CommerceModuleLifecycleError({ moduleKey, phase, reason })
        )
      )
    : Effect.void
  ).pipe((effect) =>
    withOperationTelemetry(effect, {
      attributes: { moduleKey, phase },
      correlation: {
        requestId: `module-lifecycle:${moduleKey}:${phase}`,
      },
      name: "module.lifecycle",
    })
  );

const createLifecycleController = (
  orderedModules: readonly CommerceModuleDefinition[]
): CommerceModuleLifecycleController<unknown> => {
  const started = new Set<CommerceModuleKey>();
  const byKey = new Map(orderedModules.map((module) => [module.key, module]));
  const shutdownStarted = Effect.gen(function* shutdownStartedModules() {
    const shutdownOrder: CommerceModuleKey[] = [];
    for (const moduleKey of started) {
      shutdownOrder.unshift(moduleKey);
    }
    let shutdownCause: Cause.Cause<CommerceModuleLifecycleError> | undefined;
    for (const moduleKey of shutdownOrder) {
      const module = byKey.get(moduleKey);
      const exit = yield* Effect.exit(
        runLifecycleHook({
          hook: module?.lifecycle?.onShutdown,
          moduleKey,
          phase: "shutdown",
        }).pipe(
          Effect.timeout(MODULE_SHUTDOWN_TIMEOUT),
          Effect.mapError((reason) =>
            reason instanceof CommerceModuleLifecycleError
              ? reason
              : new CommerceModuleLifecycleError({
                  moduleKey,
                  phase: "shutdown",
                  reason,
                })
          )
        )
      );
      started.delete(moduleKey);
      if (Exit.isFailure(exit)) {
        shutdownCause = shutdownCause
          ? Cause.combine(shutdownCause, exit.cause)
          : exit.cause;
      }
    }
    if (shutdownCause) {
      return yield* Effect.failCause(shutdownCause);
    }
  });

  const start = Effect.gen(function* startCommerceModules() {
    for (const module of orderedModules) {
      yield* runLifecycleHook({
        hook: module.lifecycle?.onRegister,
        moduleKey: module.key,
        phase: "register",
      });
      started.add(module.key);
      yield* runLifecycleHook({
        hook: module.lifecycle?.onBootstrap,
        moduleKey: module.key,
        phase: "bootstrap",
      });
    }
  }).pipe(
    Effect.catchCause((startupCause) =>
      shutdownStarted.pipe(
        Effect.matchCauseEffect({
          onFailure: (cleanupCause) =>
            Effect.failCause(Cause.combine(startupCause, cleanupCause)),
          onSuccess: () => Effect.failCause(startupCause),
        })
      )
    )
  );

  return { shutdown: shutdownStarted, start };
};

interface CommerceApplicationContributionCollections {
  readonly adminSurfaces: CommerceAdminSurface[];
  readonly apiGroups: CommerceModuleApiGroupContribution[];
  readonly eventHandlers: CommerceModuleEventHandlerContribution[];
  readonly eventTypes: string[];
  readonly providers: CommerceModuleProviderContribution[];
  readonly services: CommerceModuleServiceContribution[];
  readonly workflowSteps: CommerceWorkflowStep[];
  readonly workflows: (
    | CommerceModuleWorkflowContribution
    | CommerceWorkflowDefinition
  )[];
}

const createContributionCollections =
  (): CommerceApplicationContributionCollections => ({
    adminSurfaces: [],
    apiGroups: [],
    eventHandlers: [],
    eventTypes: [],
    providers: [],
    services: [],
    workflowSteps: [],
    workflows: [],
  });

const collectModuleContributions = (
  collections: CommerceApplicationContributionCollections,
  module: CommerceModuleDefinition
): void => {
  const contributions = module.contributions ?? {};
  collections.services.push(
    ...((contributions.services ?? []) as CommerceModuleServiceContribution[])
  );
  collections.providers.push(
    ...((contributions.providers ?? []) as CommerceModuleProviderContribution[])
  );
  collections.apiGroups.push(
    ...((contributions.apiGroups ?? []) as CommerceModuleApiGroupContribution[])
  );
  collections.workflows.push(
    ...((contributions.workflows ?? []) as (
      | CommerceModuleWorkflowContribution
      | CommerceWorkflowDefinition
    )[])
  );
  collections.eventHandlers.push(
    ...((contributions.eventHandlers ??
      []) as CommerceModuleEventHandlerContribution[])
  );
  collections.adminSurfaces.push(...(contributions.adminSurfaces ?? []));
  collections.eventTypes.push(...(contributions.eventTypes ?? []));
  collections.workflowSteps.push(...(contributions.workflowSteps ?? []));
};

const mergeContributionLayers = (
  contributions: readonly (
    | CommerceModuleExecutableContribution
    | CommerceWorkflowDefinition
  )[]
): Layer.Layer<unknown, unknown, unknown> =>
  Layer.mergeAll(
    Layer.empty,
    ...contributions.flatMap((contribution) =>
      isRuntimeLayerContribution(contribution) ? [contribution.layer] : []
    )
  );

/**
 * Feeds already-built dependency services into each module. HTTP handler
 * Layers remain declarative here and are acquired by the HTTP assembler only
 * after it has provided request middleware. `provideMerge` retains all module
 * outputs so later dependants and Worker entrypoints share one Layer graph.
 */
const composeExecutableModuleLayers = (
  orderedModules: readonly CommerceModuleDefinition[]
): Layer.Layer<unknown, unknown, unknown> => {
  let applicationLayer = Layer.empty as unknown as Layer.Layer<
    unknown,
    unknown,
    unknown
  >;

  for (const module of orderedModules) {
    const contributions = module.contributions ?? {};
    const moduleServiceLayer = mergeContributionLayers(
      contributions.services ?? []
    );
    applicationLayer = moduleServiceLayer.pipe(
      Layer.provideMerge(applicationLayer)
    );

    const moduleExecutableLayer = mergeContributionLayers([
      ...(contributions.providers ?? []),
      ...(contributions.workflows ?? []),
      ...(contributions.eventHandlers ?? []),
    ]);
    applicationLayer = moduleExecutableLayer.pipe(
      Layer.provideMerge(applicationLayer)
    );
  }

  return applicationLayer;
};

/**
 * Validates and composes one immutable executable application from a selected
 * module catalog. No Layer acquisition or lifecycle Effect runs here, so an
 * invalid graph cannot produce startup side effects.
 */
export const composeCommerceApplication = <
  const Modules extends readonly CommerceModuleDefinition[],
>({
  modules,
}: {
  readonly modules: Modules;
}): CommerceApplicationComposition<Modules> => {
  const graph = composeCommerceModules(modules);
  const orderedModules = graph.orderedKeys.map((key) => {
    const module = graph.byKey.get(key);
    if (!module) {
      throw new MissingModuleDependencyError(key, key);
    }
    return module;
  });
  const collections = createContributionCollections();

  for (const module of orderedModules) {
    collectModuleContributions(collections, module);
  }

  const executableLayer = composeExecutableModuleLayers(orderedModules);
  const lifecycle = createLifecycleController(
    orderedModules
  ) as CommerceModuleLifecycleController<ModuleLifecycleRequirements<Modules>>;
  const lifecycleLayer = Layer.effectDiscard(
    Effect.acquireRelease(
      Effect.sync(() => createLifecycleController(orderedModules)).pipe(
        Effect.tap((scopeLifecycle) => scopeLifecycle.start)
      ),
      (scopeLifecycle) => scopeLifecycle.shutdown.pipe(Effect.orDie)
    )
  ).pipe(Layer.provide(executableLayer));
  const applicationLayer = Layer.merge(
    executableLayer,
    lifecycleLayer
  ) as CommerceApplicationComposition<Modules>["applicationLayer"];

  return {
    ...graph,
    adminSurfaces: collections.adminSurfaces,
    apiGroups: collections.apiGroups,
    applicationLayer,
    eventHandlers: collections.eventHandlers,
    eventTypes: collections.eventTypes,
    lifecycle,
    providers: collections.providers,
    schema: orderedModules.map((module) => ({
      moduleKey: module.key,
      storageNamespaces: module.schema?.storageNamespaces ?? [],
      tables: module.schema?.tables ?? [],
    })),
    services: collections.services,
    workflowSteps: collections.workflowSteps,
    workflows: collections.workflows,
  };
};

export const getCommerceModulePermissionContributions = (
  modules: readonly CommerceModuleDefinition[]
): readonly CommercePermissionContribution[] =>
  modules.map((moduleDefinition) => ({
    permissions: moduleDefinition.contributions?.permissions ?? [],
    source: {
      key: moduleDefinition.key,
      type: "module",
    },
  }));

export const composeCommerceModulePermissions = (
  modules: readonly CommerceModuleDefinition[]
): CommercePermissionComposition =>
  composeCommercePermissions(getCommerceModulePermissionContributions(modules));
