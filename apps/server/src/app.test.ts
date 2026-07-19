import { describe, expect, it } from "bun:test";

import {
  apiAssembly,
  authorizationEvaluator,
  createApiRootAssembly,
} from "@ecommerce/api";
import type { AuthService } from "@ecommerce/auth";
import { createStoreAdminAuthSession } from "@ecommerce/auth/testing";
import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { createInMemoryPricingRepository } from "@ecommerce/pricing";
import { call } from "@orpc/server";
import { ORPCError } from "@orpc/server";

import { createServerApp } from "./app";

const auth = {
  api: {
    getSession: async () => null,
  },
  handler: () => new Response("auth-mounted"),
} as AuthService;

const createTestApp = () =>
  createServerApp({
    auth,
    corsOrigin: "http://localhost:3001",
    createContext: async ({ auth: requestAuth }) => ({
      auth: requestAuth,
      authorization: authorizationEvaluator,
      session: null,
    }),
    reportError: () => {},
  });

describe("server app", () => {
  it("issues isolated stable visitor identities for guest requests", async () => {
    const visitorIds: string[] = [];
    const generatedVisitorIds = ["visitor_alpha", "visitor_beta"];
    const app = createServerApp({
      auth,
      corsOrigin: "http://localhost:3001",
      createContext: async (options) => {
        visitorIds.push(options.visitorId ?? "missing");
        return {
          auth: options.auth,
          authorization: authorizationEvaluator,
          session: null,
        };
      },
      createVisitorId: () => generatedVisitorIds.shift() ?? "visitor_extra",
      reportError: () => {},
    });

    const firstResponse = await app.request("/rpc/healthCheck");
    const secondResponse = await app.request("/rpc/healthCheck");
    const firstCookie = firstResponse.headers.get("set-cookie");
    const secondCookie = secondResponse.headers.get("set-cookie");

    expect(firstCookie).toContain("commerce_visitor=visitor_alpha");
    expect(secondCookie).toContain("commerce_visitor=visitor_beta");
    expect(firstCookie).toContain("HttpOnly");
    expect(visitorIds).toEqual(["visitor_alpha", "visitor_beta"]);

    const returningResponse = await app.request("/rpc/healthCheck", {
      headers: {
        cookie: firstCookie?.split(";")[0] ?? "",
      },
    });

    expect(returningResponse.headers.get("set-cookie")).toBeNull();
    expect(visitorIds).toEqual([
      "visitor_alpha",
      "visitor_beta",
      "visitor_alpha",
    ]);
  });

  it("serves the health route without requiring auth context", async () => {
    const app = createTestApp();

    const response = await app.request("/");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });

  it("mounts auth handlers from the server-owned auth instance", async () => {
    const app = createTestApp();

    const response = await app.request("/api/auth/session");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("auth-mounted");
  });

  it("accepts an injected API assembly for persistent pricing routes", async () => {
    const repository = createInMemoryPricingRepository();
    const injectedAssembly = createApiRootAssembly({
      routes: {
        pricing: {
          clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
          idGenerator: createSequenceIdGenerator([
            "pset_server_injected",
            "evt_price_set",
          ]),
          repository,
        },
      },
    });
    const app = createServerApp({
      apiAssembly: injectedAssembly,
      auth,
      corsOrigin: "http://localhost:3001",
      createContext: async ({ auth: requestAuth }) => ({
        auth: requestAuth,
        authorization: authorizationEvaluator,
        session: createStoreAdminAuthSession(),
      }),
      reportError: () => {},
    });

    await expect(app.request("/")).resolves.toHaveProperty("status", 200);
    await expect(
      call(
        injectedAssembly.router.pricingPriceSetCreate,
        {
          title: "Server Injected Prices",
        },
        {
          context: {
            auth,
            authorization: authorizationEvaluator,
            session: createStoreAdminAuthSession({
              permissions: ["pricing:read", "pricing:write"],
            }),
          },
        }
      )
    ).resolves.toMatchObject({
      id: "pset_server_injected",
    });
  });

  it("authorizes notification-event realtime websocket routing", async () => {
    const scopes: string[] = [];
    const app = createServerApp({
      auth,
      corsOrigin: "http://localhost:3001",
      createContext: async ({ auth: requestAuth }) => ({
        auth: requestAuth,
        authorization: authorizationEvaluator,
        session: createStoreAdminAuthSession({
          permissions: ["event:read"],
        }),
      }),
      notificationEventRealtime: {
        namespace: {
          getByName: (scope: string) => {
            scopes.push(scope);
            return {
              fetch: async () => new Response("realtime-routed"),
            };
          },
        } as unknown as DurableObjectNamespace,
      },
      reportError: () => {},
    });

    const response = await app.request(
      "/api/notification-events/realtime?scope=tenant:store_1",
      {
        headers: {
          upgrade: "websocket",
        },
      }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("realtime-routed");
    expect(scopes).toEqual(["tenant:store_1"]);
  });
});

describe("app router", () => {
  it("returns public health check data", async () => {
    const healthCheck = apiAssembly.router.healthCheck.callable({
      context: {
        auth,
        authorization: authorizationEvaluator,
        session: null,
      },
    });

    await expect(healthCheck()).resolves.toBe("OK");
  });

  it("rejects protected procedures without a session", async () => {
    const privateData = apiAssembly.router.privateData.callable({
      context: {
        auth,
        authorization: authorizationEvaluator,
        session: null,
      },
    });

    await expect(privateData()).rejects.toBeInstanceOf(ORPCError);
  });
});
