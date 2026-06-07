import type { Kysely } from "kysely";

import { authMigration } from "./schema/auth";
import type { AuthDatabase } from "./schema/auth";
import { productMigration } from "./schema/product";
import type { ProductDatabase } from "./schema/product";
import { regionSalesChannelMigration } from "./schema/region-sales-channel";
import type { RegionSalesChannelDatabase } from "./schema/region-sales-channel";
import { storeMigration } from "./schema/store";
import type { StoreDatabase } from "./schema/store";

export * from "./adapters";
export * from "./dialect-helpers";
export * from "./migrations";
// oxlint-disable-next-line oxc/no-barrel-file
export * as authSchema from "./schema/auth";
// oxlint-disable-next-line oxc/no-barrel-file
export * as productSchema from "./schema/product";
// oxlint-disable-next-line oxc/no-barrel-file
export * as regionSalesChannelSchema from "./schema/region-sales-channel";
// oxlint-disable-next-line oxc/no-barrel-file
export * as storeSchema from "./schema/store";

/**
 * Shared Kysely database assembly for commerce-owned primary relational data.
 * Modules contribute table interfaces to this type; runtime packages provide
 * concrete dialect instances at the adapter edge.
 */
// oxlint-disable-next-line typescript/no-empty-interface typescript/no-empty-object-type
export interface CommerceDatabase
  extends
    AuthDatabase,
    StoreDatabase,
    ProductDatabase,
    RegionSalesChannelDatabase {}

export type CommerceKyselyDatabase = Kysely<CommerceDatabase>;
export type CommerceDatabaseSchema = CommerceDatabase;
export type CommerceDatabaseSchemaKey = keyof CommerceDatabaseSchema;

export const commerceMigrations = {
  "000_auth": authMigration,
  "001_store": storeMigration,
  "002_product": productMigration,
  "003_region_sales_channel": regionSalesChannelMigration,
} as const;
