import type { RouterClient } from "@orpc/server";

import { createApiAssembly } from "./assembly";
import { builtinPermissionComposition } from "./permissions";
import {
  builtinRouteFragments,
  createBuiltinRouteFragments,
} from "./routers/index";
import type { CreateBuiltinRouteFragmentsOptions } from "./routers/index";

export interface CreateApiRootAssemblyOptions {
  readonly routes?: CreateBuiltinRouteFragmentsOptions;
}

export const createApiRootAssembly = ({
  routes,
}: CreateApiRootAssemblyOptions = {}) => ({
  ...createApiAssembly({
    fragments: routes
      ? createBuiltinRouteFragments(routes)
      : builtinRouteFragments,
  }),
  permissions: builtinPermissionComposition,
});

export const apiAssembly = createApiRootAssembly();

export type ApiRootAssembly = ReturnType<typeof createApiRootAssembly>;
export type AppRouter = typeof apiAssembly.router;
export type AppRouterClient = RouterClient<AppRouter>;
