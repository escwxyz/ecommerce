import type { Kysely } from "kysely";

import { authMigration } from "./schema/auth";
import type { AuthDatabase } from "./schema/auth";
import { productMigration } from "./schema/product";
import type { ProductDatabase } from "./schema/product";

export * from "./adapters";
export * from "./dialect-helpers";
export * from "./migrations";
// oxlint-disable-next-line oxc/no-barrel-file
export * as authSchema from "./schema/auth";
// oxlint-disable-next-line oxc/no-barrel-file
export * as productSchema from "./schema/product";

/**
 * Shared Kysely database assembly for commerce-owned primary relational data.
 * Modules contribute table interfaces to this type; runtime packages provide
 * concrete dialect instances at the adapter edge.
 */
// oxlint-disable-next-line typescript/no-empty-interface typescript/no-empty-object-type
export interface CommerceDatabase extends AuthDatabase, ProductDatabase {}

export type CommerceKyselyDatabase = Kysely<CommerceDatabase>;
export type CommerceDatabaseSchema = CommerceDatabase;
export type CommerceDatabaseSchemaKey = keyof CommerceDatabaseSchema;

export const commerceMigrations = {
  "000_auth": authMigration,
  "001_product": productMigration,
} as const;
