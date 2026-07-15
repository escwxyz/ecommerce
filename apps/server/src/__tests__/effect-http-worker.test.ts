import { describe, expect, it } from "bun:test";

import {
  CurrentEffectHttpAuthContext,
  EffectHttpAuthMiddleware,
  adminHttpApi,
  defineAdminHttpApiGroupContribution,
  defineStorefrontHttpApiGroupContribution,
  EffectHttpRequestContextMiddleware,
  storefrontHttpApi,
  withEffectHttpPermission,
} from "@ecommerce/api";
import { Context, Effect, Layer, Schema } from "effect";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import effectHttpWorker from "../effect-http-worker";
import {
  createEffectHttpWorkerRuntime,
  EffectHttpWorkerRuntimeError,
} from "../effect-http-worker-runtime";

class RuntimeGreeting extends Context.Service<
  RuntimeGreeting,
  { readonly value: string }
>()("server/tests/RuntimeGreeting") {}

const GreetingResponse = Schema.Struct({
  greeting: Schema.String,
  surface: Schema.Literals(["admin", "storefront"]),
});

const ProtectedResponse = Schema.Struct({
  role: Schema.String,
  userId: Schema.String,
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

const fixedDate = new Date("2026-01-01T00:00:00.000Z");
const expiresAt = new Date("2027-01-02T00:00:00.000Z");

const createBetterAuthSession = () => ({
  session: {
    createdAt: fixedDate,
    expiresAt,
    id: "session_1",
    token: "session-token",
    updatedAt: fixedDate,
    userId: "user_1",
  },
  user: {
    email: "admin@example.com",
    emailVerified: true,
    id: "user_1",
    name: "Admin",
    permissions: ["product:read"],
    role: "admin",
  },
});

const createProtectedAdminContribution = () => {
  const groupIdentifier = "adminProtectedRuntime";
  const endpointName = "adminProtectedGreeting";
  const group = HttpApiGroup.make(groupIdentifier)
    .add(
      HttpApiEndpoint.get(endpointName, "/admin/protected-runtime", {
        success: ProtectedResponse,
      })
    )
    .middleware(EffectHttpAuthMiddleware)
    .middleware(EffectHttpRequestContextMiddleware);
  const api = HttpApi.make("AdminProtectedRuntimeTestApi").add(group);
  const handlers = HttpApiBuilder.group(api, groupIdentifier, (groupHandlers) =>
    groupHandlers.handle(endpointName, () =>
      withEffectHttpPermission(
        CurrentEffectHttpAuthContext.pipe(
          Effect.map((auth) => ({
            role: auth.actor.kind,
            userId: auth.actor.userId,
          }))
        ),
        "product:read"
      )
    )
  );

  return defineAdminHttpApiGroupContribution({
    group,
    handlers,
    key: "test:admin-protected",
    owner: "builtin",
  });
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

  it("serves protected API groups through the Better Auth Effect adapter", async () => {
    const calls: Headers[] = [];
    const runtime = createEffectHttpWorkerRuntime({
      adminRoot: adminHttpApi,
      auth: {
        api: {
          getSession: ({ headers }) => {
            calls.push(headers);
            return Promise.resolve(createBetterAuthSession());
          },
        },
      },
      contributions: [createProtectedAdminContribution()],
      storefrontRoot: storefrontHttpApi,
    });

    try {
      const response = await runtime.fetch(
        new Request("https://commerce.example/admin/protected-runtime", {
          headers: { cookie: "better-auth.session=token" },
        })
      );

      const body = await response.text();
      if (response.status !== 200) {
        throw new Error(body);
      }

      expect(JSON.parse(body)).toEqual({
        role: "store-admin",
        userId: "user_1",
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.get("cookie")).toBe("better-auth.session=token");
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

  it("rejects cross-surface method and path conflicts before router creation", () => {
    expect(() =>
      createEffectHttpWorkerRuntime({
        adminRoot: adminHttpApi,
        contributions: [
          createContribution("admin", "/shared/runtime"),
          createContribution("storefront", "/shared/runtime"),
        ],
        runtimeLayers: [],
        storefrontRoot: storefrontHttpApi,
      })
    ).toThrow(EffectHttpWorkerRuntimeError);
  });
});
