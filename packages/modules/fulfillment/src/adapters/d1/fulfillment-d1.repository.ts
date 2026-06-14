import type { Insertable, Kysely } from "kysely";

import type {
  Fulfillment,
  FulfillmentDatabase,
  FulfillmentId,
  FulfillmentProviderRecord,
  FulfillmentRepository,
  FulfillmentRow,
  FulfillmentSet,
  FulfillmentSetId,
  FulfillmentSetRow,
  ReturnShipmentLink,
  ServiceZone,
  ServiceZoneId,
  ServiceZoneRow,
  ShipmentRecord,
  ShipmentRow,
  ShippingOption,
  ShippingOptionId,
  ShippingOptionRow,
  ShippingProfile,
  ShippingProfileId,
  ShippingProfileRow,
} from "../../domain";
import {
  createFulfillmentId,
  createFulfillmentSetId,
  createServiceZoneId,
  createShipmentRecordId,
  createShippingOptionId,
  createShippingProfileId,
} from "../../domain";

export type FulfillmentD1Database = Kysely<FulfillmentDatabase>;

export interface CreateD1FulfillmentRepositoryOptions {
  readonly db: FulfillmentD1Database;
}

const parseJsonColumn = <Value>(value: string): Value => JSON.parse(value);
const toJsonColumn = (value: unknown): string => JSON.stringify(value);
const toBooleanColumn = (value: boolean): number => (value ? 1 : 0);
const fromBooleanColumn = (value: number): boolean => value === 1;

const toFulfillmentSet = (row: FulfillmentSetRow): FulfillmentSet => ({
  createdAt: new Date(row.created_at),
  id: createFulfillmentSetId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  name: row.name,
  updatedAt: new Date(row.updated_at),
});

const toShippingProfile = (row: ShippingProfileRow): ShippingProfile => ({
  createdAt: new Date(row.created_at),
  fulfillmentSetId: createFulfillmentSetId(row.fulfillment_set_id),
  id: createShippingProfileId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  name: row.name,
  updatedAt: new Date(row.updated_at),
});

const toServiceZone = (row: ServiceZoneRow): ServiceZone => ({
  countryCodes: parseJsonColumn(row.country_codes_json),
  createdAt: new Date(row.created_at),
  fulfillmentSetId: createFulfillmentSetId(row.fulfillment_set_id),
  id: createServiceZoneId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  name: row.name,
  regionIds: parseJsonColumn(row.region_ids_json),
  updatedAt: new Date(row.updated_at),
});

const toShippingOption = (row: ShippingOptionRow): ShippingOption => ({
  createdAt: new Date(row.created_at),
  currencyCode: row.currency_code ?? undefined,
  fulfillmentSetId: createFulfillmentSetId(row.fulfillment_set_id),
  id: createShippingOptionId(row.id),
  isEnabled: fromBooleanColumn(row.is_enabled),
  metadata: parseJsonColumn(row.metadata_json),
  name: row.name,
  priceAmount: row.price_amount ?? undefined,
  profileId: createShippingProfileId(row.profile_id),
  providerKey: row.provider_key,
  providerServiceId: row.provider_service_id,
  serviceZoneId: createServiceZoneId(row.service_zone_id),
  updatedAt: new Date(row.updated_at),
});

const toFulfillment = (row: FulfillmentRow): Fulfillment => ({
  address: row.address_json ? parseJsonColumn(row.address_json) : undefined,
  createdAt: new Date(row.created_at),
  id: createFulfillmentId(row.id),
  idempotencyKey: row.idempotency_key,
  items: parseJsonColumn(row.items_json),
  metadata: parseJsonColumn(row.metadata_json),
  orderId: row.order_id,
  providerFulfillmentId: row.provider_fulfillment_id ?? undefined,
  providerKey: row.provider_key,
  shippingOptionId: createShippingOptionId(row.shipping_option_id),
  status: row.status as Fulfillment["status"],
  updatedAt: new Date(row.updated_at),
});

const toShipment = (row: ShipmentRow): ShipmentRecord => ({
  carrier: row.carrier ?? undefined,
  createdAt: new Date(row.created_at),
  fulfillmentId: createFulfillmentId(row.fulfillment_id),
  id: createShipmentRecordId(row.id),
  labelUrl: row.label_url ?? undefined,
  metadata: parseJsonColumn(row.metadata_json),
  providerShipmentId: row.provider_shipment_id,
  status: row.status as ShipmentRecord["status"],
  trackingNumber: row.tracking_number ?? undefined,
  trackingUrl: row.tracking_url ?? undefined,
  updatedAt: new Date(row.updated_at),
});

const providerInsert = (
  record: FulfillmentProviderRecord
): Insertable<FulfillmentDatabase["fulfillment_provider"]> => ({
  created_at: record.createdAt.getTime(),
  id: record.id,
  is_enabled: toBooleanColumn(record.isEnabled),
  provider_key: record.providerKey,
  provider_record_id: record.providerRecordId,
  updated_at: record.updatedAt.getTime(),
});

const fulfillmentSetInsert = (
  record: FulfillmentSet
): Insertable<FulfillmentDatabase["fulfillment_set"]> => ({
  created_at: record.createdAt.getTime(),
  id: record.id,
  metadata_json: toJsonColumn(record.metadata),
  name: record.name,
  updated_at: record.updatedAt.getTime(),
});

const shippingProfileInsert = (
  record: ShippingProfile
): Insertable<FulfillmentDatabase["shipping_profile"]> => ({
  created_at: record.createdAt.getTime(),
  fulfillment_set_id: record.fulfillmentSetId,
  id: record.id,
  metadata_json: toJsonColumn(record.metadata),
  name: record.name,
  updated_at: record.updatedAt.getTime(),
});

const serviceZoneInsert = (
  record: ServiceZone
): Insertable<FulfillmentDatabase["service_zone"]> => ({
  country_codes_json: toJsonColumn(record.countryCodes),
  created_at: record.createdAt.getTime(),
  fulfillment_set_id: record.fulfillmentSetId,
  id: record.id,
  metadata_json: toJsonColumn(record.metadata),
  name: record.name,
  region_ids_json: toJsonColumn(record.regionIds),
  updated_at: record.updatedAt.getTime(),
});

const shippingOptionInsert = (
  record: ShippingOption
): Insertable<FulfillmentDatabase["shipping_option"]> => ({
  created_at: record.createdAt.getTime(),
  currency_code: record.currencyCode ?? null,
  fulfillment_set_id: record.fulfillmentSetId,
  id: record.id,
  is_enabled: toBooleanColumn(record.isEnabled),
  metadata_json: toJsonColumn(record.metadata),
  name: record.name,
  price_amount: record.priceAmount ?? null,
  profile_id: record.profileId,
  provider_key: record.providerKey,
  provider_service_id: record.providerServiceId,
  service_zone_id: record.serviceZoneId,
  updated_at: record.updatedAt.getTime(),
});

const fulfillmentInsert = (
  record: Fulfillment
): Insertable<FulfillmentDatabase["fulfillment"]> => ({
  address_json: record.address ? toJsonColumn(record.address) : null,
  created_at: record.createdAt.getTime(),
  id: record.id,
  idempotency_key: record.idempotencyKey,
  items_json: toJsonColumn(record.items),
  metadata_json: toJsonColumn(record.metadata),
  order_id: record.orderId,
  provider_fulfillment_id: record.providerFulfillmentId ?? null,
  provider_key: record.providerKey,
  shipping_option_id: record.shippingOptionId,
  status: record.status,
  updated_at: record.updatedAt.getTime(),
});

const shipmentInsert = (
  record: ShipmentRecord
): Insertable<FulfillmentDatabase["shipment"]> => ({
  carrier: record.carrier ?? null,
  created_at: record.createdAt.getTime(),
  fulfillment_id: record.fulfillmentId,
  id: record.id,
  label_url: record.labelUrl ?? null,
  metadata_json: toJsonColumn(record.metadata),
  provider_shipment_id: record.providerShipmentId,
  status: record.status,
  tracking_number: record.trackingNumber ?? null,
  tracking_url: record.trackingUrl ?? null,
  updated_at: record.updatedAt.getTime(),
});

const returnShipmentLinkInsert = (
  record: ReturnShipmentLink
): Insertable<FulfillmentDatabase["return_shipment_link"]> => ({
  created_at: record.createdAt.getTime(),
  fulfillment_id: record.fulfillmentId,
  id: record.id,
  provider_return_id: record.providerReturnId ?? null,
  return_id: record.returnId,
  shipment_id: record.shipmentId,
  updated_at: record.updatedAt.getTime(),
});

export const createD1FulfillmentRepository = ({
  db,
}: CreateD1FulfillmentRepositoryOptions): FulfillmentRepository => ({
  findFulfillmentById: async (id: FulfillmentId) => {
    const row = await db
      .selectFrom("fulfillment")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toFulfillment(row) : null;
  },
  findFulfillmentByIdempotencyKey: async (idempotencyKey) => {
    const row = await db
      .selectFrom("fulfillment")
      .selectAll()
      .where("idempotency_key", "=", idempotencyKey)
      .executeTakeFirst();

    return row ? toFulfillment(row) : null;
  },
  findFulfillmentSetById: async (id: FulfillmentSetId) => {
    const row = await db
      .selectFrom("fulfillment_set")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toFulfillmentSet(row) : null;
  },
  findServiceZoneById: async (id: ServiceZoneId) => {
    const row = await db
      .selectFrom("service_zone")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toServiceZone(row) : null;
  },
  findShipmentByFulfillmentId: async (fulfillmentId: FulfillmentId) => {
    const row = await db
      .selectFrom("shipment")
      .selectAll()
      .where("fulfillment_id", "=", fulfillmentId)
      .executeTakeFirst();

    return row ? toShipment(row) : null;
  },
  findShippingOptionById: async (id: ShippingOptionId) => {
    const row = await db
      .selectFrom("shipping_option")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toShippingOption(row) : null;
  },
  findShippingProfileById: async (id: ShippingProfileId) => {
    const row = await db
      .selectFrom("shipping_profile")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toShippingProfile(row) : null;
  },
  listFulfillments: async () => {
    const rows = await db
      .selectFrom("fulfillment")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toFulfillment);
  },
  listServiceZonesForSet: async (fulfillmentSetId: FulfillmentSetId) => {
    const rows = await db
      .selectFrom("service_zone")
      .selectAll()
      .where("fulfillment_set_id", "=", fulfillmentSetId)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toServiceZone);
  },
  listShipmentsForFulfillment: async (fulfillmentId: FulfillmentId) => {
    const rows = await db
      .selectFrom("shipment")
      .selectAll()
      .where("fulfillment_id", "=", fulfillmentId)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toShipment);
  },
  listShippingOptions: async (input = {}) => {
    let query = db
      .selectFrom("shipping_option")
      .innerJoin(
        "service_zone",
        "service_zone.id",
        "shipping_option.service_zone_id"
      )
      .selectAll("shipping_option")
      .where("shipping_option.is_enabled", "=", 1);

    if (input.fulfillmentSetId) {
      query = query.where(
        "shipping_option.fulfillment_set_id",
        "=",
        input.fulfillmentSetId
      );
    }

    if (input.regionId) {
      query = query.where(
        "service_zone.region_ids_json",
        "like",
        `%"${input.regionId}"%`
      );
    }

    if (input.countryCode) {
      query = query.where(
        "service_zone.country_codes_json",
        "like",
        `%"${input.countryCode.toUpperCase()}"%`
      );
    }

    const rows = await query
      .orderBy("shipping_option.created_at", "desc")
      .execute();

    return rows.map(toShippingOption);
  },
  saveFulfillment: async (fulfillment) => {
    await db
      .insertInto("fulfillment")
      .values(fulfillmentInsert(fulfillment))
      .onConflict((oc) =>
        oc.column("id").doUpdateSet(fulfillmentInsert(fulfillment))
      )
      .execute();

    return fulfillment;
  },
  saveFulfillmentSet: async (fulfillmentSet) => {
    await db
      .insertInto("fulfillment_set")
      .values(fulfillmentSetInsert(fulfillmentSet))
      .onConflict((oc) =>
        oc.column("id").doUpdateSet(fulfillmentSetInsert(fulfillmentSet))
      )
      .execute();

    return fulfillmentSet;
  },
  saveProviderRecord: async (providerRecord) => {
    await db
      .insertInto("fulfillment_provider")
      .values(providerInsert(providerRecord))
      .onConflict((oc) =>
        oc.column("id").doUpdateSet(providerInsert(providerRecord))
      )
      .execute();

    return providerRecord;
  },
  saveReturnShipmentLink: async (link) => {
    await db
      .insertInto("return_shipment_link")
      .values(returnShipmentLinkInsert(link))
      .onConflict((oc) =>
        oc.column("id").doUpdateSet(returnShipmentLinkInsert(link))
      )
      .execute();

    return link;
  },
  saveServiceZone: async (serviceZone) => {
    await db
      .insertInto("service_zone")
      .values(serviceZoneInsert(serviceZone))
      .onConflict((oc) =>
        oc.column("id").doUpdateSet(serviceZoneInsert(serviceZone))
      )
      .execute();

    return serviceZone;
  },
  saveShipment: async (shipment) => {
    await db
      .insertInto("shipment")
      .values(shipmentInsert(shipment))
      .onConflict((oc) => oc.column("id").doUpdateSet(shipmentInsert(shipment)))
      .execute();

    return shipment;
  },
  saveShippingOption: async (shippingOption) => {
    await db
      .insertInto("shipping_option")
      .values(shippingOptionInsert(shippingOption))
      .onConflict((oc) =>
        oc.column("id").doUpdateSet(shippingOptionInsert(shippingOption))
      )
      .execute();

    return shippingOption;
  },
  saveShippingProfile: async (shippingProfile) => {
    await db
      .insertInto("shipping_profile")
      .values(shippingProfileInsert(shippingProfile))
      .onConflict((oc) =>
        oc.column("id").doUpdateSet(shippingProfileInsert(shippingProfile))
      )
      .execute();

    return shippingProfile;
  },
});
