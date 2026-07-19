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
        createStoreAdminAuthSession({ permissions: ["store:read"] })
      )
    );

    expect(model.surfaces.map((surface) => surface.id)).toEqual([
      "module:store:navigation",
    ]);
    expect(model.surfaces[0]?.operations).toMatchObject({
      read: { key: "storeSettingsGet" },
    });
  });

  it("exposes product and store admin metadata for fully privileged admins", async () => {
    const model = await call(
      apiAssembly.router.adminMetadata,
      undefined,
      createContext(
        createStoreAdminAuthSession({
          permissions: [
            "store:read",
            "store:write",
            "product:read",
            "product:write",
            "region:read",
            "region:write",
            "sales-channel:read",
            "sales-channel:write",
            "pricing:read",
            "pricing:write",
          ],
        })
      )
    );

    expect(model.surfaces.map((surface) => surface.id)).toEqual([
      "module:store:navigation",
      "module:product:navigation",
      "module:store:resource",
      "module:product:resource",
      "module:region-sales-channel:regions-navigation",
      "module:region-sales-channel:regions-resource",
      "module:product:catalog-structure",
      "module:region-sales-channel:sales-channels-navigation",
      "module:region-sales-channel:sales-channels-resource",
      "module:pricing:navigation",
      "module:pricing:resource",
    ]);
  });

  it("rejects region operations when the required permission is missing", async () => {
    await expect(
      call(
        apiAssembly.router.regionCreate,
        {
          countries: ["US"],
          currencyCode: "USD",
          name: "Denied region",
        },
        createContext(
          createCustomerAuthSession({ permissions: ["region:read"] })
        )
      )
    ).rejects.toBeInstanceOf(ORPCError);
  });

  it("rejects pricing operations when the required permission is missing", async () => {
    await expect(
      call(
        apiAssembly.router.pricingPriceSetCreate,
        {
          title: "Denied prices",
        },
        createContext(
          createCustomerAuthSession({ permissions: ["pricing:read"] })
        )
      )
    ).rejects.toBeInstanceOf(ORPCError);
  });
});
