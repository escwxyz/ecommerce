import type { CommerceDatabase } from "@ecommerce/db";
import type { Insertable } from "kysely";

export type DevelopmentSeedValue = number | string | null;

export interface DevelopmentSeedWrite {
  readonly conflictColumns: readonly string[];
  readonly row: Readonly<Record<string, DevelopmentSeedValue>>;
  readonly table: keyof CommerceDatabase;
}

const seedTimestamp = Date.UTC(2026, 0, 1);
const emptyJson = JSON.stringify({});

export const developmentSeedIds = {
  currency: "cur_dev_usd",
  customer: "cust_dev_ada",
  fulfillmentOption: "shipopt_dev_ground",
  fulfillmentProvider: "fulprov_dev_manual",
  fulfillmentSet: "fset_dev_us",
  inventoryItem: "iitem_dev_tshirt_black",
  inventoryLevel: "ilvl_dev_tshirt_black_main",
  moneyAmount: "amt_dev_tshirt_usd",
  priceSet: "pset_dev_tshirt",
  product: "prod_dev_tshirt",
  productVariant: "variant_dev_tshirt_black",
  region: "reg_dev_us",
  salesChannel: "sc_dev_web",
  serviceZone: "fzone_dev_us",
  shippingProfile: "shprof_dev_default",
  stockLocation: "sloc_dev_main",
  taxCategory: "txcat_dev_standard",
  taxProvider: "txprov_dev_manual",
  taxRate: "txrate_dev_us_standard",
  taxRegion: "txreg_dev_us",
} as const;

const defineSeedWrite = <Table extends keyof CommerceDatabase>(
  table: Table,
  row: Insertable<CommerceDatabase[Table]>,
  conflictColumns: readonly (keyof Insertable<CommerceDatabase[Table]> &
    string)[]
): DevelopmentSeedWrite => ({
  conflictColumns,
  row: row as unknown as Readonly<Record<string, DevelopmentSeedValue>>,
  table,
});

const fulfillmentProvider = defineSeedWrite(
  "fulfillment_provider",
  {
    created_at: seedTimestamp,
    id: developmentSeedIds.fulfillmentProvider,
    is_enabled: 1,
    provider_key: "manual",
    provider_record_id: "manual",
    updated_at: seedTimestamp,
  },
  ["id"]
);

const fulfillmentSet = defineSeedWrite(
  "fulfillment_set",
  {
    created_at: seedTimestamp,
    id: developmentSeedIds.fulfillmentSet,
    metadata_json: emptyJson,
    name: "US fulfillment",
    updated_at: seedTimestamp,
  },
  ["id"]
);

const shippingProfile = defineSeedWrite(
  "shipping_profile",
  {
    created_at: seedTimestamp,
    fulfillment_set_id: developmentSeedIds.fulfillmentSet,
    id: developmentSeedIds.shippingProfile,
    metadata_json: emptyJson,
    name: "Default shipping",
    updated_at: seedTimestamp,
  },
  ["id"]
);

const serviceZone = defineSeedWrite(
  "service_zone",
  {
    country_codes_json: JSON.stringify(["US"]),
    created_at: seedTimestamp,
    fulfillment_set_id: developmentSeedIds.fulfillmentSet,
    id: developmentSeedIds.serviceZone,
    metadata_json: emptyJson,
    name: "United States",
    region_ids_json: JSON.stringify([developmentSeedIds.region]),
    updated_at: seedTimestamp,
  },
  ["id"]
);

const shippingOption = defineSeedWrite(
  "shipping_option",
  {
    created_at: seedTimestamp,
    currency_code: "USD",
    fulfillment_set_id: developmentSeedIds.fulfillmentSet,
    id: developmentSeedIds.fulfillmentOption,
    is_enabled: 1,
    metadata_json: emptyJson,
    name: "Ground shipping",
    price_amount: 500,
    profile_id: developmentSeedIds.shippingProfile,
    provider_key: "manual",
    provider_service_id: "ground",
    service_zone_id: developmentSeedIds.serviceZone,
    updated_at: seedTimestamp,
  },
  ["id"]
);

export const developmentSeedWrites: readonly DevelopmentSeedWrite[] = [
  fulfillmentProvider,
  fulfillmentSet,
  shippingProfile,
  serviceZone,
  shippingOption,
];
