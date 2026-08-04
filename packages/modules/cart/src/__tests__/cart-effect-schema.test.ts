import { describe, expect, it } from "bun:test";

import { Schema } from "effect";

import { CartApiRecordSchema, CartRecordSchema } from "../domain";

describe("cart Effect schemas", () => {
  it("decodes valid domain and API cart records", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const baseCart = {
      billingAddress: null,
      completedAt: null,
      createdAt: now,
      currencyCode: "USD",
      customerId: null,
      email: null,
      id: "cart_schema",
      metadata: {},
      paymentCollectionId: null,
      regionId: null,
      salesChannelId: null,
      shippingAddress: null,
      shippingOptionId: null,
      status: "active",
      totals: {
        adjustmentTotal: 0,
        currencyCode: "USD",
        discountTotal: 0,
        giftCardTotal: 0,
        itemSubtotal: 0,
        shippingTotal: 0,
        subtotal: 0,
        taxTotal: 0,
        total: 0,
      },
      updatedAt: now,
    };

    expect(Schema.decodeUnknownSync(CartRecordSchema)(baseCart)).toMatchObject({
      id: "cart_schema",
    });
    expect(
      Schema.decodeUnknownSync(CartApiRecordSchema)({
        ...baseCart,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
    ).toMatchObject({
      id: "cart_schema",
    });
  });

  it("rejects invalid IDs and non-canonical API datetimes", () => {
    expect(() =>
      Schema.decodeUnknownSync(CartRecordSchema)({
        id: "bad",
      })
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(CartApiRecordSchema)({
        completedAt: null,
        createdAt: "not-a-date",
        currencyCode: "USD",
        id: "cart_schema",
        metadata: {},
        status: "active",
        totals: {},
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toThrow();
  });
});
