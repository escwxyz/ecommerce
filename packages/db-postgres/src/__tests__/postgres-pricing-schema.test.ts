import { describe, expect, it } from "bun:test";

import {
  createCurrencyId,
  createPriceSetId,
  type CurrencyRecord,
  type PriceSetRecord,
} from "@ecommerce/pricing";
import { Effect, Exit, Schema } from "effect";

import {
  PricingCurrencyPostgresInsertSchema,
  PricingCurrencyPostgresRowSchema,
  PricingPriceSetPostgresInsertSchema,
  PricingPriceSetPostgresRowSchema,
  postgresPricingCurrency,
  postgresPricingCurrencyTableName,
  postgresPricingPriceSet,
  postgresPricingPriceSetTableName,
  toPricingCurrencyPostgresInsert,
  toPricingPriceSetPostgresInsert,
} from "../index";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

const currencyRecord: CurrencyRecord = {
  code: "USD",
  createdAt,
  id: createCurrencyId("cur_usd"),
  name: "US Dollar",
  precision: 2,
  updatedAt: createdAt,
};

const priceSetRecord: PriceSetRecord = {
  createdAt,
  id: createPriceSetId("pset_schema"),
  metadata: { source: "schema-test" },
  title: "Schema prices",
  updatedAt: createdAt,
};

describe("PostgreSQL pricing schema and codecs", () => {
  it("declares the pricing PostgreSQL tables and storage schemas", () => {
    expect(postgresPricingCurrencyTableName).toBe("pricing_currency");
    expect(postgresPricingCurrency.id).toBeDefined();
    expect(postgresPricingPriceSetTableName).toBe("pricing_price_set");
    expect(postgresPricingPriceSet.metadataJson).toBeDefined();
    expect(
      Schema.decodeUnknownSync(PricingCurrencyPostgresRowSchema)(currencyRecord)
    ).toEqual(currencyRecord);
    expect(
      Schema.decodeUnknownSync(PricingPriceSetPostgresRowSchema)({
        ...priceSetRecord,
        metadataJson: priceSetRecord.metadata,
      })
    ).toMatchObject({ id: "pset_schema" });
  });

  it("preserves pricing invariants at the PostgreSQL storage boundary", () => {
    const invalidCurrencyId = Schema.decodeUnknownExit(
      PricingCurrencyPostgresRowSchema
    )({
      ...currencyRecord,
      id: "invalid",
    });
    const invalidPriceSetId = Schema.decodeUnknownExit(
      PricingPriceSetPostgresRowSchema
    )({
      ...priceSetRecord,
      id: "invalid",
      metadataJson: {},
    });

    expect(Exit.isFailure(invalidCurrencyId)).toBe(true);
    expect(Exit.isFailure(invalidPriceSetId)).toBe(true);
  });

  it("encodes pricing domain records into PostgreSQL rows", async () => {
    await expect(
      Effect.runPromise(toPricingCurrencyPostgresInsert(currencyRecord))
    ).resolves.toEqual(
      Schema.decodeUnknownSync(PricingCurrencyPostgresInsertSchema)(
        currencyRecord
      )
    );
    await expect(
      Effect.runPromise(toPricingPriceSetPostgresInsert(priceSetRecord))
    ).resolves.toEqual(
      Schema.decodeUnknownSync(PricingPriceSetPostgresInsertSchema)({
        ...priceSetRecord,
        metadataJson: priceSetRecord.metadata,
      })
    );
  });
});
