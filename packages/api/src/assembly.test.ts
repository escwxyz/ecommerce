import { describe, expect, it } from "bun:test";

import type { AuthService, AuthSession } from "@ecommerce/auth";
import { createStoreAdminAuthSession } from "@ecommerce/auth/testing";
import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { createInMemoryProductRepository } from "@ecommerce/product";
import { resetProductState } from "@ecommerce/product/testing";
import { createInMemoryStoreRepository } from "@ecommerce/store";
import { resetStoreState } from "@ecommerce/store/testing";
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
    resetProductState();
    resetStoreState();

    const assembly = createApiAssembly({
      fragments: builtinRouteFragments,
    });

    expect(assembly.fragments).toEqual(builtinRouteFragments);
    expect(assembly.router).toHaveProperty("storeSettingsGet");
    expect(assembly.router).toHaveProperty("productList");

    const healthCheck = assembly.router.healthCheck.callable({
      context: createTestContext(),
    });

    await expect(healthCheck()).resolves.toBe("OK");

    const productContext = {
      context: {
        auth,
        authorization: authorizationEvaluator,
        session: createStoreAdminAuthSession(),
      },
    } as const;

    await expect(
      call(assembly.router.storeSettingsGet, undefined, productContext)
    ).resolves.toMatchObject({
      defaultCurrencyCode: "USD",
      name: "Default store",
    });

    await expect(
      call(assembly.router.productList, undefined, productContext)
    ).resolves.toEqual([]);

    await expect(
      call(
        assembly.router.productCreate,
        {
          handle: "highlight-tee",
          title: "Highlight Tee",
        },
        productContext
      )
    ).resolves.toMatchObject({
      handle: "highlight-tee",
      status: "draft",
    });

    await expect(
      call(assembly.router.productList, undefined, productContext)
    ).resolves.toMatchObject([
      {
        handle: "highlight-tee",
        title: "Highlight Tee",
      },
    ]);
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
    expect(apiAssembly.router).toHaveProperty("storeSettingsUpdate");
    expect(apiAssembly.router).toHaveProperty("productCreate");
  });

  it("creates root assemblies with injected module dependencies", async () => {
    const productRepository = createInMemoryProductRepository();
    const storeRepository = createInMemoryStoreRepository();
    const assembly = createApiRootAssembly({
      routes: {
        product: {
          clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
          idGenerator: createSequenceIdGenerator(["prod_api_injected"]),
          repository: productRepository,
        },
        store: {
          clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
          idGenerator: createSequenceIdGenerator(["store_api_injected"]),
          repository: storeRepository,
        },
      },
    });
    const productContext = {
      context: {
        auth,
        authorization: authorizationEvaluator,
        session: createStoreAdminAuthSession(),
      },
    } as const;

    await expect(
      call(
        assembly.router.storeSettingsUpdate,
        {
          defaultCurrencyCode: "EUR",
          name: "Injected Store",
          supportedCurrencyCodes: ["USD", "EUR"],
        },
        productContext
      )
    ).resolves.toMatchObject({
      id: "store_api_injected",
      name: "Injected Store",
    });

    await expect(
      call(
        assembly.router.productCreate,
        {
          handle: "injected-product",
          title: "Injected Product",
        },
        productContext
      )
    ).resolves.toMatchObject({
      id: "prod_api_injected",
    });
    await expect(productRepository.listProducts()).resolves.toHaveLength(1);
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
    expect(spec.paths?.["/store"]?.patch?.requestBody).toBeDefined();
    expect(spec.paths?.["/store"]?.patch?.responses).toHaveProperty("200");
    expect(spec.paths?.["/products"]?.post?.requestBody).toBeDefined();
    expect(spec.paths?.["/products"]?.post?.responses).toHaveProperty("200");
  });
});
