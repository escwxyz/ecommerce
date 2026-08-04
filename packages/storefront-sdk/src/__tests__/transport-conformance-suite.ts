import { expect, it } from "bun:test";

import { storefrontHttpApi } from "@ecommerce/api/effect-http-api";
import { Effect, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import type { StorefrontServiceBinding } from "../cloudflare";
import type { StorefrontHttpClient } from "../http";

const HealthResponse = Schema.Struct({
  status: Schema.Literal("ok"),
  transport: Schema.String,
});

const ConformanceStorefrontApi = storefrontHttpApi.add(
  HttpApiGroup.make("storefrontConformance").add(
    HttpApiEndpoint.get("health", "/store/conformance/health", {
      success: HealthResponse,
    })
  )
);

type ConformanceStorefrontClient = StorefrontHttpClient<
  (typeof ConformanceStorefrontApi)["groups"][string]
>;

interface ConformanceClientFactoryOptions {
  readonly api: typeof ConformanceStorefrontApi;
  readonly baseUrl: string;
  readonly binding: StorefrontServiceBinding;
  readonly fetch: typeof globalThis.fetch;
}

export interface StorefrontTransportConformanceCase {
  readonly createClient: (
    options: ConformanceClientFactoryOptions
  ) => EffectValue<ConformanceStorefrontClient, never, never>;
  readonly expectedOrigin: string;
  readonly name: string;
}

const createRecordedFetch = (
  requests: Request[],
  transport: string
): typeof globalThis.fetch =>
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
      return Promise.resolve(Response.json({ status: "ok", transport }));
    },
    { preconnect: globalThis.fetch.preconnect }
  );

export const runStorefrontTransportConformanceSuite = (
  cases: readonly StorefrontTransportConformanceCase[]
): void => {
  for (const conformanceCase of cases) {
    it(`${conformanceCase.name} preserves the storefront HttpApi contract`, async () => {
      const requests: Request[] = [];
      const fetch = createRecordedFetch(requests, conformanceCase.name);
      const binding: StorefrontServiceBinding = {
        fetch: (input, init) => fetch(input, init),
      };

      const program = Effect.gen(function* runConformanceRequest() {
        const client = yield* conformanceCase.createClient({
          api: ConformanceStorefrontApi,
          baseUrl: "https://store.example",
          binding,
          fetch,
        });

        return yield* client.storefrontConformance.health({});
      });

      await expect(Effect.runPromise(program)).resolves.toEqual({
        status: "ok",
        transport: conformanceCase.name,
      });
      expect(requests).toHaveLength(1);
      expect(requests[0]?.method).toBe("GET");
      expect(requests[0]?.url).toBe(
        `${conformanceCase.expectedOrigin}/store/conformance/health`
      );
    });
  }
};
