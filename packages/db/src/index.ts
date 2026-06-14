import type { Kysely } from "kysely";

import { authMigration } from "./schema/auth";
import type { AuthDatabase } from "./schema/auth";
import { customerMigration } from "./schema/customer";
import type { CustomerDatabase } from "./schema/customer";
import { inventoryMigration } from "./schema/inventory";
import type { InventoryDatabase } from "./schema/inventory";
import { pricingMigration } from "./schema/pricing";
import type { PricingDatabase } from "./schema/pricing";
import { productMigration } from "./schema/product";
import type { ProductDatabase } from "./schema/product";
import { promotionMigration } from "./schema/promotion";
import type { PromotionDatabase } from "./schema/promotion";
import { regionSalesChannelMigration } from "./schema/region-sales-channel";
import type { RegionSalesChannelDatabase } from "./schema/region-sales-channel";
import { storeMigration } from "./schema/store";
import type { StoreDatabase } from "./schema/store";
import { taxMigration } from "./schema/tax";
import type { TaxDatabase } from "./schema/tax";

export * from "./adapters";
export * from "./dialect-helpers";
export * from "./migrations";
// oxlint-disable-next-line oxc/no-barrel-file
export * as authSchema from "./schema/auth";
// oxlint-disable-next-line oxc/no-barrel-file
export * as customerSchema from "./schema/customer";
// oxlint-disable-next-line oxc/no-barrel-file
export * as inventorySchema from "./schema/inventory";
// oxlint-disable-next-line oxc/no-barrel-file
export * as productSchema from "./schema/product";
// oxlint-disable-next-line oxc/no-barrel-file
export * as pricingSchema from "./schema/pricing";
// oxlint-disable-next-line oxc/no-barrel-file
export * as regionSalesChannelSchema from "./schema/region-sales-channel";
// oxlint-disable-next-line oxc/no-barrel-file
export * as promotionSchema from "./schema/promotion";
// oxlint-disable-next-line oxc/no-barrel-file
export * as storeSchema from "./schema/store";
// oxlint-disable-next-line oxc/no-barrel-file
export * as taxSchema from "./schema/tax";

/**
 * Shared Kysely database assembly for commerce-owned primary relational data.
 * Modules contribute table interfaces to this type; runtime packages provide
 * concrete dialect instances at the adapter edge.
 */
// oxlint-disable-next-line typescript/no-empty-interface typescript/no-empty-object-type
export interface CommerceDatabase
  extends
    AuthDatabase,
    CustomerDatabase,
    InventoryDatabase,
    StoreDatabase,
    ProductDatabase,
    PricingDatabase,
    PromotionDatabase,
    RegionSalesChannelDatabase,
    TaxDatabase {}

export type CommerceKyselyDatabase = Kysely<CommerceDatabase>;
export type CommerceDatabaseSchema = CommerceDatabase;
export type CommerceDatabaseSchemaKey = keyof CommerceDatabaseSchema;

export const commerceMigrations = {
  "000_auth": authMigration,
  "001_store": storeMigration,
  "002_product": productMigration,
  "003_region_sales_channel": regionSalesChannelMigration,
  "004_pricing": pricingMigration,
  "005_promotion": promotionMigration,
  "006_customer": customerMigration,
  "007_inventory": inventoryMigration,
  "008_tax": taxMigration,
} as const;
