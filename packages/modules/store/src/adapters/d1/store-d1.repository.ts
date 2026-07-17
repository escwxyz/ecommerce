import type { Kysely } from "kysely";

import type {
  StoreDatabase,
  StoreInsert,
  StoreLegacyRepository,
  StoreRow,
  StoreSettings,
} from "../../domain";
import { createStoreId } from "../../domain";

export type StoreD1Database = Kysely<StoreDatabase>;

export interface CreateD1StoreRepositoryOptions {
  readonly db: StoreD1Database;
}

const parseJsonColumn = <Value>(value: string): Value => JSON.parse(value);
const toJsonColumn = (value: unknown): string => JSON.stringify(value);

const toStoreRecord = (row: StoreRow): StoreSettings => ({
  createdAt: new Date(row.created_at),
  defaultCurrencyCode: row.default_currency_code,
  defaultLocale: row.default_locale,
  defaultRegionId: row.default_region_id,
  defaultSalesChannelId: row.default_sales_channel_id,
  id: createStoreId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  name: row.name,
  supportedCurrencyCodes: parseJsonColumn(row.supported_currency_codes_json),
  timezone: row.timezone,
  updatedAt: new Date(row.updated_at),
});

const toStoreInsert = (settings: StoreSettings): StoreInsert => ({
  created_at: settings.createdAt.getTime(),
  default_currency_code: settings.defaultCurrencyCode,
  default_locale: settings.defaultLocale,
  default_region_id: settings.defaultRegionId,
  default_sales_channel_id: settings.defaultSalesChannelId,
  id: settings.id,
  metadata_json: toJsonColumn(settings.metadata),
  name: settings.name,
  supported_currency_codes_json: toJsonColumn(settings.supportedCurrencyCodes),
  timezone: settings.timezone,
  updated_at: settings.updatedAt.getTime(),
});

export const createD1StoreRepository = ({
  db,
}: CreateD1StoreRepositoryOptions): StoreLegacyRepository => ({
  getStoreSettings: async () => {
    const row = await db
      .selectFrom("store")
      .selectAll()
      .orderBy("updated_at", "desc")
      .executeTakeFirst();

    return row ? toStoreRecord(row) : null;
  },
  saveStoreSettings: async (settings) => {
    const values = toStoreInsert(settings);

    await db
      .insertInto("store")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          created_at: values.created_at,
          default_currency_code: values.default_currency_code,
          default_locale: values.default_locale,
          default_region_id: values.default_region_id,
          default_sales_channel_id: values.default_sales_channel_id,
          metadata_json: values.metadata_json,
          name: values.name,
          supported_currency_codes_json: values.supported_currency_codes_json,
          timezone: values.timezone,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return settings;
  },
});
