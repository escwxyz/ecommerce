import { describe, expect, it } from "bun:test";

import { createProductId, type ProductRecord } from "@ecommerce/product";
import { Effect, Exit, Schema } from "effect";

import {
  postgresProduct,
  postgresProductTableName,
  ProductPostgresInsertSchema,
  ProductPostgresRowSchema,
  toProductPostgresInsert,
  toProductRecord,
} from "../index";

const productRecord: ProductRecord = {
  catalog: {
    categories: [],
    collections: [],
    media: [],
    metadata: { source: "schema-test" },
    options: [],
    publishedAt: null,
    searchableText: "PostgreSQL product",
    tags: ["featured"],
    variants: [],
  },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  handle: "postgres-product",
  id: createProductId("prod_postgres_schema"),
  status: "active",
  title: "PostgreSQL Product",
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const postgresRow = {
  catalogJson: productRecord.catalog,
  createdAt: productRecord.createdAt,
  handle: productRecord.handle,
  id: productRecord.id,
  metadataJson: productRecord.catalog.metadata,
  status: productRecord.status,
  title: productRecord.title,
  updatedAt: productRecord.updatedAt,
};

describe("PostgreSQL product schema and codecs", () => {
  it("declares the product PostgreSQL table and generated storage schemas", () => {
    expect(postgresProductTableName).toBe("product");
    expect(postgresProduct.id).toBeDefined();
    expect(postgresProduct.catalogJson).toBeDefined();
    expect(
      Schema.decodeUnknownSync(ProductPostgresRowSchema)(postgresRow)
    ).toEqual(postgresRow);
    expect(
      Schema.decodeUnknownSync(ProductPostgresInsertSchema)(postgresRow)
    ).toEqual(postgresRow);
  });

  it("preserves product invariants at the PostgreSQL storage boundary", () => {
    const invalidProductId = Schema.decodeUnknownExit(ProductPostgresRowSchema)(
      {
        ...postgresRow,
        id: "invalid",
      }
    );
    const invalidCreatedAt = Schema.decodeUnknownExit(ProductPostgresRowSchema)(
      {
        ...postgresRow,
        createdAt: "not-a-date",
      }
    );

    expect(Exit.isFailure(invalidProductId)).toBe(true);
    expect(Exit.isFailure(invalidCreatedAt)).toBe(true);
  });

  it("round-trips between product domain records and PostgreSQL rows", async () => {
    const insert = await Effect.runPromise(
      toProductPostgresInsert(productRecord)
    );
    const decoded = await Effect.runPromise(toProductRecord(insert));

    expect(insert).toEqual(postgresRow);
    expect(decoded).toEqual(productRecord);
  });
});
