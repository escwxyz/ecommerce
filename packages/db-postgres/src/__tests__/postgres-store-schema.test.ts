import { describe, expect, it } from "bun:test";

import { createStoreId, type StoreSettings } from "@ecommerce/store";
import { Effect, Exit, Schema } from "effect";

import {
  postgresStore,
  postgresStoreTableName,
  StorePostgresInsertSchema,
  StorePostgresRowSchema,
  toStorePostgresInsert,
  toStoreSettings,
} from "../index";

const storeSettings: StoreSettings = {
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  defaultCurrencyCode: "USD",
  defaultLocale: "en-US",
  defaultRegionId: null,
  defaultSalesChannelId: "sc_web",
  id: createStoreId("store_postgres_schema"),
  metadata: { organizationHint: "org_demo" },
  name: "PostgreSQL Store",
  supportedCurrencyCodes: ["USD", "EUR"],
  timezone: "UTC",
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const postgresRow = {
  createdAt: storeSettings.createdAt,
  defaultCurrencyCode: storeSettings.defaultCurrencyCode,
  defaultLocale: storeSettings.defaultLocale,
  defaultRegionId: storeSettings.defaultRegionId,
  defaultSalesChannelId: storeSettings.defaultSalesChannelId,
  id: storeSettings.id,
  metadataJson: storeSettings.metadata,
  name: storeSettings.name,
  supportedCurrencyCodesJson: storeSettings.supportedCurrencyCodes,
  timezone: storeSettings.timezone,
  updatedAt: storeSettings.updatedAt,
};

describe("PostgreSQL store schema and codecs", () => {
  it("declares the store PostgreSQL table and generated storage schemas", () => {
    expect(postgresStoreTableName).toBe("store");
    expect(postgresStore.id).toBeDefined();
    expect(postgresStore.supportedCurrencyCodesJson).toBeDefined();
    expect(
      Schema.decodeUnknownSync(StorePostgresRowSchema)(postgresRow)
    ).toEqual(postgresRow);
    expect(
      Schema.decodeUnknownSync(StorePostgresInsertSchema)(postgresRow)
    ).toEqual(postgresRow);
  });

  it("preserves store invariants at the PostgreSQL storage boundary", () => {
    const invalidCurrencyList = Schema.decodeUnknownExit(
      StorePostgresRowSchema
    )({
      ...postgresRow,
      supportedCurrencyCodesJson: [],
    });
    const invalidDate = Schema.decodeUnknownExit(StorePostgresRowSchema)({
      ...postgresRow,
      createdAt: "not-a-date",
    });

    expect(Exit.isFailure(invalidCurrencyList)).toBe(true);
    expect(Exit.isFailure(invalidDate)).toBe(true);
  });

  it("round-trips between store domain settings and PostgreSQL rows", async () => {
    const insert = await Effect.runPromise(
      toStorePostgresInsert(storeSettings)
    );
    const decoded = await Effect.runPromise(toStoreSettings(insert));

    expect(insert).toEqual(postgresRow);
    expect(decoded).toEqual(storeSettings);
  });
});
