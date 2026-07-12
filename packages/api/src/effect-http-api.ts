import type { Layer } from "effect/Layer";
import type { HttpApiGroup } from "effect/unstable/httpapi";
import { HttpApi, OpenApi } from "effect/unstable/httpapi";

export type EffectHttpApiSurface = "admin" | "storefront";
export type EffectHttpApiContributionOwner = "builtin" | "module" | "plugin";

export interface EffectHttpApiGroupContribution<
  TSurface extends EffectHttpApiSurface = EffectHttpApiSurface,
  TGroup extends HttpApiGroup.Any = HttpApiGroup.Any,
  THandlers = Layer<never, unknown, unknown>,
> {
  readonly group: TGroup;
  readonly handlers: THandlers;
  readonly key: string;
  readonly owner: EffectHttpApiContributionOwner;
  readonly surface: TSurface;
}

export interface EffectHttpApiModuleContribution<
  TGroups extends readonly EffectHttpApiGroupContribution[] =
    readonly EffectHttpApiGroupContribution[],
> {
  readonly groups: TGroups;
  readonly moduleName: string;
}

/**
 * Canonical admin API root. Modules and trusted plugins contribute groups to
 * this contract; server packages only assemble and serve the resulting API.
 */
export const adminHttpApi = HttpApi.make("CommerceAdminApi").annotate(
  OpenApi.Title,
  "Commerce Admin API"
);

/**
 * Canonical storefront API root. Browser HTTP and Cloudflare Service Binding
 * SDK transports must derive from this contract instead of calling domain
 * services directly.
 */
export const storefrontHttpApi = HttpApi.make("CommerceStorefrontApi").annotate(
  OpenApi.Title,
  "Commerce Storefront API"
);

export const defineEffectHttpApiGroupContribution = <
  const TContribution extends EffectHttpApiGroupContribution,
>(
  contribution: TContribution
): TContribution => contribution;

export const defineAdminHttpApiGroupContribution = <
  const TContribution extends Omit<
    EffectHttpApiGroupContribution<"admin">,
    "surface"
  >,
>(
  contribution: TContribution
): TContribution & { readonly surface: "admin" } => ({
  ...contribution,
  surface: "admin",
});

export const defineStorefrontHttpApiGroupContribution = <
  const TContribution extends Omit<
    EffectHttpApiGroupContribution<"storefront">,
    "surface"
  >,
>(
  contribution: TContribution
): TContribution & { readonly surface: "storefront" } => ({
  ...contribution,
  surface: "storefront",
});

export const defineEffectHttpApiModuleContribution = <
  const TContribution extends EffectHttpApiModuleContribution,
>(
  contribution: TContribution
): TContribution => contribution;
