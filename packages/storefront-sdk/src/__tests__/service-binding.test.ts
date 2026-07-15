import { describe, expect, it } from "bun:test";

import { storefrontHttpApi } from "@ecommerce/api/effect-http-api";
import { Effect, Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import {
  type StorefrontServiceBinding,
  createStorefrontServiceBindingClientForApi,
} from "../cloudflare";

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

describe("storefront Cloudflare Service Binding SDK transport", () => {
  it("calls the canonical storefront HttpApi contract through a Service Binding fetch", async () => {
    const requests: Request[] = [];
    const binding: StorefrontServiceBinding = {
      fetch: async (input, init) => {
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
    };

    const program = Effect.gen(function* () {
      const client = yield* createStorefrontServiceBindingClientForApi({
        api: TestStorefrontApi,
        binding,
      });

      return yield* client.storefrontHealth.health({});
    });

    await expect(Effect.runPromise(program)).resolves.toEqual({
      status: "ok",
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe("GET");
    expect(requests[0]?.url).toBe(
      "https://storefront.service-binding/store/health"
    );
  });
});
