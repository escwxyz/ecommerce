import { describe, expect, it } from "bun:test";

import {
  adminHttpApi,
  defineAdminHttpApiGroupContribution,
  defineStorefrontHttpApiGroupContribution,
  storefrontHttpApi,
} from "@ecommerce/api";
import { Context, Effect, Layer, Schema } from "effect";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import effectHttpWorker from "../effect-http-worker";
import { createEffectHttpWorkerRuntime } from "../effect-http-worker-runtime";

class RuntimeGreeting extends Context.Service<
  RuntimeGreeting,
  { readonly value: string }
>()("server/tests/RuntimeGreeting") {}

const GreetingResponse = Schema.Struct({
  greeting: Schema.String,
  surface: Schema.Literals(["admin", "storefront"]),
});

const createContribution = (
  surface: "admin" | "storefront",
  path: `/${string}`
) => {
  const groupIdentifier = `${surface}Runtime`;
  const endpointName = `${surface}Greeting`;
  const group = HttpApiGroup.make(groupIdentifier).add(
    HttpApiEndpoint.get(endpointName, path, {
      success: GreetingResponse,
    })
  );
  const api = HttpApi.make(`${surface}RuntimeTestApi`).add(group);
  const handlers = HttpApiBuilder.group(api, groupIdentifier, (groupHandlers) =>
    groupHandlers.handle(endpointName, () =>
      Effect.gen(function* () {
        const greeting = yield* RuntimeGreeting;
        return { greeting: greeting.value, surface };
      })
    )
  );
  const contribution = {
    group,
    handlers,
    key: `test:${surface}`,
    owner: "builtin" as const,
  };

  return surface === "admin"
    ? defineAdminHttpApiGroupContribution(contribution)
    : defineStorefrontHttpApiGroupContribution(contribution);
};

describe("Cloudflare Effect HTTP Worker runtime", () => {
  it("exports an Alchemy Effect Worker entrypoint", () => {
    expect(Effect.isEffect(effectHttpWorker)).toBe(true);
  });

  it("serves canonical admin and storefront APIs through one Fetch handler", async () => {
    const runtime = createEffectHttpWorkerRuntime({
      adminRoot: adminHttpApi,
      contributions: [
        createContribution("storefront", "/storefront/runtime"),
        createContribution("admin", "/admin/runtime"),
      ],
      runtimeLayers: [
        Layer.succeed(RuntimeGreeting, { value: "hello from layer" }),
      ],
      storefrontRoot: storefrontHttpApi,
    });

    try {
      const adminResponse = await runtime.fetch(
        new Request("https://commerce.example/admin/runtime")
      );
      const storefrontResponse = await runtime.fetch(
        new Request("https://commerce.example/storefront/runtime")
      );

      expect(adminResponse.status).toBe(200);
      expect(await adminResponse.json()).toEqual({
        greeting: "hello from layer",
        surface: "admin",
      });
      expect(storefrontResponse.status).toBe(200);
      expect(await storefrontResponse.json()).toEqual({
        greeting: "hello from layer",
        surface: "storefront",
      });
    } finally {
      await runtime.dispose();
    }
  });

  it("fails closed when a declared API group has no handler Layer", async () => {
    const contribution = createContribution("admin", "/admin/unimplemented");
    const runtime = createEffectHttpWorkerRuntime({
      adminRoot: adminHttpApi,
      contributions: [{ ...contribution, handlers: Layer.empty }],
      runtimeLayers: [],
      storefrontRoot: storefrontHttpApi,
    });

    try {
      await expect(
        runtime.fetch(
          new Request("https://commerce.example/admin/unimplemented")
        )
      ).rejects.toThrow(/HttpApiGroup "adminRuntime" not found/);
    } finally {
      await runtime.dispose();
    }
  });
});
