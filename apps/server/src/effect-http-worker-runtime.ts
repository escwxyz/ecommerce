import {
  adminHttpApi,
  createEffectHttpApiAssembly,
  effectHttpAuthMiddlewareLayer,
  effectHttpAuthServiceFromEffectAuthLayer,
  effectHttpExecutionMiddlewareLayer,
  effectHttpPermissionServiceLayer,
  effectHttpRequestContextMiddlewareLayer,
  effectHttpRequestIdGeneratorLayer,
  storefrontHttpApi,
} from "@ecommerce/api";
import type {
  EffectHttpApiAssembly,
  EffectHttpApiRouteFingerprint,
  EffectHttpApiGroupContribution,
  EffectHttpApiHandlerLayer,
} from "@ecommerce/api";
import {
  AuthPermissionDenied,
  AuthPermissionKeySchema,
  AuthUnauthenticated,
  EffectAuthServiceTag,
  effectAuthServiceLayer,
  makeAnonymousAuthRequestContext,
} from "@ecommerce/auth";
import { betterAuthEffectAuthLayer } from "@ecommerce/auth/better-auth-effect-adapter";
import type { BetterAuthCompatibleService } from "@ecommerce/auth/better-auth-effect-adapter";
import { Context, Effect, Layer, Path } from "effect";
import type { Layer as EffectLayer } from "effect/Layer";
import { Etag, HttpPlatform, HttpRouter } from "effect/unstable/http";
import type { HttpApi } from "effect/unstable/httpapi";
import { HttpApiBuilder } from "effect/unstable/httpapi";

export interface CreateEffectHttpWorkerRuntimeOptions {
  readonly adminRoot?: HttpApi.AnyWithProps;
  readonly auth?: BetterAuthCompatibleService;
  readonly contributions: readonly EffectHttpApiGroupContribution[];
  readonly runtimeLayers?: readonly EffectLayer<never, never, never>[];
  readonly storefrontRoot?: HttpApi.AnyWithProps;
}

export interface EffectHttpWorkerRuntime {
  readonly admin: EffectHttpApiAssembly;
  readonly dispose: () => Promise<void>;
  readonly fetch: (request: Request) => Promise<Response>;
  readonly storefront: EffectHttpApiAssembly;
}

export interface DuplicateEffectHttpWorkerRoute {
  readonly admin: EffectHttpApiRouteFingerprint;
  readonly routeKey: string;
  readonly storefront: EffectHttpApiRouteFingerprint;
}

export class EffectHttpWorkerRuntimeError extends Error {
  readonly detail: DuplicateEffectHttpWorkerRoute;

  constructor(detail: DuplicateEffectHttpWorkerRoute) {
    super(
      `Duplicate Effect Worker route "${detail.routeKey}" is contributed by both the admin and storefront HttpApi surfaces.`
    );
    this.name = "EffectHttpWorkerRuntimeError";
    this.detail = detail;
  }
}

/**
 * Effect HTTP does not currently ship a Worker filesystem implementation.
 * Commerce APIs are JSON/stream based, so file responses fail as defects until
 * a Cloudflare asset adapter is introduced explicitly.
 */
const workerHttpPlatformLayer = Layer.succeed(HttpPlatform.HttpPlatform, {
  fileResponse: () =>
    Effect.die("HttpPlatform.fileResponse is not supported by this Worker"),
  fileWebResponse: () =>
    Effect.die("HttpPlatform.fileWebResponse is not supported by this Worker"),
});

const workerHttpSupportLayer = Layer.mergeAll(
  Etag.layer,
  workerHttpPlatformLayer,
  Path.layer
);

const failClosedEffectAuthLayer = effectAuthServiceLayer(
  EffectAuthServiceTag.of({
    getRequestContext: () => Effect.succeed(makeAnonymousAuthRequestContext()),
    requireAuthenticated: () =>
      Effect.fail(new AuthUnauthenticated({ reason: "missing-session" })),
    requirePermission: () =>
      Effect.fail(
        new AuthPermissionDenied({
          permission: AuthPermissionKeySchema.make("system:authenticated"),
          reason: "missing-permission",
        })
      ),
  })
);

const mergeHandlerLayers = (handlers: readonly EffectHttpApiHandlerLayer[]) =>
  Layer.mergeAll(Layer.empty, ...handlers);

const createRuntimeSupportLayer = ({
  auth,
  runtimeLayers,
}: {
  readonly auth?: BetterAuthCompatibleService;
  readonly runtimeLayers: readonly EffectLayer<never, never, never>[];
}): EffectLayer<never, never, never> => {
  const authBoundaryLayer = auth
    ? betterAuthEffectAuthLayer(auth)
    : failClosedEffectAuthLayer;
  const httpAuthServiceLayer = effectHttpAuthServiceFromEffectAuthLayer.pipe(
    Layer.provide(authBoundaryLayer)
  );
  const baseLayer = Layer.mergeAll(
    effectHttpRequestIdGeneratorLayer,
    effectHttpRequestContextMiddlewareLayer,
    effectHttpAuthMiddlewareLayer,
    effectHttpExecutionMiddlewareLayer,
    httpAuthServiceLayer,
    effectHttpPermissionServiceLayer,
    ...runtimeLayers
  );

  return baseLayer as EffectLayer<never, never, never>;
};

const assertNoCrossSurfaceRouteConflicts = (
  adminRoutes: readonly EffectHttpApiRouteFingerprint[],
  storefrontRoutes: readonly EffectHttpApiRouteFingerprint[]
): void => {
  const adminRoutesByKey = new Map(
    adminRoutes.map((route) => [route.routeKey, route] as const)
  );

  for (const storefrontRoute of storefrontRoutes) {
    const adminRoute = adminRoutesByKey.get(storefrontRoute.routeKey);
    if (!adminRoute) {
      continue;
    }

    throw new EffectHttpWorkerRuntimeError({
      admin: adminRoute,
      routeKey: storefrontRoute.routeKey,
      storefront: storefrontRoute,
    });
  }
};

/**
 * Composes both canonical API surfaces into the single router Layer served by
 * the Cloudflare Worker. Runtime Layers are provided once so every group sees
 * the same isolate-scoped services while request services remain middleware
 * scoped.
 */
export const createEffectHttpWorkerApplicationLayer = ({
  adminRoot = adminHttpApi,
  auth,
  contributions,
  runtimeLayers = [],
  storefrontRoot = storefrontHttpApi,
}: CreateEffectHttpWorkerRuntimeOptions) => {
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
  assertNoCrossSurfaceRouteConflicts(admin.routes, storefront.routes);
  const handlers = mergeHandlerLayers([
    ...admin.handlers,
    ...storefront.handlers,
  ]);
  const application = Layer.mergeAll(
    HttpApiBuilder.layer(admin.api),
    HttpApiBuilder.layer(storefront.api)
  )
    .pipe(
      Layer.provide(handlers),
      Layer.provide(createRuntimeSupportLayer({ auth, runtimeLayers })),
      Layer.provide(workerHttpSupportLayer)
    )
    .pipe(
      (layer): EffectLayer<never, never, never> =>
        layer as EffectLayer<never, never, never>
    );

  return { admin, application, storefront };
};

/** Creates the request Effect expected by Alchemy's Effect-native Worker. */
export const createEffectHttpWorkerHttpEffect = (
  options: CreateEffectHttpWorkerRuntimeOptions
) =>
  HttpRouter.toHttpEffect(
    createEffectHttpWorkerApplicationLayer(options).application
  );

/**
 * Creates a Fetch-compatible runtime for credential-free tests and temporary
 * interop with the legacy async Worker entrypoint during vertical migration.
 */
export const createEffectHttpWorkerRuntime = (
  options: CreateEffectHttpWorkerRuntimeOptions
): EffectHttpWorkerRuntime => {
  const { admin, application, storefront } =
    createEffectHttpWorkerApplicationLayer(options);
  const runtime = HttpRouter.toWebHandler(application, {
    disableLogger: true,
  });

  return {
    admin,
    dispose: runtime.dispose,
    fetch: (request) => runtime.handler(request, Context.empty()),
    storefront,
  };
};
