import { storefrontHttpApi } from "@ecommerce/api/effect-http-api";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import type * as HttpApi from "effect/unstable/httpapi/HttpApi";
import type * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

export type StorefrontHttpApi = HttpApi.AnyWithProps;

export type StorefrontHttpClient<Groups extends HttpApiGroup.Any> =
  HttpApiClient.Client<Groups>;

export type StorefrontHttpClientRequirements<Groups extends HttpApiGroup.Any> =
  HttpApiGroup.MiddlewareClient<Groups>;

export interface StorefrontHttpTransportOptions {
  readonly baseUrl: string | URL;
  readonly fetch?: typeof globalThis.fetch;
  readonly requestInit?: RequestInit;
}

export interface CreateStorefrontHttpClientForApiOptions<
  ApiId extends string,
  Groups extends HttpApiGroup.Any,
> extends StorefrontHttpTransportOptions {
  readonly api: HttpApi.HttpApi<ApiId, Groups>;
}

/**
 * Creates a fetch-based storefront SDK client from an explicit Effect HttpApi
 * contract. This transport works in browsers and server runtimes that provide
 * WHATWG `fetch`; it intentionally avoids Cloudflare bindings and backend
 * runtime services.
 */
export const createStorefrontHttpClientForApi = <
  const ApiId extends string,
  const Groups extends HttpApiGroup.Any,
>({
  api,
  baseUrl,
  fetch,
  requestInit,
}: CreateStorefrontHttpClientForApiOptions<ApiId, Groups>): Effect.Effect<
  StorefrontHttpClient<Groups>,
  never,
  StorefrontHttpClientRequirements<Groups>
> => {
  const client = HttpApiClient.make<ApiId, Groups>(api, { baseUrl }).pipe(
    Effect.provide(FetchHttpClient.layer)
  );
  const clientWithFetch =
    fetch === undefined
      ? client
      : Effect.provideService(client, FetchHttpClient.Fetch, fetch);

  return requestInit === undefined
    ? clientWithFetch
    : Effect.provideService(
        clientWithFetch,
        FetchHttpClient.RequestInit,
        requestInit
      );
};

/**
 * Creates the canonical public HTTP storefront SDK client. Module storefront
 * endpoints are added to the canonical API contract in the API package before
 * this transport is instantiated.
 */
export const createStorefrontHttpClient = (
  options: StorefrontHttpTransportOptions
) =>
  createStorefrontHttpClientForApi({
    ...options,
    api: storefrontHttpApi,
  });
