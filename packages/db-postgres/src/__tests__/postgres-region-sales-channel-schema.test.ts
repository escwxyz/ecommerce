import { describe, expect, it } from "bun:test";

import {
  createRegionId,
  createSalesChannelId,
  type RegionRecord,
  type SalesChannelRecord,
} from "@ecommerce/region-sales-channel";
import { Effect, Exit, Schema } from "effect";

import {
  RegionCountryPostgresInsertSchema,
  RegionPostgresInsertSchema,
  RegionPostgresRowSchema,
  SalesChannelPostgresInsertSchema,
  SalesChannelPostgresRowSchema,
  SalesChannelProductPostgresInsertSchema,
  postgresRegion,
  postgresRegionTableName,
  postgresSalesChannel,
  postgresSalesChannelTableName,
  toRegionCountryPostgresInserts,
  toRegionPostgresInsert,
  toRegionRecord,
  toSalesChannelPostgresInsert,
  toSalesChannelProductPostgresInserts,
  toSalesChannelRecord,
} from "../index";

const date = new Date("2026-01-01T00:00:00.000Z");

const regionRecord: RegionRecord = {
  countries: ["US"],
  createdAt: date,
  currencyCode: "USD",
  id: createRegionId("reg_postgres_schema"),
  metadata: { source: "schema-test" },
  name: "United States",
  providerAvailability: {
    fulfillmentOptionIds: ["ship_standard"],
    paymentProviderIds: ["manual"],
    taxProviderId: null,
  },
  updatedAt: date,
};

const salesChannelRecord: SalesChannelRecord = {
  createdAt: date,
  description: "Default channel",
  id: createSalesChannelId("sc_postgres_schema"),
  metadata: { source: "schema-test" },
  name: "Web",
  productIds: ["prod_1"],
  status: "active",
  updatedAt: date,
};

describe("PostgreSQL region sales-channel schema and codecs", () => {
  it("declares PostgreSQL tables and generated storage schemas", () => {
    expect(postgresRegionTableName).toBe("region");
    expect(postgresSalesChannelTableName).toBe("sales_channel");
    expect(postgresRegion.id).toBeDefined();
    expect(postgresSalesChannel.id).toBeDefined();

    expect(
      Schema.decodeUnknownSync(RegionPostgresRowSchema)({
        createdAt: date,
        currencyCode: "USD",
        fulfillmentOptionIdsJson: ["ship_standard"],
        id: "reg_row",
        metadataJson: {},
        name: "United States",
        paymentProviderIdsJson: ["manual"],
        taxProviderId: null,
        updatedAt: date,
      })
    ).toMatchObject({ id: "reg_row" });
    expect(
      Schema.decodeUnknownSync(SalesChannelPostgresRowSchema)({
        createdAt: date,
        description: null,
        id: "sc_row",
        metadataJson: {},
        name: "Web",
        status: "active",
        updatedAt: date,
      })
    ).toMatchObject({ id: "sc_row" });
  });

  it("preserves invariants at the PostgreSQL storage boundary", () => {
    const invalidRegion = Schema.decodeUnknownExit(RegionPostgresInsertSchema)({
      createdAt: date,
      currencyCode: "US",
      fulfillmentOptionIdsJson: [],
      id: "invalid",
      metadataJson: {},
      name: "Invalid",
      paymentProviderIdsJson: [],
      taxProviderId: null,
      updatedAt: date,
    });
    const invalidCountry = Schema.decodeUnknownExit(
      RegionCountryPostgresInsertSchema
    )({
      countryCode: "usa",
      regionId: "reg_row",
    });
    const invalidChannel = Schema.decodeUnknownExit(
      SalesChannelPostgresInsertSchema
    )({
      createdAt: date,
      description: null,
      id: "invalid",
      metadataJson: {},
      name: "Web",
      status: "unknown",
      updatedAt: date,
    });
    const invalidProduct = Schema.decodeUnknownExit(
      SalesChannelProductPostgresInsertSchema
    )({
      productId: "",
      salesChannelId: "sc_row",
    });

    expect(Exit.isFailure(invalidRegion)).toBe(true);
    expect(Exit.isFailure(invalidCountry)).toBe(true);
    expect(Exit.isFailure(invalidChannel)).toBe(true);
    expect(Exit.isFailure(invalidProduct)).toBe(true);
  });

  it("round-trips between domain records and PostgreSQL rows", async () => {
    const regionInsert = await Effect.runPromise(
      toRegionPostgresInsert(regionRecord)
    );
    const regionCountries = await Effect.runPromise(
      toRegionCountryPostgresInserts(regionRecord)
    );
    const region = await Effect.runPromise(
      toRegionRecord({
        countries: regionCountries,
        row: regionInsert,
      })
    );
    const salesChannelInsert = await Effect.runPromise(
      toSalesChannelPostgresInsert(salesChannelRecord)
    );
    const salesChannelProducts = await Effect.runPromise(
      toSalesChannelProductPostgresInserts(salesChannelRecord)
    );
    const salesChannel = await Effect.runPromise(
      toSalesChannelRecord({
        products: salesChannelProducts,
        row: salesChannelInsert,
      })
    );

    expect(region).toEqual(regionRecord);
    expect(salesChannel).toEqual(salesChannelRecord);
  });
});
