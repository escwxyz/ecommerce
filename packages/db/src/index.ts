import type { AuthDatabase } from "./schema/auth";

// oxlint-disable-next-line oxc/no-barrel-file
export * as authSchema from "./schema/auth";

/**
 * Shared commerce schema assembly for primary relational data.
 * Runtime-neutral packages consume this shape without inheriting any concrete
 * query-builder runtime types from the package root.
 */
// oxlint-disable-next-line typescript/no-empty-interface typescript/no-empty-object-type
export interface CommerceDatabase extends AuthDatabase {}

export type CommerceDatabaseSchema = CommerceDatabase;
export type CommerceDatabaseSchemaKey = keyof CommerceDatabaseSchema;
