import type { Insertable, Kysely } from "kysely";

import type {
  RegionCountryInsert,
  RegionRecord,
  RegionRepository,
  RegionRow,
  RegionSalesChannelDatabase,
  SalesChannelProductInsert,
  SalesChannelRecord,
  SalesChannelRepository,
  SalesChannelRow,
} from "../../domain";
import { createRegionId, createSalesChannelId } from "../../domain";

export type RegionSalesChannelD1Database = Kysely<RegionSalesChannelDatabase>;

export interface CreateD1RegionSalesChannelRepositoryOptions {
  readonly db: RegionSalesChannelD1Database;
}

const parseJsonColumn = <Value>(value: string): Value => JSON.parse(value);
const toJsonColumn = (value: unknown): string => JSON.stringify(value);

const insertValues = async <Table extends keyof RegionSalesChannelDatabase>(
  db: RegionSalesChannelD1Database,
  table: Table,
  values: readonly Insertable<RegionSalesChannelDatabase[Table]>[]
): Promise<void> => {
  if (values.length === 0) {
    return;
  }

  await db.insertInto(table).values(values).execute();
};

const toRegionRecord = (
  row: RegionRow,
  countries: readonly string[]
): RegionRecord => ({
  countries: [...countries],
  createdAt: new Date(row.created_at),
  currencyCode: row.currency_code,
  id: createRegionId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  name: row.name,
  providerAvailability: {
    fulfillmentOptionIds: parseJsonColumn(row.fulfillment_option_ids_json),
    paymentProviderIds: parseJsonColumn(row.payment_provider_ids_json),
    taxProviderId: row.tax_provider_id,
  },
  updatedAt: new Date(row.updated_at),
});

const toSalesChannelRecord = (
  row: SalesChannelRow,
  productIds: readonly string[]
): SalesChannelRecord => ({
  createdAt: new Date(row.created_at),
  description: row.description,
  id: createSalesChannelId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  name: row.name,
  productIds: [...productIds],
  status: row.status as SalesChannelRecord["status"],
  updatedAt: new Date(row.updated_at),
});

export const createD1RegionSalesChannelRepository = ({
  db,
}: CreateD1RegionSalesChannelRepositoryOptions): RegionRepository &
  SalesChannelRepository => ({
  findRegionById: async (id) => {
    const row = await db
      .selectFrom("region")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    const countryRows = await db
      .selectFrom("region_country")
      .select("country_code")
      .where("region_id", "=", id)
      .orderBy("country_code", "asc")
      .execute();

    return toRegionRecord(
      row,
      countryRows.map((countryRow) => countryRow.country_code)
    );
  },
  findSalesChannelById: async (id) => {
    const row = await db
      .selectFrom("sales_channel")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    const productRows = await db
      .selectFrom("sales_channel_product")
      .select("product_id")
      .where("sales_channel_id", "=", id)
      .orderBy("product_id", "asc")
      .execute();

    return toSalesChannelRecord(
      row,
      productRows.map((productRow) => productRow.product_id)
    );
  },
  listRegions: async () => {
    const rows = await db
      .selectFrom("region")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    return Promise.all(
      rows.map(async (row) => {
        const countryRows = await db
          .selectFrom("region_country")
          .select("country_code")
          .where("region_id", "=", row.id)
          .orderBy("country_code", "asc")
          .execute();

        return toRegionRecord(
          row,
          countryRows.map((countryRow) => countryRow.country_code)
        );
      })
    );
  },
  listSalesChannels: async () => {
    const rows = await db
      .selectFrom("sales_channel")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    return Promise.all(
      rows.map(async (row) => {
        const productRows = await db
          .selectFrom("sales_channel_product")
          .select("product_id")
          .where("sales_channel_id", "=", row.id)
          .orderBy("product_id", "asc")
          .execute();

        return toSalesChannelRecord(
          row,
          productRows.map((productRow) => productRow.product_id)
        );
      })
    );
  },
  saveRegion: async (region) => {
    const regionValues = {
      created_at: region.createdAt.getTime(),
      currency_code: region.currencyCode,
      fulfillment_option_ids_json: toJsonColumn(
        region.providerAvailability.fulfillmentOptionIds
      ),
      id: region.id,
      metadata_json: toJsonColumn(region.metadata),
      name: region.name,
      payment_provider_ids_json: toJsonColumn(
        region.providerAvailability.paymentProviderIds
      ),
      tax_provider_id: region.providerAvailability.taxProviderId,
      updated_at: region.updatedAt.getTime(),
    } as const;

    await db
      .insertInto("region")
      .values(regionValues)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          created_at: regionValues.created_at,
          currency_code: regionValues.currency_code,
          fulfillment_option_ids_json: regionValues.fulfillment_option_ids_json,
          metadata_json: regionValues.metadata_json,
          name: regionValues.name,
          payment_provider_ids_json: regionValues.payment_provider_ids_json,
          tax_provider_id: regionValues.tax_provider_id,
          updated_at: regionValues.updated_at,
        })
      )
      .execute();

    await db
      .deleteFrom("region_country")
      .where("region_id", "=", region.id)
      .execute();

    await insertValues(
      db,
      "region_country",
      region.countries.map(
        (countryCode) =>
          ({
            country_code: countryCode,
            region_id: region.id,
          }) satisfies RegionCountryInsert
      )
    );

    return region;
  },
  saveSalesChannel: async (channel) => {
    const salesChannelValues = {
      created_at: channel.createdAt.getTime(),
      description: channel.description,
      id: channel.id,
      metadata_json: toJsonColumn(channel.metadata),
      name: channel.name,
      status: channel.status,
      updated_at: channel.updatedAt.getTime(),
    } as const;

    await db
      .insertInto("sales_channel")
      .values(salesChannelValues)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          created_at: salesChannelValues.created_at,
          description: salesChannelValues.description,
          metadata_json: salesChannelValues.metadata_json,
          name: salesChannelValues.name,
          status: salesChannelValues.status,
          updated_at: salesChannelValues.updated_at,
        })
      )
      .execute();

    await db
      .deleteFrom("sales_channel_product")
      .where("sales_channel_id", "=", channel.id)
      .execute();

    await insertValues(
      db,
      "sales_channel_product",
      channel.productIds.map(
        (productId) =>
          ({
            product_id: productId,
            sales_channel_id: channel.id,
          }) satisfies SalesChannelProductInsert
      )
    );

    return channel;
  },
});
