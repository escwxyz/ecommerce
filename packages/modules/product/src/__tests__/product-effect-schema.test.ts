import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Effect, Exit, Schema } from "effect";

import {
  CreateProductInputSchema,
  ProductApiRecordSchema,
  ProductIdentifierSchema,
  ProductRecordSchema,
  ProductVariantValidationResultSchema,
  createProductId,
  createProductIdEffect,
} from "../domain";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const domainDirectory = join(currentDirectory, "..", "domain");

const readDomainSource = (fileName: string): string =>
  readFileSync(join(domainDirectory, fileName), "utf8");

const emptyCatalog = {
  categories: [],
  collections: [],
  media: [],
  metadata: {},
  options: [],
  publishedAt: null,
  searchableText: "",
  tags: [],
  variants: [],
};

describe("product Effect schemas", () => {
  it("decodes product domain records and identifiers without Zod inferred types", () => {
    const decoded = Schema.decodeUnknownSync(ProductRecordSchema)({
      catalog: emptyCatalog,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      handle: "effect-shirt",
      id: "prod_effect",
      status: "draft",
      title: "Effect Shirt",
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    expect(decoded.id).toBe(createProductId("prod_effect"));
    expect(decoded.catalog).toEqual(emptyCatalog);
    expect(
      Schema.decodeUnknownSync(ProductIdentifierSchema)({ id: "prod_effect" })
    ).toEqual({ id: createProductId("prod_effect") });
    expect(
      Schema.decodeUnknownSync(CreateProductInputSchema)({
        handle: "effect-shirt",
        title: "Effect Shirt",
      })
    ).toEqual({
      handle: "effect-shirt",
      title: "Effect Shirt",
    });
  });

  it("keeps API schemas strict about serialized dates and product invariants", () => {
    const validApiRecord = {
      catalog: {
        ...emptyCatalog,
        publishedAt: "2026-01-03T00:00:00.000Z",
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      handle: "api-shirt",
      id: "prod_api",
      status: "active",
      title: "API Shirt",
      updatedAt: "2026-01-02T00:00:00.000Z",
    } as const;

    expect(
      Schema.decodeUnknownSync(ProductApiRecordSchema)(validApiRecord)
    ).toEqual(validApiRecord);

    expect(() =>
      Schema.decodeUnknownSync(ProductApiRecordSchema)({
        ...validApiRecord,
        createdAt: "not-a-date",
      })
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(ProductApiRecordSchema)({
        ...validApiRecord,
        id: "invalid",
      })
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(ProductVariantValidationResultSchema)({
        productId: "invalid",
        productStatus: "active",
        valid: true,
        variantId: "variant_1",
        variantStatus: "active",
      })
    ).toThrow();
  });

  it("returns a typed identifier failure for invalid IDs", async () => {
    const exit = await Effect.runPromiseExit(createProductIdEffect("invalid"));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain("ProductInvalidIdentifier");
    }
  });

  it("keeps domain schemas free of legacy Zod inference", () => {
    expect(readDomainSource("product.schema.ts")).not.toContain("zod");
    expect(readDomainSource("product.types.ts")).not.toContain("z.infer");
  });
});
