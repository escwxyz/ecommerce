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
  taxPolicy: "txpolicy_dev_us",
  taxProvider: "txprov_dev_manual",
  taxRate: "txrate_dev_us_standard",
  // Checkout currently passes the commerce region id into tax.calculateTax,
  // so the development seed aligns the tax region primary key with that lookup.
  taxRegion: "reg_dev_us",
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

const taxCategory = defineSeedWrite(
  "tax_category",
  {
    code: "standard",
    created_at: seedTimestamp,
    description: "Standard taxable goods",
    id: developmentSeedIds.taxCategory,
    metadata_json: emptyJson,
    name: "Standard",
    updated_at: seedTimestamp,
  },
  ["id"]
);

const taxProvider = defineSeedWrite(
  "tax_provider_config",
  {
    created_at: seedTimestamp,
    id: developmentSeedIds.taxProvider,
    is_active: 1,
    metadata_json: emptyJson,
    provider_key: "manual",
    settings_json: emptyJson,
    updated_at: seedTimestamp,
  },
  ["id"]
);

const taxRegion = defineSeedWrite(
  "tax_region",
  {
    code: "us",
    country_code: "US",
    created_at: seedTimestamp,
    id: developmentSeedIds.taxRegion,
    metadata_json: emptyJson,
    name: "United States",
    provider_config_id: developmentSeedIds.taxProvider,
    updated_at: seedTimestamp,
  },
  ["id"]
);

const taxRate = defineSeedWrite(
  "tax_rate",
  {
    category_id: developmentSeedIds.taxCategory,
    created_at: seedTimestamp,
    id: developmentSeedIds.taxRate,
    metadata_json: emptyJson,
    name: "US standard rate",
    percentage: 8.25,
    region_id: developmentSeedIds.taxRegion,
    updated_at: seedTimestamp,
  },
  ["id"]
);

const taxPolicy = defineSeedWrite(
  "tax_calculation_policy",
  {
    id: developmentSeedIds.taxPolicy,
    prices_include_tax: 0,
    region_id: developmentSeedIds.taxRegion,
    round_at: "line",
    updated_at: seedTimestamp,
  },
  ["id"]
);

const inventoryItem = defineSeedWrite(
  "inventory_item",
  {
    created_at: seedTimestamp,
    id: developmentSeedIds.inventoryItem,
    metadata_json: JSON.stringify({
      variantId: developmentSeedIds.productVariant,
    }),
    sku: "DEV-TSHIRT-BLACK",
    title: "Development T-Shirt - Black",
    updated_at: seedTimestamp,
  },
  ["id"]
);

const stockLocation = defineSeedWrite(
  "inventory_stock_location",
  {
    created_at: seedTimestamp,
    id: developmentSeedIds.stockLocation,
    metadata_json: emptyJson,
    name: "Development warehouse",
    sales_channel_ids_json: JSON.stringify([developmentSeedIds.salesChannel]),
    updated_at: seedTimestamp,
  },
  ["id"]
);

const inventoryLevel = defineSeedWrite(
  "inventory_level",
  {
    created_at: seedTimestamp,
    id: developmentSeedIds.inventoryLevel,
    inventory_item_id: developmentSeedIds.inventoryItem,
    reserved_quantity: 0,
    stock_location_id: developmentSeedIds.stockLocation,
    stocked_quantity: 100,
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
  taxCategory,
  taxProvider,
  taxRegion,
  taxRate,
  taxPolicy,
  inventoryItem,
  stockLocation,
  inventoryLevel,
];
