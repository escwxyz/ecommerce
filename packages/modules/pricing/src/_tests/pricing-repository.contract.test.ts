import { describe, expect, it } from "bun:test";

import {
  createCurrencyId,
  createMoneyAmountId,
  createPriceSetId,
  type PricingRepository,
} from "../domain";
import { createResettableInMemoryPricingRepository } from "../repositories";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

describe("pricing repository contracts", () => {
  it("saves and reads currencies by code", async () => {
    const repository: PricingRepository =
      createResettableInMemoryPricingRepository();
    const currency = {
      code: "USD",
      createdAt,
      id: createCurrencyId("cur_usd"),
      name: "US Dollar",
      precision: 2,
      updatedAt: createdAt,
    };

    await expect(repository.saveCurrency(currency)).resolves.toEqual(currency);
    await expect(repository.findCurrencyByCode("USD")).resolves.toEqual(
      currency
    );
    await expect(repository.listCurrencies()).resolves.toEqual([currency]);
  });

  it("saves and reads money amounts by price set", async () => {
    const repository: PricingRepository =
      createResettableInMemoryPricingRepository();
    const priceSet = {
      createdAt,
      id: createPriceSetId("pset_contract"),
      metadata: {},
      title: "Variant prices",
      updatedAt: createdAt,
    };
    const amount = {
      amount: 2500,
      createdAt,
      currencyCode: "USD",
      id: createMoneyAmountId("amt_contract"),
      priceListId: null,
      priceSetId: priceSet.id,
      rules: {},
      updatedAt: createdAt,
    };

    await repository.savePriceSet(priceSet);
    await expect(repository.saveMoneyAmount(amount)).resolves.toEqual(amount);
    await expect(
      repository.findMoneyAmountsForPriceSet(priceSet.id)
    ).resolves.toEqual([amount]);
  });
});
