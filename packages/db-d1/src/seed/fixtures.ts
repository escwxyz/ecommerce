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
  customer: "cus_dev_ada",
  customerAddress: "cusaddr_dev_ada_home",
  fulfillmentOption: "shipopt_dev_ground",
  fulfillmentProvider: "fulprov_dev_manual",
  fulfillmentSet: "fulset_dev_us",
  inventoryItem: "iitem_dev_tshirt_black",
  inventoryLevel: "ilevel_dev_tshirt_black_main",
  moneyAmount: "money_dev_tshirt_usd",
  priceSet: "pset_dev_tshirt",
  product: "prod_dev_tshirt",
  productVariant: "variant_dev_tshirt_black",
  region: "reg_dev_us",
  salesChannel: "sc_dev_web",
  serviceZone: "fzone_dev_us",
  shippingProfile: "shprof_dev_default",
  stockLocation: "sloc_dev_main",
  store: "store_dev_default",
  taxCategory: "txcat_dev_standard",
  taxPolicy: "txpolicy_dev_us",
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

const region = defineSeedWrite(
  "region",
  {
    created_at: seedTimestamp,
    currency_code: "USD",
    fulfillment_option_ids_json: JSON.stringify([
      developmentSeedIds.fulfillmentOption,
    ]),
    id: developmentSeedIds.region,
    metadata_json: emptyJson,
    name: "United States",
    payment_provider_ids_json: JSON.stringify(["manual"]),
    tax_provider_id: developmentSeedIds.taxProvider,
    updated_at: seedTimestamp,
  },
  ["id"]
);

const regionCountry = defineSeedWrite(
  "region_country",
  {
    country_code: "US",
    region_id: developmentSeedIds.region,
  },
  ["region_id", "country_code"]
);

const salesChannel = defineSeedWrite(
  "sales_channel",
  {
    created_at: seedTimestamp,
    description: "Default development storefront",
    id: developmentSeedIds.salesChannel,
    metadata_json: emptyJson,
    name: "Development web store",
    status: "active",
    updated_at: seedTimestamp,
  },
  ["id"]
);

const product = defineSeedWrite(
  "product",
  {
    catalog_metadata: emptyJson,
    catalog_published_at: seedTimestamp,
    catalog_searchable_text: "development t-shirt",
    created_at: seedTimestamp,
    handle: "development-t-shirt",
    id: developmentSeedIds.product,
    status: "active",
    title: "Development T-Shirt",
    updated_at: seedTimestamp,
  },
  ["id"]
);

const productVariant = defineSeedWrite(
  "product_variant",
  {
    id: developmentSeedIds.productVariant,
    metadata: JSON.stringify({
      inventoryItemId: developmentSeedIds.inventoryItem,
      priceSetId: developmentSeedIds.priceSet,
      stockLocationId: developmentSeedIds.stockLocation,
      taxCategoryId: developmentSeedIds.taxCategory,
    }),
    option_value_ids: JSON.stringify([]),
    product_id: developmentSeedIds.product,
    searchable_text: "development t-shirt black",
    sku: "DEV-TSHIRT-BLACK",
    status: "active",
    title: "Black",
  },
  ["id"]
);

const salesChannelProduct = defineSeedWrite(
  "sales_channel_product",
  {
    product_id: developmentSeedIds.product,
    sales_channel_id: developmentSeedIds.salesChannel,
  },
  ["sales_channel_id", "product_id"]
);

const currency = defineSeedWrite(
  "pricing_currency",
  {
    code: "USD",
    created_at: seedTimestamp,
    id: "currency_dev_usd",
    name: "US Dollar",
    precision: 2,
    updated_at: seedTimestamp,
  },
  ["id"]
);

const priceSet = defineSeedWrite(
  "pricing_price_set",
  {
    created_at: seedTimestamp,
    id: developmentSeedIds.priceSet,
    metadata_json: JSON.stringify({
      variantId: developmentSeedIds.productVariant,
    }),
    title: "Development T-Shirt pricing",
    updated_at: seedTimestamp,
  },
  ["id"]
);

const moneyAmount = defineSeedWrite(
  "pricing_money_amount",
  {
    amount: 2500,
    created_at: seedTimestamp,
    currency_code: "USD",
    id: developmentSeedIds.moneyAmount,
    price_list_id: null,
    price_set_id: developmentSeedIds.priceSet,
    rules_json: JSON.stringify([]),
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

const customer = defineSeedWrite(
  "customer",
  {
    auth_user_id: null,
    created_at: seedTimestamp,
    email: "ada.dev@example.com",
    first_name: "Ada",
    id: developmentSeedIds.customer,
    last_name: "Lovelace",
    metadata: emptyJson,
    phone: null,
    updated_at: seedTimestamp,
  },
  ["id"]
);

const customerAddress = defineSeedWrite(
  "customer_address",
  {
    address1: "1 Development Way",
    address2: null,
    city: "New York",
    company: null,
    country_code: "US",
    customer_id: developmentSeedIds.customer,
    first_name: "Ada",
    id: developmentSeedIds.customerAddress,
    is_default_billing: 1,
    is_default_shipping: 1,
    kind: "shipping",
    last_name: "Lovelace",
    metadata: emptyJson,
    phone: null,
    postal_code: "10001",
    province: "NY",
  },
  ["id"]
);

const store = defineSeedWrite(
  "store",
  {
    created_at: seedTimestamp,
    default_currency_code: "USD",
    default_locale: "en-US",
    default_region_id: developmentSeedIds.region,
    default_sales_channel_id: developmentSeedIds.salesChannel,
    id: developmentSeedIds.store,
    metadata_json: emptyJson,
    name: "Development Store",
    supported_currency_codes_json: JSON.stringify(["USD"]),
    timezone: "UTC",
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
  region,
  regionCountry,
  salesChannel,
  product,
  productVariant,
  salesChannelProduct,
  currency,
  priceSet,
  moneyAmount,
  inventoryItem,
  stockLocation,
  inventoryLevel,
  customer,
  customerAddress,
  store,
];
