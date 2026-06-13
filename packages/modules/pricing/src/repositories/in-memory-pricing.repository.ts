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

  findCurrencyByCode(code: string): Promise<CurrencyRecord | null> {
    return Promise.resolve(this.#currencies.get(code) ?? null);
  }

  findMoneyAmountsForPriceSet(
    priceSetId: PriceSetId
  ): Promise<readonly MoneyAmountRecord[]> {
    const amounts: MoneyAmountRecord[] = [];

    for (const amount of this.#moneyAmounts.values()) {
      if (amount.priceSetId === priceSetId) {
        amounts.push(amount);
      }
    }

    return Promise.resolve(sortByCreatedAtDescending(amounts));
  }

  findPriceListById(id: PriceListId): Promise<PriceListRecord | null> {
    return Promise.resolve(this.#priceLists.get(id) ?? null);
  }

  findPriceRulesByPriceListId(
    priceListId: PriceListId
  ): Promise<readonly PriceRuleRecord[]> {
    const rules: PriceRuleRecord[] = [];

    for (const rule of this.#priceRules.values()) {
      if (rule.priceListId === priceListId) {
        rules.push(rule);
      }
    }

    return Promise.resolve(sortByCreatedAtDescending(rules));
  }

  findPriceSetById(id: PriceSetId): Promise<PriceSetRecord | null> {
    return Promise.resolve(this.#priceSets.get(id) ?? null);
  }

  listCurrencies(): Promise<readonly CurrencyRecord[]> {
    return Promise.resolve(
      sortByCreatedAtDescending(this.#currencies.values())
    );
  }

  saveCurrency(currency: CurrencyRecord): Promise<CurrencyRecord> {
    this.#currencies.set(currency.code, currency);
    return Promise.resolve(currency);
  }

  saveMoneyAmount(amount: MoneyAmountRecord): Promise<MoneyAmountRecord> {
    this.#moneyAmounts.set(amount.id, amount);
    return Promise.resolve(amount);
  }

  savePriceList(priceList: PriceListRecord): Promise<PriceListRecord> {
    this.#priceLists.set(priceList.id, priceList);
    return Promise.resolve(priceList);
  }

  savePricePreference(
    preference: PricePreferenceRecord
  ): Promise<PricePreferenceRecord> {
    this.#pricePreferences.set(preference.id, preference);
    return Promise.resolve(preference);
  }

  savePriceRule(rule: PriceRuleRecord): Promise<PriceRuleRecord> {
    this.#priceRules.set(rule.id, rule);
    return Promise.resolve(rule);
  }

  savePriceSet(priceSet: PriceSetRecord): Promise<PriceSetRecord> {
    this.#priceSets.set(priceSet.id, priceSet);
    return Promise.resolve(priceSet);
  }
}

export const defaultPricingRepository = new InMemoryPricingRepository();

export const createInMemoryPricingRepository = (): PricingRepository =>
  new InMemoryPricingRepository();

export const createResettableInMemoryPricingRepository =
  (): ResettablePricingRepository => new InMemoryPricingRepository();
