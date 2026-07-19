import { describe, expect, it } from "bun:test";

import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect, Exit } from "effect";

import { createInMemoryProductRepository } from "../repositories";
import { createProductService } from "../services";

describe("product Effect service", () => {
  it("creates, lists, and reads product drafts through Effect operations", async () => {
    const service = createProductService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["prod_1"]),
      repository: createInMemoryProductRepository(),
    });

    const created = await Effect.runPromise(
      service.createProductDraft({
        handle: "Featured Shirt",
        title: " Featured Shirt ",
      })
    );

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
    await expect(Effect.runPromise(service.listProducts)).resolves.toEqual([
      created,
    ]);
    await expect(
      Effect.runPromise(service.getProductById(created.id))
    ).resolves.toEqual(created);
  });

  it("adds catalog structure and validates active variants", async () => {
    const service = createProductService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["prod_catalog"]),
      repository: createInMemoryProductRepository(),
    });
    const created = await Effect.runPromise(
      service.createProductDraft({
        handle: "catalog-shirt",
        status: "active",
        title: "Catalog Shirt",
      })
    );

    await Effect.runPromise(
      service.addProductOption({
        option: {
          id: "opt_size",
          title: "Size",
          values: [{ id: "optval_medium", label: "Medium", value: "M" }],
        },
        productId: created.id,
      })
    );
    await Effect.runPromise(
      service.addProductVariant({
        productId: created.id,
        variant: {
          id: "variant_medium",
          optionValueIds: ["optval_medium"],
          sku: "CAT-M",
          status: "active",
          title: "Medium",
        },
      })
    );
    await Effect.runPromise(
      service.addProductTag({
        productId: created.id,
        tag: " featured ",
      })
    );
    await Effect.runPromise(
      service.setProductCatalogMetadata({
        metadata: {},
        productId: created.id,
        publishedAt: new Date("2026-01-02T00:00:00.000Z"),
        searchableText: " Catalog Shirt cotton tee ",
      })
    );

    await expect(
      Effect.runPromise(service.getProductById(created.id))
    ).resolves.toMatchObject({
      catalog: {
        options: [{ id: "opt_size" }],
        searchableText: "Catalog Shirt cotton tee",
        tags: ["featured"],
        variants: [{ id: "variant_medium", status: "active" }],
      },
    });
    await expect(
      Effect.runPromise(
        service.validateProductVariant({
          productId: created.id,
          variantId: "variant_medium",
        })
      )
    ).resolves.toEqual({
      productId: "prod_catalog",
      productStatus: "active",
      valid: true,
      variantId: "variant_medium",
      variantStatus: "active",
    });
  });

  it("returns typed failures for duplicate handles and invalid variant options", async () => {
    const service = createProductService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["prod_a", "prod_b"]),
      repository: createInMemoryProductRepository(),
    });
    const product = await Effect.runPromise(
      service.createProductDraft({
        handle: "duplicate",
        title: "Duplicate",
      })
    );

    const duplicateExit = await Effect.runPromiseExit(
      service.createProductDraft({
        handle: "duplicate",
        title: "Duplicate again",
      })
    );
    const invalidVariantExit = await Effect.runPromiseExit(
      service.addProductVariant({
        productId: product.id,
        variant: {
          id: "variant_broken",
          optionValueIds: ["missing_option_value"],
          status: "active",
          title: "Broken",
        },
      })
    );

    expect(Exit.isFailure(duplicateExit)).toBe(true);
    expect(Exit.isFailure(invalidVariantExit)).toBe(true);
    if (Exit.isFailure(duplicateExit)) {
      expect(String(duplicateExit.cause)).toContain("ProductHandleConflict");
    }
    if (Exit.isFailure(invalidVariantExit)) {
      expect(String(invalidVariantExit.cause)).toContain(
        "ProductCatalogValidationFailure"
      );
    }
  });
});
