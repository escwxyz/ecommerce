import type {
  TaxCategoryId,
  TaxCategoryRecord,
  TaxProviderConfigId,
  TaxProviderConfigRecord,
  TaxRateRecord,
  TaxRegionId,
  TaxRegionRecord,
  TaxRepository,
} from "../domain";

export interface ResettableTaxRepository extends TaxRepository {
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

export class InMemoryTaxRepository implements ResettableTaxRepository {
  readonly #categories = new Map<string, TaxCategoryRecord>();
  readonly #providerConfigs = new Map<string, TaxProviderConfigRecord>();
  readonly #rates = new Map<string, TaxRateRecord>();
  readonly #regions = new Map<string, TaxRegionRecord>();

  clear(): void {
    this.#categories.clear();
    this.#providerConfigs.clear();
    this.#rates.clear();
    this.#regions.clear();
  }

  findActiveProviderConfigByKey(
    providerKey: string
  ): Promise<TaxProviderConfigRecord | null> {
    for (const providerConfig of this.#providerConfigs.values()) {
      if (
        providerConfig.providerKey === providerKey &&
        providerConfig.isActive
      ) {
        return Promise.resolve(providerConfig);
      }
    }

    return Promise.resolve(null);
  }

  findCategoryById(id: TaxCategoryId): Promise<TaxCategoryRecord | null> {
    return Promise.resolve(this.#categories.get(id) ?? null);
  }

  findProviderConfigById(
    id: TaxProviderConfigId
  ): Promise<TaxProviderConfigRecord | null> {
    return Promise.resolve(this.#providerConfigs.get(id) ?? null);
  }

  findRatesByRegionId(
    regionId: TaxRegionId
  ): Promise<readonly TaxRateRecord[]> {
    const rates: TaxRateRecord[] = [];

    for (const rate of this.#rates.values()) {
      if (rate.regionId === regionId) {
        rates.push(rate);
      }
    }

    return Promise.resolve(sortByCreatedAtDescending(rates));
  }

  findRegionById(id: TaxRegionId): Promise<TaxRegionRecord | null> {
    return Promise.resolve(this.#regions.get(id) ?? null);
  }

  saveCategory(category: TaxCategoryRecord): Promise<TaxCategoryRecord> {
    this.#categories.set(category.id, category);
    return Promise.resolve(category);
  }

  saveProviderConfig(
    providerConfig: TaxProviderConfigRecord
  ): Promise<TaxProviderConfigRecord> {
    this.#providerConfigs.set(providerConfig.id, providerConfig);
    return Promise.resolve(providerConfig);
  }

  saveRate(rate: TaxRateRecord): Promise<TaxRateRecord> {
    this.#rates.set(rate.id, rate);
    return Promise.resolve(rate);
  }

  saveRegion(region: TaxRegionRecord): Promise<TaxRegionRecord> {
    this.#regions.set(region.id, region);
    return Promise.resolve(region);
  }
}

export const defaultTaxRepository = new InMemoryTaxRepository();

export const createInMemoryTaxRepository = (): TaxRepository =>
  new InMemoryTaxRepository();

export const createResettableInMemoryTaxRepository =
  (): ResettableTaxRepository => new InMemoryTaxRepository();
