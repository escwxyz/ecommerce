import { describe, expect, it } from "bun:test";

import { Schema } from "effect";

import {
  FulfillmentApiSchema,
  FulfillmentProviderRecordSchema,
  ShippingOptionListApiSchema,
} from "../domain";

describe("fulfillment Effect schemas", () => {
  it("validates domain identifiers and API ISO datetimes", () => {
    expect(() =>
      Schema.decodeUnknownSync(FulfillmentProviderRecordSchema)({
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "wrong_1",
        isEnabled: true,
        providerKey: "manual",
        providerRecordId: "manual",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      })
    ).toThrow();

    expect(() =>
      Schema.decodeUnknownSync(FulfillmentApiSchema)({
        createdAt: "not-a-date",
        id: "fulf_1",
        idempotencyKey: "fulfillment_1",
        items: [],
        metadata: {},
        orderId: "order_1",
        providerKey: "manual",
        shippingOptionId: "shipopt_1",
        status: "created",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toThrow();
  });

  it("validates shipping option list API records", () => {
    const decoded = Schema.decodeUnknownSync(ShippingOptionListApiSchema)([
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        currencyCode: "USD",
        fulfillmentSetId: "fset_1",
        id: "shipopt_1",
        isEnabled: true,
        metadata: {},
        name: "Ground",
        priceAmount: 500,
        profileId: "shprof_1",
        providerKey: "manual",
        providerServiceId: "ground",
        serviceZoneId: "fzone_1",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    expect(decoded[0]?.id).toBe("shipopt_1");
  });
});
