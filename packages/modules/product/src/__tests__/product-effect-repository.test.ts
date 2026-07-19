import { describe, expect, it } from "bun:test";

import {
  createRepositoryContractHarness,
  type RepositoryContractCase,
} from "@ecommerce/core/testing";
import { Effect, Layer } from "effect";

import { ProductRepositoryService, createProductId } from "../domain";
import type { ProductRecord, ProductRepository } from "../domain";
import { createResettableInMemoryProductRepository } from "../repositories";
import { createEmptyProductCatalog } from "../services";

const createProductRecord = (id: string, createdAt: Date): ProductRecord => ({
  catalog: createEmptyProductCatalog(),
  createdAt,
  handle: `handle-${id}`,
  id: createProductId(id),
  status: "draft",
  title: `Product ${id}`,
  updatedAt: createdAt,
});

export const productRepositoryContractCases: readonly RepositoryContractCase<ProductRepository>[] =
  [
    {
      name: "saves and reads products by ID and handle",
      run: ProductRepositoryService.use((repository) =>
        Effect.gen(function* savesAndReadsProductsContract() {
          const product = createProductRecord(
            "prod_contract_1",
            new Date("2026-01-01T00:00:00.000Z")
          );

          const saved = yield* repository.saveProduct(product);
          const byId = yield* repository.findProductById(product.id);
          const byHandle = yield* repository.findProductByHandle(
            product.handle
          );

          expect(saved).toEqual(product);
          expect(byId).toEqual(product);
          expect(byHandle).toEqual(product);
        })
      ),
    },
    {
      name: "lists newest products first",
      run: ProductRepositoryService.use((repository) =>
        Effect.gen(function* listsNewestProductsFirstContract() {
          const older = createProductRecord(
            "prod_contract_older",
            new Date("2026-01-01T00:00:00.000Z")
          );
          const newer = createProductRecord(
            "prod_contract_newer",
            new Date("2026-01-02T00:00:00.000Z")
          );

          yield* repository.saveProduct(older);
          yield* repository.saveProduct(newer);

          const products = yield* repository.listProducts;

          expect(products).toEqual([newer, older]);
        })
      ),
    },
    {
      name: "updates product-owned catalog fields",
      run: ProductRepositoryService.use((repository) =>
        Effect.gen(function* updatesProductCatalogContract() {
          const product = createProductRecord(
            "prod_contract_catalog",
            new Date("2026-01-01T00:00:00.000Z")
          );
          const saved = yield* repository.saveProduct(product);
          const updated = yield* repository.updateProduct({
            ...saved,
            catalog: {
              ...saved.catalog,
              tags: ["featured"],
              variants: [
                {
                  id: "variant_contract",
                  optionValueIds: [],
                  status: "active",
                  title: "Contract",
                },
              ],
            },
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
          });

          const byId = yield* repository.findProductById(product.id);

          expect(updated.catalog.tags).toEqual(["featured"]);
          expect(byId).toEqual(updated);
        })
      ),
    },
  ];

describe("product Effect repository contract", () => {
  it("runs against the in-memory repository Layer", async () => {
    const repository = createResettableInMemoryProductRepository();
    const harness = createRepositoryContractHarness({
      adapter: "in-memory",
      layer: Layer.succeed(ProductRepositoryService, repository),
      repositoryName: "ProductRepository",
      reset: Effect.sync(() => repository.clear()),
    });

    await Effect.runPromise(harness.runAll(productRepositoryContractCases));

    expect(harness.adapter).toBe("in-memory");
    expect(harness.repositoryName).toBe("ProductRepository");
  });
});
