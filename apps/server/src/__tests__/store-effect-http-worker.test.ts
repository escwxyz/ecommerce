import { describe, expect, it } from "bun:test";

import {
  adminHttpApi,
  storefrontHttpApi,
  storeEffectHttpApiContribution,
} from "@ecommerce/api";
import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { createStoreService, createStoreServiceLayer } from "@ecommerce/store";
import {
  createResettableInMemoryStoreRepository,
  storeRepositoryTransactionResource,
} from "@ecommerce/store/testing";

import { createEffectHttpWorkerRuntime } from "../effect-http-worker-runtime";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

const createBetterAuthSession = (permissions: readonly string[]) => ({
  session: {
    createdAt: fixedDate,
    expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    id: "session_store_admin",
    token: "store-session-token",
    updatedAt: fixedDate,
    userId: "user_store_admin",
  },
  user: {
    email: "store-admin@example.com",
    emailVerified: true,
    id: "user_store_admin",
    name: "Store Admin",
    permissions,
    role: "admin",
  },
});

const createStoreRuntime = (permissions: readonly string[]) => {
  const repository = createResettableInMemoryStoreRepository();
  const outbox = createInMemoryOutbox();
  const storeService = createStoreService({
    clock: createStaticClock(fixedDate),
    idGenerator: createSequenceIdGenerator(["store_effect_http", "evt_store"]),
    outboxWriter: outbox.writer,
    repository,
    transactionBoundary: createInMemoryTransactionBoundary({
      resources: [storeRepositoryTransactionResource(repository), outbox],
    }),
  });

  return createEffectHttpWorkerRuntime({
    adminRoot: adminHttpApi,
    auth: {
      api: {
        getSession: () => Promise.resolve(createBetterAuthSession(permissions)),
      },
    },
    contributions: storeEffectHttpApiContribution.groups,
    runtimeLayers: [createStoreServiceLayer(storeService)],
    storefrontRoot: storefrontHttpApi,
  });
};

const parseJson = async (response: Response) => ({
  body: await response.json(),
  status: response.status,
});

describe("store Effect HTTP Worker handlers", () => {
  it("serves protected admin store settings through StoreService", async () => {
    const runtime = createStoreRuntime(["store:read", "store:write"]);

    try {
      const patch = await parseJson(
        await runtime.fetch(
          new Request("https://commerce.example/admin/store", {
            body: JSON.stringify({
              defaultCurrencyCode: "EUR",
              name: "Effect Store",
              supportedCurrencyCodes: ["USD", "EUR"],
            }),
            headers: {
              "content-type": "application/json",
              cookie: "better-auth.session=store-session-token",
              "x-request-id": "req_store_patch",
            },
            method: "PATCH",
          })
        )
      );
      const get = await parseJson(
        await runtime.fetch(
          new Request("https://commerce.example/admin/store", {
            headers: {
              cookie: "better-auth.session=store-session-token",
              "x-request-id": "req_store_get",
            },
          })
        )
      );

      expect(patch.status).toBe(200);
      expect(patch.body).toMatchObject({
        data: {
          defaultCurrencyCode: "EUR",
          id: "store_effect_http",
          name: "Effect Store",
          supportedCurrencyCodes: ["USD", "EUR"],
        },
        meta: { request: { requestId: "req_store_patch" } },
        success: true,
      });
      expect(get.status).toBe(200);
      expect(get.body.data.name).toBe("Effect Store");
    } finally {
      await runtime.dispose();
    }
  });

  it("exposes storefront defaults without authentication", async () => {
    const runtime = createStoreRuntime([]);

    try {
      const response = await parseJson(
        await runtime.fetch(
          new Request("https://commerce.example/store/defaults", {
            headers: { "x-request-id": "req_storefront_defaults" },
          })
        )
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        data: {
          defaultCurrencyCode: "USD",
          supportedCurrencyCodes: ["USD"],
        },
        meta: { request: { requestId: "req_storefront_defaults" } },
        success: true,
      });
    } finally {
      await runtime.dispose();
    }
  });

  it("rejects admin store writes without the store write permission", async () => {
    const runtime = createStoreRuntime(["store:read"]);

    try {
      const response = await parseJson(
        await runtime.fetch(
          new Request("https://commerce.example/admin/store", {
            body: JSON.stringify({ name: "Denied Store" }),
            headers: {
              "content-type": "application/json",
              cookie: "better-auth.session=store-session-token",
            },
            method: "PATCH",
          })
        )
      );

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        _tag: "EffectHttpForbidden",
        permission: "store:write",
      });
    } finally {
      await runtime.dispose();
    }
  });
});
