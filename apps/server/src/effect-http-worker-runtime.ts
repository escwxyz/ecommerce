import {
  adminHttpApi,
  createEffectHttpApiAssembly,
  storefrontHttpApi,
} from "@ecommerce/api";
import type {
  EffectHttpApiAssembly,
  EffectHttpApiGroupContribution,
  EffectHttpApiHandlerLayer,
} from "@ecommerce/api";
import { Context, Effect, Layer, Path } from "effect";
import type { Layer as EffectLayer } from "effect/Layer";
import { Etag, HttpPlatform, HttpRouter } from "effect/unstable/http";
import type { HttpApi } from "effect/unstable/httpapi";
import { HttpApiBuilder } from "effect/unstable/httpapi";

export interface CreateEffectHttpWorkerRuntimeOptions {
  readonly adminRoot?: HttpApi.AnyWithProps;
  readonly contributions: readonly EffectHttpApiGroupContribution[];
  readonly runtimeLayers?: readonly EffectLayer<unknown, never, never>[];
  readonly storefrontRoot?: HttpApi.AnyWithProps;
}

export interface EffectHttpWorkerRuntime {
  readonly admin: EffectHttpApiAssembly;
  readonly dispose: () => Promise<void>;
  readonly fetch: (request: Request) => Promise<Response>;
  readonly storefront: EffectHttpApiAssembly;
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

const mergeHandlerLayers = (handlers: readonly EffectHttpApiHandlerLayer[]) =>
  Layer.mergeAll(Layer.empty, ...handlers);

const mergeRuntimeLayers = (
  runtimeLayers: readonly EffectLayer<unknown, never, never>[]
) => Layer.mergeAll(Layer.empty, ...runtimeLayers);

/**
 * Composes both canonical API surfaces into the single router Layer served by
 * the Cloudflare Worker. Runtime Layers are provided once so every group sees
 * the same isolate-scoped services while request services remain middleware
 * scoped.
 */
export const createEffectHttpWorkerApplicationLayer = ({
  adminRoot = adminHttpApi,
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
  const handlers = mergeHandlerLayers([
    ...admin.handlers,
    ...storefront.handlers,
  ]);
  const application = Layer.mergeAll(
    HttpApiBuilder.layer(admin.api),
    HttpApiBuilder.layer(storefront.api)
  ).pipe(
    Layer.provide(handlers),
    Layer.provide(mergeRuntimeLayers(runtimeLayers)),
    Layer.provide(workerHttpSupportLayer)
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
