import type { Layer } from "effect/Layer";
import type {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import type {
  EffectHttpApiGroupContribution,
  EffectHttpApiSurface,
} from "./effect-http-api";

export interface EffectHttpApiRouteFingerprint {
  readonly contributionKey: string;
  readonly endpointName: string;
  readonly groupIdentifier: string;
  readonly method: string;
  readonly owner: EffectHttpApiGroupContribution["owner"];
  readonly path: string;
  readonly routeKey: string;
  readonly surface: EffectHttpApiSurface;
}

export interface DuplicateEffectHttpApiRoute {
  readonly _tag: "DuplicateEffectHttpApiRoute";
  readonly conflict: EffectHttpApiRouteFingerprint;
  readonly existing: EffectHttpApiRouteFingerprint;
  readonly routeKey: string;
}

export interface DuplicateEffectHttpApiGroup {
  readonly _tag: "DuplicateEffectHttpApiGroup";
  readonly conflictContributionKey: string;
  readonly existingContributionKey: string;
  readonly groupIdentifier: string;
  readonly surface: EffectHttpApiSurface;
}

export class EffectHttpApiAssemblyError extends Error {
  readonly detail: DuplicateEffectHttpApiGroup | DuplicateEffectHttpApiRoute;

  constructor(
    detail: DuplicateEffectHttpApiGroup | DuplicateEffectHttpApiRoute
  ) {
    super(getEffectHttpApiAssemblyErrorMessage(detail));
    this.name = "EffectHttpApiAssemblyError";
    this.detail = detail;
  }
}

export interface EffectHttpApiAssembly<TApi extends HttpApi.Any = HttpApi.Any> {
  readonly api: TApi;
  readonly contributions: readonly EffectHttpApiGroupContribution[];
  readonly groups: readonly HttpApiGroup.Any[];
  readonly handlers: readonly Layer<never, unknown, unknown>[];
  readonly routes: readonly EffectHttpApiRouteFingerprint[];
  readonly surface: EffectHttpApiSurface;
}

export interface CreateEffectHttpApiAssemblyOptions<TApi extends HttpApi.Any> {
  readonly contributions: readonly EffectHttpApiGroupContribution[];
  readonly root: TApi;
  readonly surface: EffectHttpApiSurface;
}

type HttpApiWithAdd = HttpApi.Any & {
  readonly add: (group: HttpApiGroup.Any) => HttpApi.Any;
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

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, "en");

const getSorted = <TValue>(
  values: Iterable<TValue>,
  compare: (left: TValue, right: TValue) => number
): readonly TValue[] => {
  const sorted: TValue[] = [];

  for (const value of values) {
    const insertionIndex = sorted.findIndex(
      (existingValue) => compare(value, existingValue) < 0
    );

    if (insertionIndex === -1) {
      sorted.push(value);
      continue;
    }

    sorted.splice(insertionIndex, 0, value);
  }

  return sorted;
};

const getContributionSortKey = (
  contribution: EffectHttpApiGroupContribution
): string =>
  [
    contribution.surface,
    contribution.owner,
    contribution.key,
    contribution.group.identifier,
  ].join("\u0000");

const sortContributions = (
  contributions: readonly EffectHttpApiGroupContribution[]
): readonly EffectHttpApiGroupContribution[] =>
  getSorted(contributions, (left, right) =>
    compareText(getContributionSortKey(left), getContributionSortKey(right))
  );

const getRouteKey = ({
  method,
  path,
}: Pick<EffectHttpApiRouteFingerprint, "method" | "path">): string =>
  `${method.toUpperCase()} ${path}`;

const getGroupEndpoints = (
  group: HttpApiGroup.Any
): readonly HttpApiEndpointWithRoute[] =>
  getSorted(
    Object.values((group as HttpApiGroupWithEndpoints).endpoints).filter(
      isEndpointWithRoute
    ),
    (left, right) => compareText(left.name, right.name)
  );

const getGroupRoutes = (
  contribution: EffectHttpApiGroupContribution
): readonly EffectHttpApiRouteFingerprint[] =>
  getGroupEndpoints(contribution.group).map((endpoint) => {
    const { path } = endpoint;
    const method = endpoint.method.toUpperCase();
    return {
      contributionKey: contribution.key,
      endpointName: endpoint.name,
      groupIdentifier: contribution.group.identifier,
      method,
      owner: contribution.owner,
      path,
      routeKey: getRouteKey({ method, path }),
      surface: contribution.surface,
    };
  });

const getEffectHttpApiAssemblyErrorMessage = (
  detail: DuplicateEffectHttpApiGroup | DuplicateEffectHttpApiRoute
): string => {
  if (detail._tag === "DuplicateEffectHttpApiGroup") {
    return `Duplicate ${detail.surface} HttpApi group "${detail.groupIdentifier}" from "${detail.conflictContributionKey}" conflicts with "${detail.existingContributionKey}".`;
  }

  return `Duplicate ${detail.existing.surface} HttpApi route "${detail.routeKey}" from "${detail.conflict.contributionKey}" conflicts with "${detail.existing.contributionKey}".`;
};

const assertUniqueGroup = (
  groupsByIdentifier: Map<string, EffectHttpApiGroupContribution>,
  contribution: EffectHttpApiGroupContribution
): void => {
  const existing = groupsByIdentifier.get(contribution.group.identifier);
  if (existing) {
    throw new EffectHttpApiAssemblyError({
      _tag: "DuplicateEffectHttpApiGroup",
      conflictContributionKey: contribution.key,
      existingContributionKey: existing.key,
      groupIdentifier: contribution.group.identifier,
      surface: contribution.surface,
    });
  }

  groupsByIdentifier.set(contribution.group.identifier, contribution);
};

const assertUniqueRoute = (
  routesByMethodPath: Map<string, EffectHttpApiRouteFingerprint>,
  route: EffectHttpApiRouteFingerprint
): void => {
  const existing = routesByMethodPath.get(route.routeKey);
  if (existing) {
    throw new EffectHttpApiAssemblyError({
      _tag: "DuplicateEffectHttpApiRoute",
      conflict: route,
      existing,
      routeKey: route.routeKey,
    });
  }

  routesByMethodPath.set(route.routeKey, route);
};

/**
 * Builds one canonical Effect `HttpApi` surface from module and plugin group
 * contributions. Assembly is intentionally deterministic so OpenAPI snapshots,
 * SDK generation, and Worker composition see the same ordering regardless of
 * package registration order.
 */
export const createEffectHttpApiAssembly = <const TApi extends HttpApi.Any>({
  contributions,
  root,
  surface,
}: CreateEffectHttpApiAssemblyOptions<TApi>): EffectHttpApiAssembly => {
  const selectedContributions = sortContributions(
    contributions.filter((contribution) => contribution.surface === surface)
  );
  const groupsByIdentifier = new Map<string, EffectHttpApiGroupContribution>();
  const routesByMethodPath = new Map<string, EffectHttpApiRouteFingerprint>();
  const groups: HttpApiGroup.Any[] = [];
  const handlers: Layer<never, unknown, unknown>[] = [];
  const routes: EffectHttpApiRouteFingerprint[] = [];
  let api: HttpApi.Any = root;

  for (const contribution of selectedContributions) {
    assertUniqueGroup(groupsByIdentifier, contribution);
    const groupRoutes = getGroupRoutes(contribution);

    for (const route of groupRoutes) {
      assertUniqueRoute(routesByMethodPath, route);
      routes.push(route);
    }

    groups.push(contribution.group);
    handlers.push(contribution.handlers);
    api = (api as HttpApiWithAdd).add(contribution.group);
  }

  return {
    api,
    contributions: selectedContributions,
    groups,
    handlers,
    routes,
    surface,
  };
};
