import { describe, expect, it } from "bun:test";

import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { call } from "@orpc/server";

import { productContractRouter } from "../contracts";
import { productModule } from "../module";
import { createInMemoryProductRepository } from "../repositories";
import { createProductRouteFragment } from "../router";
import { createProductService } from "../services";

describe("product module foundation", () => {
  it("creates and lists products through the service contract", async () => {
    const service = createProductService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["prod_1"]),
      repository: createInMemoryProductRepository(),
    });

    const created = await service.createProductDraft({
      handle: "featured-shirt",
      title: "Featured Shirt",
    });

    expect(created).toMatchObject({
      handle: "featured-shirt",
      id: "prod_1",
      status: "draft",
      title: "Featured Shirt",
    });

    await expect(service.listProducts()).resolves.toHaveLength(1);
    await expect(service.getProductById(created.id)).resolves.toMatchObject({
      id: "prod_1",
    });
  });

  it("creates prefixed product IDs by default and preserves injected IDs", async () => {
    const defaultIdService = createProductService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      repository: createInMemoryProductRepository(),
    });
    const defaultIdProduct = await defaultIdService.createProductDraft({
      handle: "default-id-shirt",
      title: "Default ID Shirt",
    });

    expect(defaultIdProduct.id).toStartWith("prod_");

    const injectedIdService = createProductService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["prod_injected"]),
      repository: createInMemoryProductRepository(),
    });

    await expect(
      injectedIdService.createProductDraft({
        handle: "injected-id-shirt",
        title: "Injected ID Shirt",
      })
    ).resolves.toMatchObject({
      id: "prod_injected",
    });
  });

  it("declares contract-first product route metadata", () => {
    expect(productContractRouter.productCreate["~orpc"].route.method).toBe(
      "POST"
    );
    expect(productContractRouter.productCreate["~orpc"].route.summary).toBe(
      "Create product"
    );
    expect(productContractRouter.productCreate["~orpc"].route.tags).toEqual([
      "Products",
    ]);
  });

  it("exposes typed module contributions", () => {
    expect(productModule.key).toBe("product");
    expect(productModule.contributions?.apiFragments?.[0]?.key).toBe(
      "module:product"
    );
    expect(productModule.contributions?.adminSurfaces?.[0]?.label).toBe(
      "Products"
    );
  });

  it("builds a route fragment from an injected service", async () => {
    const fragment = createProductRouteFragment({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["prod_7"]),
      repository: createInMemoryProductRepository(),
    });

    const created = await call(
      fragment.router.productCreate,
      {
        handle: "module-tee",
        title: "Module Tee",
      },
      {
        context: {
          auth: {
            api: {
              getSession: async () => null,
            },
            handler: () => new Response("unused"),
          } as never,
          authorization: {
            evaluatePermission: () => ({ allowed: true }),
          },
          session: {
            user: {
              email: "ada@example.com",
              id: "user_1",
              name: "Ada",
            },
          },
        },
      }
    );

    expect(created).toMatchObject({
      handle: "module-tee",
      id: "prod_7",
    });
  });
});
