import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const fulfillmentProviderTableName = "fulfillment_provider" as const;
export const fulfillmentSetTableName = "fulfillment_set" as const;
export const shippingProfileTableName = "shipping_profile" as const;
export const serviceZoneTableName = "service_zone" as const;
export const shippingOptionTableName = "shipping_option" as const;
export const fulfillmentTableName = "fulfillment" as const;
export const shipmentTableName = "shipment" as const;
export const returnShipmentLinkTableName = "return_shipment_link" as const;

export const fulfillmentProviderKeyIndexName =
  "fulfillment_provider_key_idx" as const;
export const shippingProfileSetIndexName = "shipping_profile_set_idx" as const;
export const serviceZoneSetIndexName = "service_zone_set_idx" as const;
export const shippingOptionSetIndexName = "shipping_option_set_idx" as const;
export const shippingOptionProviderIndexName =
  "shipping_option_provider_idx" as const;
export const fulfillmentIdempotencyIndexName =
  "fulfillment_idempotency_idx" as const;
export const fulfillmentOrderIndexName = "fulfillment_order_idx" as const;
export const shipmentFulfillmentIndexName = "shipment_fulfillment_idx" as const;
export const returnShipmentFulfillmentIndexName =
  "return_shipment_fulfillment_idx" as const;

type TimestampMsColumn = ColumnType<number, number, number>;
type BooleanColumn = ColumnType<number, number, number>;

export interface FulfillmentProviderTable {
  created_at: TimestampMsColumn;
  id: string;
  is_enabled: BooleanColumn;
  provider_key: string;
  provider_record_id: string;
  updated_at: TimestampMsColumn;
}

export interface FulfillmentSetTable {
  created_at: TimestampMsColumn;
  id: string;
  metadata_json: string;
  name: string;
  updated_at: TimestampMsColumn;
}

export interface ShippingProfileTable {
  created_at: TimestampMsColumn;
  fulfillment_set_id: string;
  id: string;
  metadata_json: string;
  name: string;
  updated_at: TimestampMsColumn;
}

export interface ServiceZoneTable {
  country_codes_json: string;
  created_at: TimestampMsColumn;
  fulfillment_set_id: string;
  id: string;
  metadata_json: string;
  name: string;
  region_ids_json: string;
  updated_at: TimestampMsColumn;
}

export interface ShippingOptionTable {
  created_at: TimestampMsColumn;
  currency_code: string | null;
  fulfillment_set_id: string;
  id: string;
  is_enabled: BooleanColumn;
  metadata_json: string;
  name: string;
  price_amount: number | null;
  profile_id: string;
  provider_key: string;
  provider_service_id: string;
  service_zone_id: string;
  updated_at: TimestampMsColumn;
}

export interface FulfillmentTable {
  address_json: string | null;
  created_at: TimestampMsColumn;
  id: string;
  idempotency_key: string;
  items_json: string;
  metadata_json: string;
  order_id: string;
  provider_fulfillment_id: string | null;
  provider_key: string;
  shipping_option_id: string;
  status: string;
  updated_at: TimestampMsColumn;
}

export interface ShipmentTable {
  carrier: string | null;
  created_at: TimestampMsColumn;
  fulfillment_id: string;
  id: string;
  label_url: string | null;
  metadata_json: string;
  provider_shipment_id: string;
  status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  updated_at: TimestampMsColumn;
}

export interface ReturnShipmentLinkTable {
  created_at: TimestampMsColumn;
  fulfillment_id: string;
  id: string;
  provider_return_id: string | null;
  return_id: string;
  shipment_id: string;
  updated_at: TimestampMsColumn;
}

export interface FulfillmentDatabase {
  fulfillment: FulfillmentTable;
  fulfillment_provider: FulfillmentProviderTable;
  fulfillment_set: FulfillmentSetTable;
  return_shipment_link: ReturnShipmentLinkTable;
  service_zone: ServiceZoneTable;
  shipment: ShipmentTable;
  shipping_option: ShippingOptionTable;
  shipping_profile: ShippingProfileTable;
}

export const fulfillmentSchema = {
  fulfillment: fulfillmentTableName,
  provider: fulfillmentProviderTableName,
  returnShipmentLink: returnShipmentLinkTableName,
  serviceZone: serviceZoneTableName,
  shipment: shipmentTableName,
  shippingOption: shippingOptionTableName,
  shippingProfile: shippingProfileTableName,
  set: fulfillmentSetTableName,
} as const;

export type FulfillmentProviderRow = Selectable<FulfillmentProviderTable>;
export type FulfillmentProviderInsert = Insertable<FulfillmentProviderTable>;
export type FulfillmentSetRow = Selectable<FulfillmentSetTable>;
export type FulfillmentSetInsert = Insertable<FulfillmentSetTable>;
export type ShippingProfileRow = Selectable<ShippingProfileTable>;
export type ShippingProfileInsert = Insertable<ShippingProfileTable>;
export type ServiceZoneRow = Selectable<ServiceZoneTable>;
export type ServiceZoneInsert = Insertable<ServiceZoneTable>;
export type ShippingOptionRow = Selectable<ShippingOptionTable>;
export type ShippingOptionInsert = Insertable<ShippingOptionTable>;
export type FulfillmentRow = Selectable<FulfillmentTable>;
export type FulfillmentInsert = Insertable<FulfillmentTable>;
export type ShipmentRow = Selectable<ShipmentTable>;
export type ShipmentInsert = Insertable<ShipmentTable>;
export type ReturnShipmentLinkRow = Selectable<ReturnShipmentLinkTable>;
export type ReturnShipmentLinkInsert = Insertable<ReturnShipmentLinkTable>;
export type FulfillmentDatabaseSchema = FulfillmentDatabase;
export type FulfillmentSchemaKey = keyof FulfillmentDatabase;

export const fulfillmentMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable(returnShipmentLinkTableName).ifExists().execute();
    await db.schema.dropTable(shipmentTableName).ifExists().execute();
    await db.schema.dropTable(fulfillmentTableName).ifExists().execute();
    await db.schema.dropTable(shippingOptionTableName).ifExists().execute();
    await db.schema.dropTable(serviceZoneTableName).ifExists().execute();
    await db.schema.dropTable(shippingProfileTableName).ifExists().execute();
    await db.schema.dropTable(fulfillmentSetTableName).ifExists().execute();
    await db.schema
      .dropTable(fulfillmentProviderTableName)
      .ifExists()
      .execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable(fulfillmentProviderTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("provider_key", "text", (column) => column.notNull())
      .addColumn("provider_record_id", "text", (column) => column.notNull())
      .addColumn("is_enabled", "integer", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(fulfillmentProviderKeyIndexName)
      .ifNotExists()
      .unique()
      .on(fulfillmentProviderTableName)
      .column("provider_key")
      .execute();

    await db.schema
      .createTable(fulfillmentSetTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createTable(shippingProfileTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("fulfillment_set_id", "text", (column) => column.notNull())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(shippingProfileSetIndexName)
      .ifNotExists()
      .on(shippingProfileTableName)
      .column("fulfillment_set_id")
      .execute();

    await db.schema
      .createTable(serviceZoneTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("fulfillment_set_id", "text", (column) => column.notNull())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("country_codes_json", "text", (column) => column.notNull())
      .addColumn("region_ids_json", "text", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(serviceZoneSetIndexName)
      .ifNotExists()
      .on(serviceZoneTableName)
      .column("fulfillment_set_id")
      .execute();

    await db.schema
      .createTable(shippingOptionTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("fulfillment_set_id", "text", (column) => column.notNull())
      .addColumn("profile_id", "text", (column) => column.notNull())
      .addColumn("service_zone_id", "text", (column) => column.notNull())
      .addColumn("provider_key", "text", (column) => column.notNull())
      .addColumn("provider_service_id", "text", (column) => column.notNull())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("price_amount", "integer")
      .addColumn("currency_code", "text")
      .addColumn("is_enabled", "integer", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(shippingOptionSetIndexName)
      .ifNotExists()
      .on(shippingOptionTableName)
      .column("fulfillment_set_id")
      .execute();

    await db.schema
      .createIndex(shippingOptionProviderIndexName)
      .ifNotExists()
      .on(shippingOptionTableName)
      .columns(["provider_key", "provider_service_id"])
      .execute();

    await db.schema
      .createTable(fulfillmentTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("idempotency_key", "text", (column) => column.notNull())
      .addColumn("order_id", "text", (column) => column.notNull())
      .addColumn("shipping_option_id", "text", (column) => column.notNull())
      .addColumn("provider_key", "text", (column) => column.notNull())
      .addColumn("provider_fulfillment_id", "text")
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("items_json", "text", (column) => column.notNull())
      .addColumn("address_json", "text")
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(fulfillmentIdempotencyIndexName)
      .ifNotExists()
      .unique()
      .on(fulfillmentTableName)
      .column("idempotency_key")
      .execute();

    await db.schema
      .createIndex(fulfillmentOrderIndexName)
      .ifNotExists()
      .on(fulfillmentTableName)
      .column("order_id")
      .execute();

    await db.schema
      .createTable(shipmentTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("fulfillment_id", "text", (column) => column.notNull())
      .addColumn("provider_shipment_id", "text", (column) => column.notNull())
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("carrier", "text")
      .addColumn("tracking_number", "text")
      .addColumn("tracking_url", "text")
      .addColumn("label_url", "text")
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(shipmentFulfillmentIndexName)
      .ifNotExists()
      .on(shipmentTableName)
      .column("fulfillment_id")
      .execute();

    await db.schema
      .createTable(returnShipmentLinkTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("fulfillment_id", "text", (column) => column.notNull())
      .addColumn("shipment_id", "text", (column) => column.notNull())
      .addColumn("return_id", "text", (column) => column.notNull())
      .addColumn("provider_return_id", "text")
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(returnShipmentFulfillmentIndexName)
      .ifNotExists()
      .on(returnShipmentLinkTableName)
      .column("fulfillment_id")
      .execute();
  },
};
