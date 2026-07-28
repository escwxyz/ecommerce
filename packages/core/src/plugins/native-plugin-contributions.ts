import type * as Context from "effect/Context";
import type { Effect } from "effect/Effect";
import type { Layer } from "effect/Layer";
import type { HttpApiGroup } from "effect/unstable/httpapi";

import type { CommerceEventEnvelope } from "../events/index";
import type { CommerceWorkflowDefinition } from "../workflows/index";

export type NativePluginExecutableContributionKind =
  | "ApiGroup"
  | "EventHandler"
  | "Provider"
  | "Service"
  | "Workflow";

/**
 * Covariant registration marker shared by heterogeneous plugin contributions.
 *
 * The marker lets dynamic composition retain a closed executable vocabulary
 * without erasing invariant Effect service tags and Layers to `any`.
 */
export interface NativePluginExecutableContribution<
  Kind extends NativePluginExecutableContributionKind =
    NativePluginExecutableContributionKind,
> {
  readonly _tag: Kind;
  readonly key: string;
}

/**
 * Runtime-neutral service Layer contributed by a trusted native plugin.
 *
 * The service tag is the public contract. Concrete runtime resources stay
 * inside the Layer and may require other portable services through `RIn`.
 */
export interface NativePluginServiceContribution<
  Identifier = unknown,
  Service = unknown,
  LayerError = never,
  RIn = never,
> {
  readonly _tag: "Service";
  readonly key: string;
  readonly service: Context.Key<Identifier, Service>;
  readonly layer: Layer<Identifier, LayerError, RIn>;
}

/**
 * Provider implementation contributed as an Effect service Layer.
 *
 * Provider SDKs and platform bindings must remain private to the Layer; module
 * code consumes only the portable service tag declared by `provider`.
 */
export interface NativePluginProviderContribution<
  Identifier = unknown,
  Provider = unknown,
  LayerError = never,
  RIn = never,
  Kind extends string = string,
> {
  readonly _tag: "Provider";
  readonly contractKey: string;
  readonly key: string;
  readonly kind: Kind;
  readonly label?: string;
  readonly provider: Context.Key<Identifier, Provider>;
  readonly layer: Layer<Identifier, LayerError, RIn>;
}

/**
 * Handler Layer accepted by a trusted plugin Effect HTTP group contribution.
 */
export type NativePluginApiHandlerLayer =
  | Layer<HttpApiGroup.ApiGroup<string, string>, never, unknown>
  | Layer<never, never, unknown>;

/**
 * Canonical Effect HTTP contribution supplied by a trusted native plugin.
 *
 * The API package can compose this structure directly because it preserves the
 * group schemas, handler Layer, surface, and plugin ownership classification.
 */
export interface NativePluginApiGroupContribution<
  Surface extends "admin" | "storefront" = "admin" | "storefront",
  Group extends HttpApiGroup.Any = HttpApiGroup.Any,
  Handlers extends NativePluginApiHandlerLayer = NativePluginApiHandlerLayer,
> {
  readonly _tag: "ApiGroup";
  readonly group: Group;
  readonly handlers: Handlers;
  readonly key: string;
  readonly owner: "plugin";
  readonly surface: Surface;
}

/**
 * Effect workflow contributed by a trusted native plugin.
 *
 * Workflow steps already expose typed Effect failures. The Layer supplies any
 * portable services used by those executable steps at host composition time.
 */
export interface NativePluginWorkflowContribution<
  Input = unknown,
  Output = unknown,
  WorkflowError = never,
  WorkflowRequirements = never,
  LayerError = never,
  RIn = never,
> {
  readonly _tag: "Workflow";
  readonly key: string;
  readonly workflow: CommerceWorkflowDefinition<
    Input,
    Output,
    WorkflowError,
    WorkflowRequirements
  >;
  readonly layer: Layer<WorkflowRequirements, LayerError, RIn>;
}

/**
 * Effect-native event handler contributed by a trusted native plugin.
 */
export interface NativePluginEventHandlerContribution<
  EventName extends string = string,
  Payload = unknown,
  HandlerError = never,
  HandlerRequirements = never,
  LayerError = never,
  RIn = never,
> {
  readonly _tag: "EventHandler";
  readonly eventName: EventName;
  readonly handler: (
    event: CommerceEventEnvelope<EventName, Payload>
  ) => Effect<void, HandlerError, HandlerRequirements>;
  readonly key: string;
  readonly layer: Layer<HandlerRequirements, LayerError, RIn>;
}

/** Preserves inference for a native plugin service Layer contribution. */
export const defineNativePluginServiceContribution = <
  Identifier,
  Service,
  LayerError,
  RIn,
>(
  contribution: Omit<
    NativePluginServiceContribution<Identifier, Service, LayerError, RIn>,
    "_tag"
  >
): NativePluginServiceContribution<Identifier, Service, LayerError, RIn> => ({
  ...contribution,
  _tag: "Service",
});

/** Preserves inference for a native plugin provider Layer contribution. */
export const defineNativePluginProviderContribution = <
  Identifier,
  Provider,
  LayerError,
  RIn,
  const Kind extends string,
>(
  contribution: Omit<
    NativePluginProviderContribution<
      Identifier,
      Provider,
      LayerError,
      RIn,
      Kind
    >,
    "_tag"
  >
): NativePluginProviderContribution<
  Identifier,
  Provider,
  LayerError,
  RIn,
  Kind
> => ({
  ...contribution,
  _tag: "Provider",
});

/** Adds the trusted-plugin owner classification to an Effect HTTP group. */
export const defineNativePluginApiGroupContribution = <
  const Contribution extends Omit<
    NativePluginApiGroupContribution,
    "_tag" | "owner"
  >,
>(
  contribution: Contribution
): Contribution & { readonly _tag: "ApiGroup"; readonly owner: "plugin" } => ({
  ...contribution,
  _tag: "ApiGroup",
  owner: "plugin",
});

/** Preserves inference for a native plugin workflow contribution. */
export const defineNativePluginWorkflowContribution = <
  Input,
  Output,
  WorkflowError,
  WorkflowRequirements,
  LayerError,
  RIn,
>(
  contribution: Omit<
    NativePluginWorkflowContribution<
      Input,
      Output,
      WorkflowError,
      WorkflowRequirements,
      LayerError,
      RIn
    >,
    "_tag"
  >
): NativePluginWorkflowContribution<
  Input,
  Output,
  WorkflowError,
  WorkflowRequirements,
  LayerError,
  RIn
> => ({
  ...contribution,
  _tag: "Workflow",
});

/** Preserves inference for a native plugin event-handler contribution. */
export const defineNativePluginEventHandlerContribution = <
  const EventName extends string,
  Payload,
  HandlerError,
  HandlerRequirements,
  LayerError,
  RIn,
>(
  contribution: Omit<
    NativePluginEventHandlerContribution<
      EventName,
      Payload,
      HandlerError,
      HandlerRequirements,
      LayerError,
      RIn
    >,
    "_tag"
  >
): NativePluginEventHandlerContribution<
  EventName,
  Payload,
  HandlerError,
  HandlerRequirements,
  LayerError,
  RIn
> => ({
  ...contribution,
  _tag: "EventHandler",
});
