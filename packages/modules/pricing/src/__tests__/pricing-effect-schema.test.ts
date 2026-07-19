import { describe, expect, it } from "bun:test";

import { Schema } from "effect";

import {
  CalculatedPriceApiSchema,
  CurrencyApiRecordSchema,
  CurrencyIdSchema,
  PriceSetApiRecordSchema,
} from "../domain";

describe("pricing Effect schemas", () => {
  it("decodes branded domain identifiers and rejects invalid prefixes", () => {
    expect(String(Schema.decodeUnknownSync(CurrencyIdSchema)("cur_usd"))).toBe(
      "cur_usd"
    );
    expect(() =>
      Schema.decodeUnknownSync(CurrencyIdSchema)("currency_usd")
    ).toThrow();
  });

  it("validates canonical ISO API timestamps", () => {
    expect(
      Schema.decodeUnknownSync(CurrencyApiRecordSchema)({
        code: "USD",
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "cur_usd",
        name: "US Dollar",
        precision: 2,
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toMatchObject({ code: "USD" });

    expect(() =>
      Schema.decodeUnknownSync(PriceSetApiRecordSchema)({
        createdAt: "not-a-date",
        id: "pset_hat",
        metadata: {},
        title: "Hat prices",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toThrow();
  });

  it("validates calculated price trace payloads", () => {
    expect(
      Schema.decodeUnknownSync(CalculatedPriceApiSchema)({
        amount: 2500,
        currencyCode: "USD",
        priceSetId: "pset_hat",
        quantity: 2,
        subtotal: 5000,
        trace: {
          moneyAmountId: "amt_hat",
          priceListId: null,
          ruleMatches: [],
          source: "base",
        },
      })
    ).toMatchObject({
      subtotal: 5000,
      trace: { source: "base" },
    });
  });
});
