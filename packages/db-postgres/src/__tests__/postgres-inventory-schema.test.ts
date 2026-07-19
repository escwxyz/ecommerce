import { describe, expect, it } from "bun:test";

import {
  createInventoryItemId,
  createStockLocationId,
  type InventoryItemRecord,
  type StockLocationRecord,
} from "@ecommerce/inventory";
import { Effect, Exit, Schema } from "effect";

import {
  InventoryItemPostgresInsertSchema,
  InventoryItemPostgresRowSchema,
  StockLocationPostgresInsertSchema,
  StockLocationPostgresRowSchema,
  postgresInventoryItem,
  postgresInventoryItemTableName,
  postgresInventoryStockLocation,
  postgresInventoryStockLocationTableName,
  toInventoryItemPostgresInsert,
  toStockLocationPostgresInsert,
} from "../index";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

const inventoryItem: InventoryItemRecord = {
  createdAt,
  id: createInventoryItemId("iitem_schema"),
  metadata: { source: "schema-test" },
  sku: "schema-sku",
  title: "Schema item",
  updatedAt: createdAt,
};

const stockLocation: StockLocationRecord = {
  createdAt,
  id: createStockLocationId("sloc_schema"),
  metadata: {},
  name: "Schema warehouse",
  salesChannelIds: ["sc_schema"],
  updatedAt: createdAt,
};

describe("PostgreSQL inventory schema and codecs", () => {
  it("declares the inventory PostgreSQL tables and storage schemas", () => {
    expect(postgresInventoryItemTableName).toBe("inventory_item");
    expect(postgresInventoryItem.id).toBeDefined();
    expect(postgresInventoryStockLocationTableName).toBe(
      "inventory_stock_location"
    );
    expect(postgresInventoryStockLocation.salesChannelIdsJson).toBeDefined();
    expect(
      Schema.decodeUnknownSync(InventoryItemPostgresRowSchema)({
        ...inventoryItem,
        metadataJson: inventoryItem.metadata,
      })
    ).toMatchObject({ id: "iitem_schema" });
    expect(
      Schema.decodeUnknownSync(StockLocationPostgresRowSchema)({
        ...stockLocation,
        metadataJson: stockLocation.metadata,
        salesChannelIdsJson: stockLocation.salesChannelIds,
      })
    ).toMatchObject({ id: "sloc_schema" });
  });

  it("preserves inventory invariants at the PostgreSQL storage boundary", () => {
    const invalidItemId = Schema.decodeUnknownExit(
      InventoryItemPostgresRowSchema
    )({
      ...inventoryItem,
      id: "invalid",
      metadataJson: {},
    });
    const invalidLocationId = Schema.decodeUnknownExit(
      StockLocationPostgresRowSchema
    )({
      ...stockLocation,
      id: "invalid",
      metadataJson: {},
      salesChannelIdsJson: [],
    });

    expect(Exit.isFailure(invalidItemId)).toBe(true);
    expect(Exit.isFailure(invalidLocationId)).toBe(true);
  });

  it("encodes inventory domain records into PostgreSQL rows", async () => {
    await expect(
      Effect.runPromise(toInventoryItemPostgresInsert(inventoryItem))
    ).resolves.toEqual(
      Schema.decodeUnknownSync(InventoryItemPostgresInsertSchema)({
        ...inventoryItem,
        metadataJson: inventoryItem.metadata,
      })
    );
    await expect(
      Effect.runPromise(toStockLocationPostgresInsert(stockLocation))
    ).resolves.toEqual(
      Schema.decodeUnknownSync(StockLocationPostgresInsertSchema)({
        ...stockLocation,
        metadataJson: stockLocation.metadata,
        salesChannelIdsJson: stockLocation.salesChannelIds,
      })
    );
  });
});
