import { describe, expect, it } from "bun:test";

import { Schema } from "effect";

import {
  InventoryItemApiRecordSchema,
  InventoryItemRecordSchema,
} from "../domain";

describe("inventory Effect schemas", () => {
  it("decodes valid domain and API records", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");

    expect(
      Schema.decodeUnknownSync(InventoryItemRecordSchema)({
        createdAt,
        id: "iitem_schema",
        metadata: {},
        sku: "hat-1",
        title: "Hat",
        updatedAt: createdAt,
      })
    ).toMatchObject({
      id: "iitem_schema",
      sku: "hat-1",
    });
    expect(
      Schema.decodeUnknownSync(InventoryItemApiRecordSchema)({
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "iitem_schema",
        metadata: {},
        sku: "hat-1",
        title: "Hat",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toMatchObject({
      id: "iitem_schema",
      title: "Hat",
    });
  });

  it("rejects invalid identifiers and non-canonical datetime strings", () => {
    expect(() =>
      Schema.decodeUnknownSync(InventoryItemRecordSchema)({
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "bad_schema",
        metadata: {},
        sku: "hat-1",
        title: "Hat",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      })
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(InventoryItemApiRecordSchema)({
        createdAt: "not-a-date",
        id: "iitem_schema",
        metadata: {},
        sku: "hat-1",
        title: "Hat",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toThrow();
  });
});
