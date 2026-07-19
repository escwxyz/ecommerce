import { describe, expect, it } from "bun:test";

import { Exit, Schema } from "effect";

import {
  RegionApiRecordSchema,
  RegionRecordSchema,
  SalesChannelApiRecordSchema,
  SalesChannelRecordSchema,
  createRegionId,
  createSalesChannelId,
} from "../domain";

const date = new Date("2026-01-01T00:00:00.000Z");

describe("region sales-channel Effect schemas", () => {
  it("decodes valid region and sales-channel domain records", () => {
    const region = {
      countries: ["US"],
      createdAt: date,
      currencyCode: "USD",
      id: createRegionId("reg_schema"),
      metadata: {},
      name: "United States",
      providerAvailability: {
        fulfillmentOptionIds: ["ship_standard"],
        paymentProviderIds: ["manual"],
        taxProviderId: null,
      },
      updatedAt: date,
    };
    const channel = {
      createdAt: date,
      description: null,
      id: createSalesChannelId("sc_schema"),
      metadata: {},
      name: "Web",
      productIds: ["prod_1"],
      status: "active",
      updatedAt: date,
    } as const;

    expect(Schema.decodeUnknownSync(RegionRecordSchema)(region)).toEqual(
      region
    );
    expect(Schema.decodeUnknownSync(SalesChannelRecordSchema)(channel)).toEqual(
      channel
    );
  });

  it("rejects invalid identifiers, codes, and API date strings", () => {
    const invalidRegion = Schema.decodeUnknownExit(RegionRecordSchema)({
      countries: ["usa"],
      createdAt: date,
      currencyCode: "US",
      id: "invalid",
      metadata: {},
      name: "Invalid",
      providerAvailability: {
        fulfillmentOptionIds: [],
        paymentProviderIds: [],
        taxProviderId: null,
      },
      updatedAt: date,
    });
    const invalidRegionApi = Schema.decodeUnknownExit(RegionApiRecordSchema)({
      countries: ["US"],
      createdAt: "not-a-date",
      currencyCode: "USD",
      id: "reg_api",
      metadata: {},
      name: "United States",
      providerAvailability: {
        fulfillmentOptionIds: [],
        paymentProviderIds: [],
        taxProviderId: null,
      },
      updatedAt: date.toISOString(),
    });
    const invalidChannelApi = Schema.decodeUnknownExit(
      SalesChannelApiRecordSchema
    )({
      createdAt: date.toISOString(),
      description: "",
      id: "sc_api",
      metadata: {},
      name: "Web",
      productIds: [],
      status: "active",
      updatedAt: "not-a-date",
    });

    expect(Exit.isFailure(invalidRegion)).toBe(true);
    expect(Exit.isFailure(invalidRegionApi)).toBe(true);
    expect(Exit.isFailure(invalidChannelApi)).toBe(true);
  });
});
