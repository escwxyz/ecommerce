import type { AnyProcedure } from "@orpc/server";
import { isProcedure } from "@orpc/server";

type ApiRouteMap = Record<string, AnyProcedure>;

export type ApiRouteFragmentOwner = "builtin" | "module" | "plugin";

export interface ApiRouteFragment<
  TRouter extends ApiRouteMap = ApiRouteMap,
  TOwner extends ApiRouteFragmentOwner = ApiRouteFragmentOwner,
  TKey extends string = string,
> {
  key: TKey;
  owner: TOwner;
  router: TRouter;
}

type UnionToIntersection<TValue> = (
  TValue extends unknown ? (value: TValue) => void : never
) extends (value: infer TIntersection) => void
  ? TIntersection
  : never;

type Simplify<TValue> = {
  [TKey in keyof TValue]: TValue[TKey];
};

type MergeFragmentRouters<TFragments extends readonly ApiRouteFragment[]> =
  Simplify<UnionToIntersection<TFragments[number]["router"]>>;

export interface ApiAssembly<TRouter> {
  fragments: readonly ApiRouteFragment[];
  router: TRouter;
}

export const createApiRouteFragment = <
  const TFragment extends ApiRouteFragment,
>(
  fragment: TFragment
): TFragment => fragment;

const getMissingValidationSchemas = (
  procedure: AnyProcedure
): readonly string[] => {
  const missingSchemas: string[] = [];

  if (!procedure["~orpc"].inputSchema) {
    missingSchemas.push("input");
  }

  if (!procedure["~orpc"].outputSchema) {
    missingSchemas.push("output");
  }

  return missingSchemas;
};

const getValidatedProcedure = ({
  fragment,
  procedure,
  routeKey,
}: {
  readonly fragment: ApiRouteFragment;
  readonly procedure: unknown;
  readonly routeKey: string;
}): AnyProcedure => {
  if (!isProcedure(procedure)) {
    throw new Error(
      `API route "${routeKey}" from "${fragment.key}" must be an oRPC procedure.`
    );
  }

  const missingSchemas = getMissingValidationSchemas(procedure);

  if (missingSchemas.length > 0) {
    throw new Error(
      `API route "${routeKey}" from "${fragment.key}" is missing explicit ${missingSchemas.join(
        " and "
      )} validation schema declarations.`
    );
  }

  return procedure;
};

export const createApiAssembly = <
  const TFragments extends readonly ApiRouteFragment[],
>({
  fragments,
}: {
  fragments: TFragments;
}): ApiAssembly<MergeFragmentRouters<TFragments>> => {
  const router: ApiRouteMap = {};
  const routeOwners = new Map<string, string>();

  for (const fragment of fragments) {
    for (const [routeKey, procedure] of Object.entries(fragment.router)) {
      const validatedProcedure = getValidatedProcedure({
        fragment,
        procedure,
        routeKey,
      });

      const existingOwner = routeOwners.get(routeKey);

      if (existingOwner) {
        throw new Error(
          `Duplicate API route key "${routeKey}" from "${fragment.key}" conflicts with "${existingOwner}".`
        );
      }

      routeOwners.set(routeKey, fragment.key);
      router[routeKey] = validatedProcedure;
    }
  }

  return {
    fragments: [...fragments],
    router: router as MergeFragmentRouters<TFragments>,
  };
};
