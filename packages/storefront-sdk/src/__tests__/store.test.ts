import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  type StorefrontServiceBinding,
  createStorefrontServiceBindingClient,
} from "../cloudflare";
import { createStorefrontHttpClient } from "../http";

const storeDefaultsResponse = {
  data: {
    defaultCurrencyCode: "USD",
    defaultLocale: "en-US",
    defaultRegionId: null,
    defaultSalesChannelId: null,
    supportedCurrencyCodes: ["USD", "EUR"],
    timezone: "UTC",
  },
  meta: {
    request: {
      correlationId: "corr_store_sdk",
      requestId: "req_store_sdk",
    },
  },
  success: true,
} as const;

const createRecordedFetch = (requests: Request[]): typeof globalThis.fetch =>
  Object.assign(
    (
      input: Parameters<typeof globalThis.fetch>[0],
      init?: Parameters<typeof globalThis.fetch>[1]
    ) => {
      const request =
        input instanceof Request && init === undefined
          ? input
          : new Request(
              input instanceof Request ? input.url : input.toString(),
              init
            );
      requests.push(request);
      return Promise.resolve(Response.json(storeDefaultsResponse));
    },
    { preconnect: globalThis.fetch.preconnect }
  );

describe("storefront store SDK", () => {
  it("loads store defaults through the browser HTTP transport", async () => {
    const requests: Request[] = [];

    const program = Effect.gen(function* loadStoreDefaults() {
      const client = yield* createStorefrontHttpClient({
        baseUrl: "https://store.example",
        fetch: createRecordedFetch(requests),
      });

      return yield* client.storefrontStore.storeDefaultsGet({});
    });

    await expect(Effect.runPromise(program)).resolves.toEqual(
      storeDefaultsResponse
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe("GET");
    expect(requests[0]?.url).toBe("https://store.example/store/defaults");
  });

  it("loads store defaults through the Cloudflare Service Binding transport", async () => {
    const requests: Request[] = [];
    const fetch = createRecordedFetch(requests);
    const binding: StorefrontServiceBinding = {
      fetch: (input, init) => fetch(input, init),
    };

    const program = Effect.gen(function* loadStoreDefaults() {
      const client = yield* createStorefrontServiceBindingClient({ binding });

      return yield* client.storefrontStore.storeDefaultsGet({});
    });

    await expect(Effect.runPromise(program)).resolves.toEqual(
      storeDefaultsResponse
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe("GET");
    expect(requests[0]?.url).toBe(
      "https://storefront.service-binding/store/defaults"
    );
  });
});
