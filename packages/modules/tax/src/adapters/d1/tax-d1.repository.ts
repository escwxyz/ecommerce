import type { Insertable, Kysely } from "kysely";

import type {
  TaxCategoryId,
  TaxCategoryRecord,
  TaxCategoryRow,
  TaxDatabase,
  TaxProviderConfigId,
  TaxProviderConfigRecord,
  TaxProviderConfigRow,
  TaxRateRecord,
  TaxRateRow,
  TaxRegionId,
  TaxRegionRecord,
  TaxRegionRow,
  TaxRepository,
} from "../../domain";
import {
  createTaxCategoryId,
  createTaxProviderConfigId,
  createTaxRateId,
  createTaxRegionId,
} from "../../domain";

export type TaxD1Database = Kysely<TaxDatabase>;

export interface CreateD1TaxRepositoryOptions {
  readonly db: TaxD1Database;
}

const parseJsonColumn = <Value>(value: string): Value => JSON.parse(value);
const toJsonColumn = (value: unknown): string => JSON.stringify(value);
const toBooleanColumn = (value: boolean): number => (value ? 1 : 0);
const fromBooleanColumn = (value: number): boolean => value === 1;

const toCategory = (row: TaxCategoryRow): TaxCategoryRecord => ({
  code: row.code,
  createdAt: new Date(row.created_at),
  description: row.description,
  id: createTaxCategoryId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  name: row.name,
  updatedAt: new Date(row.updated_at),
});

const toProviderConfig = (
  row: TaxProviderConfigRow
): TaxProviderConfigRecord => ({
  createdAt: new Date(row.created_at),
  id: createTaxProviderConfigId(row.id),
  isActive: fromBooleanColumn(row.is_active),
  metadata: parseJsonColumn(row.metadata_json),
  providerKey: row.provider_key,
  settings: parseJsonColumn(row.settings_json),
  updatedAt: new Date(row.updated_at),
});

const toRate = (row: TaxRateRow): TaxRateRecord => ({
  categoryId: row.category_id ? createTaxCategoryId(row.category_id) : null,
  createdAt: new Date(row.created_at),
  id: createTaxRateId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  name: row.name,
  percentage: row.percentage,
  regionId: createTaxRegionId(row.region_id),
  updatedAt: new Date(row.updated_at),
});

const toRegion = (row: TaxRegionRow): TaxRegionRecord => ({
  code: row.code,
  countryCode: row.country_code,
  createdAt: new Date(row.created_at),
  id: createTaxRegionId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  name: row.name,
  providerConfigId: row.provider_config_id
    ? createTaxProviderConfigId(row.provider_config_id)
    : null,
  updatedAt: new Date(row.updated_at),
});

const toCategoryInsert = (
  category: TaxCategoryRecord
): Insertable<TaxDatabase["tax_category"]> => ({
  code: category.code,
  created_at: category.createdAt.getTime(),
  description: category.description,
  id: category.id,
  metadata_json: toJsonColumn(category.metadata),
  name: category.name,
  updated_at: category.updatedAt.getTime(),
});

const toProviderConfigInsert = (
  providerConfig: TaxProviderConfigRecord
): Insertable<TaxDatabase["tax_provider_config"]> => ({
  created_at: providerConfig.createdAt.getTime(),
  id: providerConfig.id,
  is_active: toBooleanColumn(providerConfig.isActive),
  metadata_json: toJsonColumn(providerConfig.metadata),
  provider_key: providerConfig.providerKey,
  settings_json: toJsonColumn(providerConfig.settings),
  updated_at: providerConfig.updatedAt.getTime(),
});

const toRateInsert = (
  rate: TaxRateRecord
): Insertable<TaxDatabase["tax_rate"]> => ({
  category_id: rate.categoryId,
  created_at: rate.createdAt.getTime(),
  id: rate.id,
  metadata_json: toJsonColumn(rate.metadata),
  name: rate.name,
  percentage: rate.percentage,
  region_id: rate.regionId,
  updated_at: rate.updatedAt.getTime(),
});

const toRegionInsert = (
  region: TaxRegionRecord
): Insertable<TaxDatabase["tax_region"]> => ({
  code: region.code,
  country_code: region.countryCode,
  created_at: region.createdAt.getTime(),
  id: region.id,
  metadata_json: toJsonColumn(region.metadata),
  name: region.name,
  provider_config_id: region.providerConfigId,
  updated_at: region.updatedAt.getTime(),
});

export const createD1TaxRepository = ({
  db,
}: CreateD1TaxRepositoryOptions): TaxRepository => ({
  findActiveProviderConfigByKey: async (providerKey) => {
    const row = await db
      .selectFrom("tax_provider_config")
      .selectAll()
      .where("provider_key", "=", providerKey)
      .where("is_active", "=", 1)
      .executeTakeFirst();

    return row ? toProviderConfig(row) : null;
  },
  findCategoryById: async (id: TaxCategoryId) => {
    const row = await db
      .selectFrom("tax_category")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toCategory(row) : null;
  },
  findProviderConfigById: async (id: TaxProviderConfigId) => {
    const row = await db
      .selectFrom("tax_provider_config")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toProviderConfig(row) : null;
  },
  findRatesByRegionId: async (regionId: TaxRegionId) => {
    const rows = await db
      .selectFrom("tax_rate")
      .selectAll()
      .where("region_id", "=", regionId)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toRate);
  },
  findRegionById: async (id: TaxRegionId) => {
    const row = await db
      .selectFrom("tax_region")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toRegion(row) : null;
  },
  saveCategory: async (category) => {
    await db
      .insertInto("tax_category")
      .values(toCategoryInsert(category))
      .onConflict((oc) =>
        oc.column("id").doUpdateSet(toCategoryInsert(category))
      )
      .execute();

    return category;
  },
  saveProviderConfig: async (providerConfig) => {
    await db
      .insertInto("tax_provider_config")
      .values(toProviderConfigInsert(providerConfig))
      .onConflict((oc) =>
        oc.column("id").doUpdateSet(toProviderConfigInsert(providerConfig))
      )
      .execute();

    return providerConfig;
  },
  saveRate: async (rate) => {
    await db
      .insertInto("tax_rate")
      .values(toRateInsert(rate))
      .onConflict((oc) => oc.column("id").doUpdateSet(toRateInsert(rate)))
      .execute();

    return rate;
  },
  saveRegion: async (region) => {
    await db
      .insertInto("tax_region")
      .values(toRegionInsert(region))
      .onConflict((oc) => oc.column("id").doUpdateSet(toRegionInsert(region)))
      .execute();

    return region;
  },
});
