import { describe, expect, it } from "bun:test";

import { storefrontHttpApi } from "@ecommerce/api/effect-http-api";
import { Effect, Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { createStorefrontHttpClientForApi } from "../http";

const HealthResponse = Schema.Struct({
  status: Schema.Literal("ok"),
});

const TestStorefrontApi = storefrontHttpApi.add(
  HttpApiGroup.make("storefrontHealth").add(
    HttpApiEndpoint.get("health", "/store/health", {
      success: HealthResponse,
    })
  )
);

describe("storefront public HTTP SDK transport", () => {
  it("calls the canonical storefront HttpApi contract through fetch-compatible runtimes", async () => {
    const requests: Request[] = [];
    const fetch = Object.assign(
      async (
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
        return Response.json({ status: "ok" });
      },
      { preconnect: globalThis.fetch.preconnect }
    ) satisfies typeof globalThis.fetch;

    const program = Effect.gen(function* () {
      const client = yield* createStorefrontHttpClientForApi({
        api: TestStorefrontApi,
        baseUrl: "https://store.example",
        fetch,
      });

      return yield* client.storefrontHealth.health({});
    });

    await expect(Effect.runPromise(program)).resolves.toEqual({
      status: "ok",
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe("GET");
    expect(requests[0]?.url).toBe("https://store.example/store/health");
  });
});
