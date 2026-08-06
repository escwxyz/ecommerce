import { Effect, Layer } from "effect";

import type {
  CurrencyRecord,
  MoneyAmountRecord,
  PriceListId,
  PriceListRecord,
  PricePreferenceRecord,
  PriceRuleRecord,
  PriceSetId,
  PriceSetRecord,
  PricingRepository,
} from "../domain";
import { PricingRepositoryService } from "../domain";

export interface ResettablePricingRepository extends PricingRepository {
  clear(): void;
}

const sortByCreatedAtDescending = <
  TRecord extends { readonly createdAt: Date },
>(
  records: Iterable<TRecord>
): TRecord[] => {
  const sortedRecords: TRecord[] = [];

  for (const record of records) {
    const recordTimestamp = record.createdAt.getTime();
    let insertAt = 0;

    while (insertAt < sortedRecords.length) {
      const currentRecord = sortedRecords[insertAt];

      if (
        !currentRecord ||
        currentRecord.createdAt.getTime() < recordTimestamp
      ) {
        break;
      }

      insertAt += 1;
    }

    sortedRecords.splice(insertAt, 0, record);
  }

  return sortedRecords;
};

export class InMemoryPricingRepository implements ResettablePricingRepository {
  readonly #currencies = new Map<string, CurrencyRecord>();
  readonly #moneyAmounts = new Map<string, MoneyAmountRecord>();
  readonly #priceLists = new Map<string, PriceListRecord>();
  readonly #pricePreferences = new Map<string, PricePreferenceRecord>();
  readonly #priceRules = new Map<string, PriceRuleRecord>();
  readonly #priceSets = new Map<string, PriceSetRecord>();

  clear(): void {
    this.#currencies.clear();
    this.#moneyAmounts.clear();
    this.#priceLists.clear();
    this.#pricePreferences.clear();
    this.#priceRules.clear();
    this.#priceSets.clear();
  }

  findCurrencyByCode(code: string) {
    return Effect.succeed(this.#currencies.get(code) ?? null);
  }

  findMoneyAmountsForPriceSet(priceSetId: PriceSetId) {
    const amounts: MoneyAmountRecord[] = [];

    for (const amount of this.#moneyAmounts.values()) {
      if (amount.priceSetId === priceSetId) {
        amounts.push(amount);
      }
    }

    return Effect.succeed(sortByCreatedAtDescending(amounts));
  }

  findPriceListById(id: PriceListId) {
    return Effect.succeed(this.#priceLists.get(id) ?? null);
  }

  findPriceRulesByPriceListId(priceListId: PriceListId) {
    const rules: PriceRuleRecord[] = [];

    for (const rule of this.#priceRules.values()) {
      if (rule.priceListId === priceListId) {
        rules.push(rule);
      }
    }

    return Effect.succeed(sortByCreatedAtDescending(rules));
  }

  findPriceSetById(id: PriceSetId) {
    return Effect.succeed(this.#priceSets.get(id) ?? null);
  }

  readonly listCurrencies = Effect.sync(() =>
    sortByCreatedAtDescending(this.#currencies.values())
  );

  saveCurrency(currency: CurrencyRecord) {
    return Effect.sync(() => {
      this.#currencies.set(currency.code, currency);
      return currency;
    });
  }

  saveMoneyAmount(amount: MoneyAmountRecord) {
    return Effect.sync(() => {
      this.#moneyAmounts.set(amount.id, amount);
      return amount;
    });
  }

  savePriceList(priceList: PriceListRecord) {
    return Effect.sync(() => {
      this.#priceLists.set(priceList.id, priceList);
      return priceList;
    });
  }

  savePricePreference(preference: PricePreferenceRecord) {
    return Effect.sync(() => {
      this.#pricePreferences.set(preference.id, preference);
      return preference;
    });
  }

  savePriceRule(rule: PriceRuleRecord) {
    return Effect.sync(() => {
      this.#priceRules.set(rule.id, rule);
      return rule;
    });
  }

  savePriceSet(priceSet: PriceSetRecord) {
    return Effect.sync(() => {
      this.#priceSets.set(priceSet.id, priceSet);
      return priceSet;
    });
  }
}

export const createInMemoryPricingRepository = (): PricingRepository =>
  new InMemoryPricingRepository();

export const createResettableInMemoryPricingRepository =
  (): ResettablePricingRepository => new InMemoryPricingRepository();

export const createInMemoryPricingRepositoryLayer = () =>
  Layer.effect(
    PricingRepositoryService,
    Effect.sync(() => new InMemoryPricingRepository() as PricingRepository)
  );

/** Temporary Promise facade until checkout consumes PricingRepository effects directly. */
export const createPricingPromiseRepositoryFromEffectRepository = (
  repository: PricingRepository
) => ({
  findCurrencyByCode: (code: string) =>
    Effect.runPromise(repository.findCurrencyByCode(code)),
  findMoneyAmountsForPriceSet: (priceSetId: PriceSetId) =>
    Effect.runPromise(repository.findMoneyAmountsForPriceSet(priceSetId)),
  findPriceListById: (id: PriceListId) =>
    Effect.runPromise(repository.findPriceListById(id)),
  findPriceRulesByPriceListId: (priceListId: PriceListId) =>
    Effect.runPromise(repository.findPriceRulesByPriceListId(priceListId)),
  findPriceSetById: (id: PriceSetId) =>
    Effect.runPromise(repository.findPriceSetById(id)),
  listCurrencies: () => Effect.runPromise(repository.listCurrencies),
  saveCurrency: (currency: CurrencyRecord) =>
    Effect.runPromise(repository.saveCurrency(currency)),
  saveMoneyAmount: (amount: MoneyAmountRecord) =>
    Effect.runPromise(repository.saveMoneyAmount(amount)),
  savePriceList: (priceList: PriceListRecord) =>
    Effect.runPromise(repository.savePriceList(priceList)),
  savePricePreference: (preference: PricePreferenceRecord) =>
    Effect.runPromise(repository.savePricePreference(preference)),
  savePriceRule: (rule: PriceRuleRecord) =>
    Effect.runPromise(repository.savePriceRule(rule)),
  savePriceSet: (priceSet: PriceSetRecord) =>
    Effect.runPromise(repository.savePriceSet(priceSet)),
});
