import { describe, expect, it } from "bun:test";

import {
  CurrentEffectHttpAuthContext,
  EffectHttpAuthMiddleware,
  EffectHttpForbidden,
  adminHttpApi,
  checkoutEffectHttpApiContribution,
  defineAdminHttpApiGroupContribution,
  defineStorefrontHttpApiGroupContribution,
  EffectHttpRequestContextMiddleware,
  storefrontHttpApi,
  withEffectHttpPermission,
} from "@ecommerce/api";
import { CheckoutService } from "@ecommerce/checkout";
import type { CheckoutServiceShape } from "@ecommerce/checkout";
import { Context, Effect, Layer, Schema } from "effect";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
} from "effect/unstable/httpapi";

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

const createBetterAuthSessionWithoutProductRead = () => ({
  ...createBetterAuthSession(),
  user: {
    ...createBetterAuthSession().user,
    permissions: [],
  },
});

const createBetterAuthSessionWithCheckoutExecute = () => ({
  ...createBetterAuthSession(),
  user: {
    ...createBetterAuthSession().user,
    permissions: ["checkout:execute"],
  },
});

const createExpiredBetterAuthSession = () => ({
  ...createBetterAuthSession(),
  session: {
    ...createBetterAuthSession().session,
    expiresAt: new Date("2026-01-02T00:00:00.000Z"),
  },
});

const createProtectedAdminContribution = () => {
  const groupIdentifier = "adminProtectedRuntime";
  const endpointName = "adminProtectedGreeting";
  const group = HttpApiGroup.make(groupIdentifier)
    .add(
      HttpApiEndpoint.get(endpointName, "/admin/protected-runtime", {
        error: EffectHttpForbidden,
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

const fetchProtectedRuntime = async ({
  auth,
  headers,
}: {
  readonly auth?: Parameters<typeof createEffectHttpWorkerRuntime>[0]["auth"];
  readonly headers?: HeadersInit;
}) => {
  const runtime = createEffectHttpWorkerRuntime({
    adminRoot: adminHttpApi,
    auth,
    contributions: [createProtectedAdminContribution()],
    storefrontRoot: storefrontHttpApi,
  });

  try {
    const response = await runtime.fetch(
      new Request("https://commerce.example/admin/protected-runtime", {
        headers,
      })
    );
    const text = await response.text();

    return {
      body: text.length > 0 ? JSON.parse(text) : null,
      status: response.status,
      text,
    };
  } finally {
    await runtime.dispose();
  }
};

describe("Cloudflare Effect HTTP Worker runtime", () => {
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

  it("answers Effect API preflights for the configured CORS origin", async () => {
    const runtime = createEffectHttpWorkerRuntime({
      adminRoot: adminHttpApi,
      contributions: [createContribution("admin", "/admin/runtime")],
      corsOrigin: "https://admin.example",
      runtimeLayers: [
        Layer.succeed(RuntimeGreeting, { value: "hello from layer" }),
      ],
      storefrontRoot: storefrontHttpApi,
    });

    try {
      const response = await runtime.fetch(
        new Request("https://commerce.example/admin/runtime", {
          headers: {
            "access-control-request-headers": "authorization,content-type",
            "access-control-request-method": "GET",
            origin: "https://admin.example",
          },
          method: "OPTIONS",
        })
      );

      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "https://admin.example"
      );
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true"
      );
      expect(response.headers.get("access-control-allow-methods")).toContain(
        "GET"
      );
      expect(response.headers.get("access-control-allow-headers")).toBe(
        "authorization,content-type"
      );
    } finally {
      await runtime.dispose();
    }
  });

  it("adds CORS headers to Effect API responses from the configured origin", async () => {
    const runtime = createEffectHttpWorkerRuntime({
      adminRoot: adminHttpApi,
      contributions: [createContribution("admin", "/admin/runtime")],
      corsOrigin: "https://admin.example",
      runtimeLayers: [
        Layer.succeed(RuntimeGreeting, { value: "hello from layer" }),
      ],
      storefrontRoot: storefrontHttpApi,
    });

    try {
      const response = await runtime.fetch(
        new Request("https://commerce.example/admin/runtime", {
          headers: { origin: "https://admin.example" },
        })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "https://admin.example"
      );
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true"
      );
      expect(response.headers.get("vary")).toContain("Origin");
    } finally {
      await runtime.dispose();
    }
  });

  it("does not add CORS headers for untrusted origins", async () => {
    const runtime = createEffectHttpWorkerRuntime({
      adminRoot: adminHttpApi,
      contributions: [createContribution("admin", "/admin/runtime")],
      corsOrigin: "https://admin.example",
      runtimeLayers: [
        Layer.succeed(RuntimeGreeting, { value: "hello from layer" }),
      ],
      storefrontRoot: storefrontHttpApi,
    });

    try {
      const response = await runtime.fetch(
        new Request("https://commerce.example/admin/runtime", {
          headers: { origin: "https://evil.example" },
        })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
      expect(
        response.headers.get("access-control-allow-credentials")
      ).toBeNull();
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

  it("rejects protected API groups when the session cookie is missing", async () => {
    const result = await fetchProtectedRuntime({});

    expect(result.status).toBe(401);
    expect(result.body).toMatchObject({
      _tag: "EffectHttpUnauthorized",
      message: "Authentication required.",
    });
    expect(result.text).not.toContain("better-auth");
  });

  it("sanitizes expired Better Auth sessions at the 5xx boundary", async () => {
    const result = await fetchProtectedRuntime({
      auth: {
        api: {
          getSession: () => Promise.resolve(createExpiredBetterAuthSession()),
        },
      },
      headers: { cookie: "better-auth.session=expired" },
    });

    expect(result.status).toBe(500);
    expect(result.text).not.toContain("session-token");
    expect(result.text).not.toContain("better-auth");
  });

  it("rejects protected API groups when the session lacks permission", async () => {
    const result = await fetchProtectedRuntime({
      auth: {
        api: {
          getSession: () =>
            Promise.resolve(createBetterAuthSessionWithoutProductRead()),
        },
      },
      headers: { cookie: "better-auth.session=token" },
    });

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({
      _tag: "EffectHttpForbidden",
      message: "Missing required permission.",
      permission: "product:read",
    });
    expect(result.text).not.toContain("better-auth");
  });

  it("serves migrated checkout through the admin Effect HTTP group", async () => {
    const checkoutService: CheckoutServiceShape = {
      completeCheckout: (input) =>
        Effect.succeed({
          cartId: input.cartId,
          fulfillmentIds: ["ful_1"],
          orderId: "ord_1",
          paymentId: "pay_1",
          status: "completed",
          workflowRunId: input.idempotencyKey,
        }),
    };
    const runtime = createEffectHttpWorkerRuntime({
      adminRoot: adminHttpApi,
      auth: {
        api: {
          getSession: () =>
            Promise.resolve(createBetterAuthSessionWithCheckoutExecute()),
        },
      },
      contributions: [...checkoutEffectHttpApiContribution.groups],
      runtimeLayers: [Layer.succeed(CheckoutService, checkoutService)],
      storefrontRoot: storefrontHttpApi,
    });

    try {
      const response = await runtime.fetch(
        new Request("https://commerce.example/admin/checkout/complete", {
          body: JSON.stringify({
            cartId: "cart_1",
            correlationId: "checkout-http",
            idempotencyKey: "checkout-http",
            payment: {
              capture: true,
              providerKey: "manual",
            },
            shippingOptionId: "shipopt_1",
          }),
          headers: {
            "content-type": "application/json",
            cookie: "better-auth.session=token",
          },
          method: "POST",
        })
      );

      const body = await response.text();
      if (response.status !== 200) {
        throw new Error(body);
      }

      expect(JSON.parse(body)).toMatchObject({
        data: {
          cartId: "cart_1",
          fulfillmentIds: ["ful_1"],
          orderId: "ord_1",
          paymentId: "pay_1",
          status: "completed",
          workflowRunId: "checkout-http",
        },
        success: true,
      });
    } finally {
      await runtime.dispose();
    }
  });

  it("sanitizes rejected Better Auth adapter failures at the protected Worker boundary", async () => {
    const result = await fetchProtectedRuntime({
      auth: {
        api: {
          getSession: () =>
            Promise.reject(new Error("database password leaked")),
        },
      },
      headers: { cookie: "better-auth.session=token" },
    });

    expect(result.status).toBe(500);
    expect(result.text).not.toContain("database password");
    expect(result.text).not.toContain("provider-rejected");
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
