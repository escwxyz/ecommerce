import type { HttpApi } from "effect/unstable/httpapi";
import { OpenApi } from "effect/unstable/httpapi";

import type {
  EffectHttpApiGroupContribution,
  EffectHttpApiSurface,
} from "./effect-http-api";
import { adminHttpApi, storefrontHttpApi } from "./effect-http-api";
import type { EffectHttpApiAssembly } from "./effect-http-api-assembly";
import { createEffectHttpApiAssembly } from "./effect-http-api-assembly";

export type EffectHttpOpenApiDocument = ReturnType<typeof OpenApi.fromApi>;

export interface EffectHttpOpenApiSurfaceSnapshot {
  readonly assembly: EffectHttpApiAssembly;
  readonly document: EffectHttpOpenApiDocument;
  readonly json: string;
  readonly surface: EffectHttpApiSurface;
}

export interface EffectHttpOpenApiSnapshot {
  readonly admin: EffectHttpOpenApiSurfaceSnapshot;
  readonly storefront: EffectHttpOpenApiSurfaceSnapshot;
}

export interface CreateEffectHttpApiOpenApiSnapshotOptions {
  readonly adminRoot?: HttpApi.AnyWithProps;
  readonly contributions: readonly EffectHttpApiGroupContribution[];
  readonly storefrontRoot?: HttpApi.AnyWithProps;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const insertSortedText = (
  sorted: string[],
  value: string
): readonly string[] => {
  const insertionIndex = sorted.findIndex(
    (existingValue) => value.localeCompare(existingValue, "en") < 0
  );

  if (insertionIndex === -1) {
    sorted.push(value);
    return sorted;
  }

  sorted.splice(insertionIndex, 0, value);
  return sorted;
};

const sortText = (values: Iterable<string>): readonly string[] => {
  const sorted: string[] = [];

  for (const value of values) {
    insertSortedText(sorted, value);
  }

  return sorted;
};

const sortJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  const sorted: Record<string, unknown> = {};
  const keys = sortText(Object.keys(value));

  for (const key of keys) {
    sorted[key] = sortJsonValue(value[key]);
  }

  return sorted;
};

/**
 * Serializes generated OpenAPI with deterministic object key ordering.
 * The source of truth remains Effect `HttpApi`; this helper only makes the
 * derived artifact stable enough for reviewable snapshots and SDK inputs.
 */
export const stringifyEffectHttpOpenApiDocument = (
  document: EffectHttpOpenApiDocument
): string => `${JSON.stringify(sortJsonValue(document), null, 2)}\n`;

const createSurfaceSnapshot = ({
  assembly,
  surface,
}: {
  readonly assembly: EffectHttpApiAssembly;
  readonly surface: EffectHttpApiSurface;
}): EffectHttpOpenApiSurfaceSnapshot => {
  const document = OpenApi.fromApi(assembly.api);

  return {
    assembly,
    document,
    json: stringifyEffectHttpOpenApiDocument(document),
    surface,
  };
};

/**
 * Generates OpenAPI for the canonical admin and storefront API assemblies.
 * Callers pass module and plugin contributions once; this function derives both
 * surfaces from the same deterministic assembly path used by Worker and SDK
 * tasks.
 */
export const createEffectHttpApiOpenApiSnapshot = ({
  adminRoot = adminHttpApi,
  contributions,
  storefrontRoot = storefrontHttpApi,
}: CreateEffectHttpApiOpenApiSnapshotOptions): EffectHttpOpenApiSnapshot => {
  const admin = createEffectHttpApiAssembly({
    contributions,
    root: adminRoot,
    surface: "admin",
  });
  const storefront = createEffectHttpApiAssembly({
    contributions,
    root: storefrontRoot,
    surface: "storefront",
  });

  return {
    admin: createSurfaceSnapshot({
      assembly: admin,
      surface: "admin",
    }),
    storefront: createSurfaceSnapshot({
      assembly: storefront,
      surface: "storefront",
    }),
  };
};
