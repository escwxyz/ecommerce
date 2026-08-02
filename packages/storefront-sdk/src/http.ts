import { storefrontHttpApi } from "@ecommerce/api/effect-http-api";
import { storeStorefrontHttpApiGroup } from "@ecommerce/api/store-effect-http-contract";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import type * as HttpApi from "effect/unstable/httpapi/HttpApi";
import type * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

export type StorefrontHttpApi = HttpApi.AnyWithProps;

/**
 * Canonical storefront SDK API contract. Migrated storefront module groups are
 * added here so both public HTTP and Service Binding clients expose the same
 * typed operations without importing backend handler Layers.
 */
export const storefrontSdkHttpApi = storefrontHttpApi.add(
  storeStorefrontHttpApiGroup
);

export type StorefrontHttpClient<Groups extends HttpApiGroup.Any> =
  HttpApiClient.Client<Groups>;

export type StorefrontHttpClientRequirements<Groups extends HttpApiGroup.Any> =
  HttpApiGroup.MiddlewareClient<Groups>;

export interface StorefrontSdkCorrelationContext {
  readonly operationId?: string;
  readonly parentSpanId?: string;
  readonly requestId: string;
  readonly sampled?: boolean;
  readonly traceId?: string;
}

export interface StorefrontHttpTransportOptions {
  readonly baseUrl: string | URL;
  readonly correlation?: StorefrontSdkCorrelationContext;
  readonly fetch?: typeof globalThis.fetch;
  readonly requestInit?: RequestInit;
}

export interface CreateStorefrontHttpClientForApiOptions<
  ApiId extends string,
  Groups extends HttpApiGroup.Any,
> extends StorefrontHttpTransportOptions {
  readonly api: HttpApi.HttpApi<ApiId, Groups>;
}

const mergeHeaders = (
  requestInit: RequestInit | undefined,
  correlation: StorefrontSdkCorrelationContext | undefined
): RequestInit | undefined => {
  if (!correlation) {
    return requestInit;
  }

  const headers = new Headers(requestInit?.headers);
  const propagatedHeaders: Record<string, string> = {
    "x-correlation-id": correlation.operationId ?? correlation.requestId,
    "x-request-id": correlation.requestId,
  };
  if (correlation.traceId) {
    propagatedHeaders["x-trace-id"] = correlation.traceId;
  }
  if (correlation.traceId && correlation.parentSpanId) {
    propagatedHeaders.traceparent = [
      "00",
      correlation.traceId,
      correlation.parentSpanId,
      correlation.sampled ? "01" : "00",
    ].join("-");
  }

  for (const [name, value] of Object.entries(propagatedHeaders)) {
    if (!headers.has(name)) {
      headers.set(name, value);
    }
  }

  return {
    ...requestInit,
    headers,
  };
};

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
  correlation,
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

  const propagatedRequestInit = mergeHeaders(requestInit, correlation);

  return propagatedRequestInit === undefined
    ? clientWithFetch
    : Effect.provideService(
        clientWithFetch,
        FetchHttpClient.RequestInit,
        propagatedRequestInit
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
    api: storefrontSdkHttpApi,
  });
