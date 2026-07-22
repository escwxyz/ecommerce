export type DevelopmentSeedValue = number | string | null;

export interface DevelopmentSeedWrite {
  readonly conflictColumns: readonly string[];
  readonly row: Readonly<Record<string, DevelopmentSeedValue>>;
  readonly table: string;
}

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

export const developmentSeedWrites: readonly DevelopmentSeedWrite[] = [];
