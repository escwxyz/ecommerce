import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  createCurrencyId,
  createMoneyAmountId,
  createPriceListId,
  createPricePreferenceId,
  createPriceRuleId,
  createPriceSetId,
} from "../domain";
import type {
  CurrencyRecord,
  MoneyAmountRecord,
  PriceListRecord,
  PriceRuleRecord,
  PricingRepository,
} from "../domain";
import { createInMemoryPricingRepository } from "../repositories";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

const createCurrency = (code: string): CurrencyRecord => ({
  code,
  createdAt,
  id: createCurrencyId(`cur_${code.toLowerCase()}`),
  name: `${code} Currency`,
  precision: 2,
  updatedAt: createdAt,
});

const createPriceSet = (id: string) => ({
  createdAt,
  id: createPriceSetId(id),
  metadata: {},
  title: `Price Set ${id}`,
  updatedAt: createdAt,
});

const createPriceList = (id: string): PriceListRecord => ({
  createdAt,
  description: null,
  endsAt: null,
  id: createPriceListId(id),
  startsAt: null,
  status: "active",
  title: `Price List ${id}`,
  updatedAt: createdAt,
});

const runPricingRepositoryContract = (
  name: string,
  createRepository: () => PricingRepository
) => {
  describe(name, () => {
    it("saves and reads currencies by code", async () => {
      const repository = createRepository();
      const currency = createCurrency("USD");

      await expect(
        Effect.runPromise(repository.saveCurrency(currency))
      ).resolves.toEqual(currency);
      await expect(
        Effect.runPromise(repository.findCurrencyByCode("USD"))
      ).resolves.toEqual(currency);
      await expect(
        Effect.runPromise(repository.listCurrencies)
      ).resolves.toEqual([currency]);
    });

    it("saves and reads money amounts by price set", async () => {
      const repository = createRepository();
      const priceSet = createPriceSet("pset_contract");
      const amount: MoneyAmountRecord = {
        amount: 2500,
        createdAt,
        currencyCode: "USD",
        id: createMoneyAmountId("amt_contract"),
        priceListId: null,
        priceSetId: priceSet.id,
        rules: {},
        updatedAt: createdAt,
      };

      await Effect.runPromise(repository.savePriceSet(priceSet));
      await expect(
        Effect.runPromise(repository.saveMoneyAmount(amount))
      ).resolves.toEqual(amount);
      await expect(
        Effect.runPromise(repository.findMoneyAmountsForPriceSet(priceSet.id))
      ).resolves.toEqual([amount]);
      await expect(
        Effect.runPromise(repository.findPriceSetById(priceSet.id))
      ).resolves.toEqual(priceSet);
    });

    it("saves and reads price lists, rules, and preferences", async () => {
      const repository = createRepository();
      const priceList = createPriceList("plist_contract");
      const rule: PriceRuleRecord = {
        attribute: "region",
        createdAt,
        id: createPriceRuleId("prule_contract"),
        priceListId: priceList.id,
        updatedAt: createdAt,
        value: "EU",
      };
      const preference = {
        attribute: "region",
        createdAt,
        currencyCode: "EUR",
        id: createPricePreferenceId("ppref_contract"),
        updatedAt: createdAt,
        value: "EU",
      };

      await expect(
        Effect.runPromise(repository.savePriceList(priceList))
      ).resolves.toEqual(priceList);
      await expect(
        Effect.runPromise(repository.findPriceListById(priceList.id))
      ).resolves.toEqual(priceList);
      await expect(
        Effect.runPromise(repository.savePriceRule(rule))
      ).resolves.toEqual(rule);
      await expect(
        Effect.runPromise(repository.findPriceRulesByPriceListId(priceList.id))
      ).resolves.toEqual([rule]);
      await expect(
        Effect.runPromise(repository.savePricePreference(preference))
      ).resolves.toEqual(preference);
    });
  });
};

runPricingRepositoryContract("in-memory pricing repository", () =>
  createInMemoryPricingRepository()
);
