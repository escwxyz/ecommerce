import { describe, expect, it } from "bun:test";

import type { AuthService, AuthSession } from "@ecommerce/auth";
import { createStoreAdminAuthSession } from "@ecommerce/auth/testing";
import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { createInMemoryPricingRepository } from "@ecommerce/pricing";
import { createResettableInMemoryRegionSalesChannelRepository } from "@ecommerce/region-sales-channel";
import { OpenAPIGenerator } from "@orpc/openapi";
import { call, ORPCError } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { z } from "zod";

import { authorizationEvaluator } from "./context";
import {
  apiAssembly,
  builtinRouteFragments,
  createApiAssembly,
  createApiRootAssembly,
  createApiRouteFragment,
  definePublicApiProcedure,
  publicProcedure,
} from "./index";

const auth = {
  api: {
    getSession: async () => null,
  },
  handler: () => new Response("unused"),
} as unknown as AuthService;

const createTestContext = (session: AuthSession = null) =>
  ({
    auth,
    authorization: authorizationEvaluator,
    session,
  }) as const;

describe("api assembly", () => {
  it("assembles built-in route fragments into the root router", async () => {
    const assembly = createApiAssembly({
      fragments: builtinRouteFragments,
    });

    expect(assembly.fragments).toEqual(builtinRouteFragments);
    expect(assembly.router).not.toHaveProperty("productList");
    expect(assembly.router).not.toHaveProperty("productCatalogUpdate");
    expect(assembly.router).not.toHaveProperty("productVariantValidate");
    expect(assembly.router).toHaveProperty("regionList");
    expect(assembly.router).toHaveProperty("salesChannelList");
    expect(assembly.router).toHaveProperty("pricingCalculate");

    const healthCheck = assembly.router.healthCheck.callable({
      context: createTestContext(),
    });

    await expect(healthCheck()).resolves.toBe("OK");

    const moduleContext = {
      context: {
        auth,
        authorization: authorizationEvaluator,
        session: createStoreAdminAuthSession({
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
        }),
      },
    } as const;

    await expect(
      call(assembly.router.regionList, undefined, moduleContext)
    ).resolves.toEqual([]);
  });

  it("fails when two fragments contribute the same root route key", () => {
    expect(() =>
      createApiAssembly({
        fragments: [
          createApiRouteFragment({
            key: "builtin:health",
            owner: "builtin",
            router: {
              healthCheck: definePublicApiProcedure({
                input: z.undefined(),
                output: z.literal("OK"),
              }).handler(() => "OK"),
            },
          }),
          createApiRouteFragment({
            key: "plugin:duplicate-health",
            owner: "plugin",
            router: {
              healthCheck: definePublicApiProcedure({
                input: z.undefined(),
                output: z.literal("OK"),
              }).handler(() => "OK"),
            },
          }),
        ],
      })
    ).toThrow(/healthCheck/);
  });

  it("fails when a fragment bypasses explicit validation schemas", () => {
    expect(() =>
      createApiAssembly({
        fragments: [
          createApiRouteFragment({
            key: "plugin:unvalidated",
            owner: "plugin",
            router: {
              missingValidation: publicProcedure.handler(() => "unvalidated"),
            },
          }),
        ],
      })
    ).toThrow(/missing explicit input and output validation schema/);
  });

  it("preserves auth-aware protected procedures after assembly", async () => {
    const privateData = apiAssembly.router.privateData.callable({
      context: createTestContext(),
    });

    await expect(privateData()).rejects.toBeInstanceOf(ORPCError);
  });

  it("allows future module-style route fragments to register without server changes", async () => {
    const assembly = createApiAssembly({
      fragments: [
        ...builtinRouteFragments,
        createApiRouteFragment({
          key: "module:catalog",
          owner: "module",
          router: {
            catalogHealth: definePublicApiProcedure({
              input: z.undefined(),
              output: z.literal("catalog-ok"),
            }).handler(() => "catalog-ok"),
          },
        }),
      ],
    });

    const catalogHealth = assembly.router.catalogHealth.callable({
      context: createTestContext(),
    });

    await expect(catalogHealth()).resolves.toBe("catalog-ok");
  });

  it("allows native plugin route fragments to register without server changes", async () => {
    const assembly = createApiAssembly({
      fragments: [
        ...builtinRouteFragments,
        createApiRouteFragment({
          key: "plugin:analytics",
          owner: "plugin",
          router: {
            analyticsHealth: definePublicApiProcedure({
              input: z.undefined(),
              output: z.literal("analytics-ok"),
            }).handler(() => "analytics-ok"),
          },
        }),
      ],
    });

    const analyticsHealth = assembly.router.analyticsHealth.callable({
      context: createTestContext(),
    });

    await expect(analyticsHealth()).resolves.toBe("analytics-ok");
  });

  it("exports the assembled root router from a stable public surface", () => {
    expect(apiAssembly.router).toHaveProperty("healthCheck");
    expect(apiAssembly.router).toHaveProperty("privateData");
    expect(apiAssembly.router).not.toHaveProperty("storeSettingsUpdate");
    expect(apiAssembly.router).not.toHaveProperty("productCreate");
    expect(apiAssembly.router).not.toHaveProperty("productCatalogUpdate");
    expect(apiAssembly.router).not.toHaveProperty("productVariantValidate");
    expect(apiAssembly.router).toHaveProperty("regionCreate");
    expect(apiAssembly.router).toHaveProperty("salesChannelCreate");
    expect(apiAssembly.router).toHaveProperty("pricingPriceSetCreate");
    expect(apiAssembly.router).toHaveProperty("pricingCalculate");
  });

  it("creates root assemblies with injected module dependencies", async () => {
    const pricingRepository = createInMemoryPricingRepository();
    const regionSalesChannelRepository =
      createResettableInMemoryRegionSalesChannelRepository();
    const assembly = createApiRootAssembly({
      routes: {
        pricing: {
          clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
          idGenerator: createSequenceIdGenerator([
            "pset_api_injected",
            "evt_price_set",
            "amt_api_injected",
            "evt_calculated",
          ]),
          repository: pricingRepository,
        },
        regionSalesChannel: {
          region: {
            clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
            idGenerator: createSequenceIdGenerator([
              "reg_api_injected",
              "evt_reg",
            ]),
            repository: regionSalesChannelRepository,
          },
          salesChannel: {
            clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
            idGenerator: createSequenceIdGenerator([
              "sc_api_injected",
              "evt_sc",
            ]),
            repository: regionSalesChannelRepository,
          },
        },
      },
    });
    const moduleContext = {
      context: {
        auth,
        authorization: authorizationEvaluator,
        session: createStoreAdminAuthSession({
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
        }),
      },
    } as const;

    await expect(
      call(
        assembly.router.regionCreate,
        {
          countries: ["US"],
          currencyCode: "USD",
          name: "United States",
        },
        moduleContext
      )
    ).resolves.toMatchObject({
      id: "reg_api_injected",
    });
    await expect(
      call(
        assembly.router.salesChannelCreate,
        {
          name: "Web",
          status: "active",
        },
        moduleContext
      )
    ).resolves.toMatchObject({
      id: "sc_api_injected",
    });
    const priceSet = await call(
      assembly.router.pricingPriceSetCreate,
      {
        title: "API injected prices",
      },
      moduleContext
    );

    await call(
      assembly.router.pricingMoneyAmountCreate,
      {
        amount: 4200,
        currencyCode: "USD",
        priceSetId: priceSet.id,
      },
      moduleContext
    );

    await expect(
      call(
        assembly.router.pricingCalculate,
        {
          currencyCode: "USD",
          priceSetId: priceSet.id,
        },
        moduleContext
      )
    ).resolves.toMatchObject({
      amount: 4200,
      trace: {
        source: "base",
      },
    });
  });

  it("rejects invalid input before procedure business logic runs", async () => {
    const assembly = createApiAssembly({
      fragments: [
        createApiRouteFragment({
          key: "module:validation",
          owner: "module",
          router: {
            echoTitle: definePublicApiProcedure({
              input: z.object({
                title: z.string().min(1),
              }),
              output: z.object({
                title: z.string(),
              }),
            }).handler(({ input }) => ({
              title: input.title,
            })),
          },
        }),
      ],
    });

    const echoTitle = assembly.router.echoTitle.callable({
      context: createTestContext(),
    });

    await expect(echoTitle({ title: "Valid" })).resolves.toEqual({
      title: "Valid",
    });
    await expect(echoTitle({ title: "" })).rejects.toBeInstanceOf(ORPCError);
  });

  it("keeps validated schemas available for OpenAPI generation", async () => {
    const generator = new OpenAPIGenerator({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    });

    const spec = await generator.generate(apiAssembly.router, {
      info: {
        title: "Ecommerce API",
        version: "0.0.0",
      },
    });

    expect(spec.paths?.["/health"]?.get?.responses).toHaveProperty("200");
    expect(spec.paths?.["/store"]).toBeUndefined();
    expect(spec.paths?.["/products"]).toBeUndefined();
    expect(spec.paths?.["/regions"]?.post?.requestBody).toBeDefined();
    expect(spec.paths?.["/regions"]?.post?.responses).toHaveProperty("200");
    expect(spec.paths?.["/sales-channels"]?.post?.requestBody).toBeDefined();
    expect(spec.paths?.["/sales-channels"]?.post?.responses).toHaveProperty(
      "200"
    );
    expect(spec.paths?.["/pricing/calculate"]?.post?.requestBody).toBeDefined();
    expect(spec.paths?.["/pricing/price-sets"]?.post?.responses).toHaveProperty(
      "200"
    );
  });
});
