import { describe, expect, it } from "bun:test";

import type { AuthService } from "@ecommerce/auth";
import {
  createCustomerAuthSession,
  createStoreAdminAuthSession,
} from "@ecommerce/auth/testing";
import { call, ORPCError } from "@orpc/server";

import { authorizationEvaluator } from "./context";
import { apiAssembly } from "./index";

const auth = {
  api: {
    getSession: async () => null,
  },
  handler: () => new Response("unused"),
} as unknown as AuthService;

const createContext = (session = createStoreAdminAuthSession()) =>
  ({
    context: {
      auth,
      authorization: authorizationEvaluator,
      session,
    },
  }) as const;

describe("admin metadata API", () => {
  it("exposes permission-filtered admin metadata through the root router", async () => {
    const model = await call(
      apiAssembly.router.adminMetadata,
      undefined,
      createContext(
        createStoreAdminAuthSession({ permissions: ["product:read"] })
      )
    );

    expect(model.surfaces.map((surface) => surface.id)).toEqual([
      "module:product:navigation",
    ]);
    expect(model.surfaces[0]?.operations).toMatchObject({
      list: { key: "productList" },
    });
  });

  it("rejects product operations when the required permission is missing", async () => {
    await expect(
      call(
        apiAssembly.router.productCreate,
        {
          handle: "denied-shirt",
          title: "Denied Shirt",
        },
        createContext(
          createCustomerAuthSession({ permissions: ["product:read"] })
        )
      )
    ).rejects.toBeInstanceOf(ORPCError);
  });
});
