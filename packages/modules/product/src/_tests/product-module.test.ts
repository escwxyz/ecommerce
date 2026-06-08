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
      catalog: {
        categories: [],
        collections: [],
        media: [],
        metadata: {},
        options: [],
        publishedAt: null,
        searchableText: "",
        tags: [],
        variants: [],
      },
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
    expect(
      productContractRouter.productCatalogUpdate["~orpc"].route.operationId
    ).toBe("productCatalogUpdate");
    expect(
      productContractRouter.productVariantValidate["~orpc"].route.operationId
    ).toBe("productVariantValidate");
  });

  it("exposes typed module contributions", () => {
    expect(productModule.key).toBe("product");
    expect(productModule.contributions?.apiFragments?.[0]?.key).toBe(
      "module:product"
    );
    expect(productModule.contributions?.adminSurfaces?.[0]?.label).toBe(
      "Products"
    );
    expect(productModule.contributions?.eventTypes).toContain(
      "product.catalog.updated"
    );
  });

  it("adds catalog structure through narrow service operations and validates active variants", async () => {
    const service = createProductService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["prod_catalog"]),
      repository: createInMemoryProductRepository(),
    });
    const created = await service.createProductDraft({
      handle: "catalog-shirt",
      status: "active",
      title: "Catalog Shirt",
    });

    await service.addProductOption({
      option: {
        id: "opt_size",
        title: "Size",
        values: [{ id: "optval_medium", label: "Medium", value: "M" }],
      },
      productId: created.id,
    });
    await service.addProductVariant({
      productId: created.id,
      variant: {
        id: "variant_medium",
        optionValueIds: ["optval_medium"],
        sku: "CAT-M",
        status: "active",
        title: "Medium",
      },
    });
    const updated = await service.addProductTag({
      productId: created.id,
      tag: "featured",
    });
    await service.addProductTag({
      productId: created.id,
      tag: " cotton ",
    });
    await service.setProductCatalogMetadata({
      productId: created.id,
      publishedAt: new Date("2026-01-02T00:00:00.000Z"),
      searchableText: "Catalog Shirt cotton tee",
      metadata: {},
    });

    await expect(service.getProductById(created.id)).resolves.toMatchObject({
      catalog: {
        options: [
          {
            id: "opt_size",
          },
        ],
        searchableText: "Catalog Shirt cotton tee",
        tags: ["featured", "cotton"],
        variants: [{ id: "variant_medium", status: "active" }],
      },
    });

    expect(updated.catalog.tags).toEqual(["featured"]);
    await expect(
      service.validateProductVariant({
        productId: created.id,
        variantId: "variant_medium",
      })
    ).resolves.toEqual({
      productId: "prod_catalog",
      productStatus: "active",
      valid: true,
      variantId: "variant_medium",
      variantStatus: "active",
    });
  });

  it("updates existing catalog metadata without re-adding existing rows", async () => {
    const service = createProductService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["prod_existing_catalog"]),
      repository: createInMemoryProductRepository(),
    });
    const created = await service.createProductDraft({
      handle: "existing-catalog-shirt",
      status: "active",
      title: "Existing Catalog Shirt",
    });

    await service.addProductOption({
      option: {
        id: "opt_size",
        title: "Size",
        values: [{ id: "optval_medium", label: "Medium", value: "M" }],
      },
      productId: created.id,
    });
    await service.addProductVariant({
      productId: created.id,
      variant: {
        id: "variant_medium",
        optionValueIds: ["optval_medium"],
        sku: "EX-M",
        status: "active",
        title: "Medium",
      },
    });
    await service.addProductCollection({
      collection: {
        handle: "summer",
        id: "pcol_summer",
        title: "Summer",
      },
      productId: created.id,
    });
    await service.addProductCategory({
      category: {
        handle: "shirts",
        id: "pcat_shirts",
        title: "Shirts",
      },
      productId: created.id,
    });
    await service.addProductMedia({
      media: {
        id: "img_front",
        metadata: {},
        type: "image",
        url: "https://example.com/front.jpg",
      },
      productId: created.id,
    });
    await service.addProductTag({
      productId: created.id,
      tag: "featured",
    });

    const updated = await service.updateProductCatalog({
      catalog: {
        metadata: { season: "summer" },
        searchableText: "Existing Catalog Shirt summer drop",
      },
      id: created.id,
    });

    expect(updated.catalog).toMatchObject({
      categories: [{ id: "pcat_shirts" }],
      collections: [{ id: "pcol_summer" }],
      media: [{ id: "img_front" }],
      metadata: { season: "summer" },
      options: [{ id: "opt_size" }],
      searchableText: "Existing Catalog Shirt summer drop",
      tags: ["featured"],
      variants: [{ id: "variant_medium" }],
    });
    expect(updated.catalog.options).toHaveLength(1);
    expect(updated.catalog.variants).toHaveLength(1);
    expect(updated.catalog.collections).toHaveLength(1);
    expect(updated.catalog.categories).toHaveLength(1);
    expect(updated.catalog.media).toHaveLength(1);
    expect(updated.catalog.tags).toHaveLength(1);
  });

  it("rejects variants that reference unknown option values", async () => {
    const service = createProductService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["prod_invalid_catalog"]),
      repository: createInMemoryProductRepository(),
    });
    const created = await service.createProductDraft({
      handle: "invalid-catalog-shirt",
      title: "Invalid Catalog Shirt",
    });

    await expect(
      service.updateProductCatalog({
        catalog: {
          variants: [
            {
              id: "variant_invalid",
              optionValueIds: ["missing_option_value"],
              status: "active",
              title: "Invalid",
            },
          ],
        },
        id: created.id,
      })
    ).rejects.toThrow(/unknown option value/);
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

    const updated = await call(
      fragment.router.productCatalogUpdate,
      {
        catalog: {
          options: [
            {
              id: "opt_color",
              title: "Color",
              values: [{ id: "optval_black", label: "Black", value: "black" }],
            },
          ],
          variants: [
            {
              id: "variant_black",
              optionValueIds: ["optval_black"],
              status: "active",
              title: "Black",
            },
          ],
        },
        id: created.id,
      },
      {
        context: {
          auth: {} as never,
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

    expect(updated.catalog.variants).toEqual([
      {
        id: "variant_black",
        optionValueIds: ["optval_black"],
        status: "active",
        title: "Black",
      },
    ]);
  });
});
