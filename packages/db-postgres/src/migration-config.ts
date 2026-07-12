import { fileURLToPath } from "node:url";

import type * as PgDrizzleMigrator from "drizzle-orm/effect-postgres/migrator";

/** Drizzle runtime migration options accepted by the PostgreSQL adapter. */
export type PostgresMigrationRunnerOptions = Partial<
  Parameters<typeof PgDrizzleMigrator.migrate>[1]
>;

/** Default checked-in migration folder for the clean PostgreSQL baseline. */
export const defaultPostgresMigrationsFolder = fileURLToPath(
  new URL("migrations", import.meta.url)
);

/** Default Drizzle migration table name for PostgreSQL stages. */
export const defaultPostgresMigrationsTable = "__drizzle_migrations" as const;

/** Resolves runtime migration options with the checked-in baseline folder. */
export const createPostgresMigrationConfig = ({
  migrationsFolder = defaultPostgresMigrationsFolder,
  migrationsTable = defaultPostgresMigrationsTable,
  migrationsSchema,
}: PostgresMigrationRunnerOptions = {}) => ({
  migrationsFolder,
  migrationsSchema,
  migrationsTable,
});
