import type { Effect } from "effect";
import type * as HttpApi from "effect/unstable/httpapi/HttpApi";
import type * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { createStorefrontHttpClientForApi, storefrontSdkHttpApi } from "./http";
import type {
  StorefrontHttpClient,
  StorefrontHttpClientRequirements,
} from "./http";

export const DEFAULT_STOREFRONT_SERVICE_BINDING_BASE_URL =
  "https://storefront.service-binding" as const;

type StorefrontServiceBindingRequest = Parameters<typeof globalThis.fetch>[0];

/**
 * Minimal structural shape of a Cloudflare Service Binding. Keeping this
 * structural avoids importing Cloudflare runtime bindings into the SDK root
 * while still accepting the `env.MY_SERVICE` binding that Workers expose.
 */
export interface StorefrontServiceBinding {
  fetch(
    input: StorefrontServiceBindingRequest,
    init?: RequestInit
  ): Promise<Response>;
}

export interface StorefrontServiceBindingTransportOptions {
  readonly baseUrl?: string | URL;
  readonly binding: StorefrontServiceBinding;
  readonly requestInit?: RequestInit;
}

export interface CreateStorefrontServiceBindingClientForApiOptions<
  ApiId extends string,
  Groups extends HttpApiGroup.Any,
> extends StorefrontServiceBindingTransportOptions {
  readonly api: HttpApi.HttpApi<ApiId, Groups>;
}

const createServiceBindingFetch = (
  binding: StorefrontServiceBinding
): typeof globalThis.fetch =>
  Object.assign(
    (
      input: Parameters<typeof globalThis.fetch>[0],
      init?: Parameters<typeof globalThis.fetch>[1]
    ) => binding.fetch(input, init),
    { preconnect: globalThis.fetch.preconnect }
  );

/**
 * Creates a server-only Cloudflare Service Binding storefront SDK client from
 * an explicit Effect HttpApi contract. This still crosses the same HTTP
 * contract through the binding's `fetch` method and therefore does not call
 * domain services or repository Layers directly.
 */
export const createStorefrontServiceBindingClientForApi = <
  const ApiId extends string,
  const Groups extends HttpApiGroup.Any,
>({
  api,
  baseUrl = DEFAULT_STOREFRONT_SERVICE_BINDING_BASE_URL,
  binding,
  requestInit,
}: CreateStorefrontServiceBindingClientForApiOptions<
  ApiId,
  Groups
>): Effect.Effect<
  StorefrontHttpClient<Groups>,
  never,
  StorefrontHttpClientRequirements<Groups>
> =>
  createStorefrontHttpClientForApi({
    api,
    baseUrl,
    fetch: createServiceBindingFetch(binding),
    requestInit,
  });

/**
 * Creates the canonical server-only Cloudflare Service Binding storefront SDK
 * client. Use this only from Worker/server code that has access to the backend
 * Worker binding.
 */
export const createStorefrontServiceBindingClient = (
  options: StorefrontServiceBindingTransportOptions
) =>
  createStorefrontServiceBindingClientForApi({
    ...options,
    api: storefrontSdkHttpApi,
  });
