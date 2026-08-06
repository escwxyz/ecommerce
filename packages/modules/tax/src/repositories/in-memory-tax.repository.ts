import { Layer, Effect } from "effect";

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
import { TaxRepositoryService } from "../domain";

export interface ResettableTaxRepository extends TaxRepository {
  readonly clear: Effect.Effect<void>;
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

  readonly clear = Effect.sync(() => {
    this.#categories.clear();
    this.#providerConfigs.clear();
    this.#rates.clear();
    this.#regions.clear();
  });

  readonly findActiveProviderConfigByKey = (providerKey: string) =>
    Effect.sync(() => {
      for (const providerConfig of this.#providerConfigs.values()) {
        if (
          providerConfig.providerKey === providerKey &&
          providerConfig.isActive
        ) {
          return providerConfig;
        }
      }

      return null;
    });

  readonly findCategoryById = (id: TaxCategoryId) =>
    Effect.sync(() => this.#categories.get(id) ?? null);

  readonly findProviderConfigById = (id: TaxProviderConfigId) =>
    Effect.sync(() => this.#providerConfigs.get(id) ?? null);

  readonly findRatesByRegionId = (regionId: TaxRegionId) =>
    Effect.sync(() => {
      const rates: TaxRateRecord[] = [];

      for (const rate of this.#rates.values()) {
        if (rate.regionId === regionId) {
          rates.push(rate);
        }
      }

      return sortByCreatedAtDescending(rates);
    });

  readonly findRegionById = (id: TaxRegionId) =>
    Effect.sync(() => this.#regions.get(id) ?? null);

  readonly saveCategory = (category: TaxCategoryRecord) =>
    Effect.sync(() => {
      this.#categories.set(category.id, category);
      return category;
    });

  readonly saveProviderConfig = (providerConfig: TaxProviderConfigRecord) =>
    Effect.sync(() => {
      this.#providerConfigs.set(providerConfig.id, providerConfig);
      return providerConfig;
    });

  readonly saveRate = (rate: TaxRateRecord) =>
    Effect.sync(() => {
      this.#rates.set(rate.id, rate);
      return rate;
    });

  readonly saveRegion = (region: TaxRegionRecord) =>
    Effect.sync(() => {
      this.#regions.set(region.id, region);
      return region;
    });
}

export const createInMemoryTaxRepository = (): TaxRepository =>
  new InMemoryTaxRepository();

export const createResettableInMemoryTaxRepository =
  (): ResettableTaxRepository => new InMemoryTaxRepository();

export const createInMemoryTaxRepositoryLayer = (repository: TaxRepository) =>
  Layer.succeed(TaxRepositoryService, repository);
