import type { Kysely } from "kysely";

import type { CommerceDatabaseSchema } from "./index";

export {
  d1,
  libsql,
  postgres,
  sqlite,
  type D1Config,
  type DatabaseDescriptor,
  type DatabaseDialectType,
  type KyselyDatabaseRuntime,
  type LibsqlConfig,
  type PostgresConfig,
  type SqliteConfig,
  defineKyselyDatabaseRuntime,
} from "./adapters";
export {
  binaryType,
  columnExists,
  currentTimestamp,
  currentTimestampMs,
  detectDialect,
  indexExists,
  isPostgres,
  isSqlite,
  jsonExtractExpr,
  listTablesLike,
  tableExists,
} from "./dialect-helpers";
export {
  StaticCommerceMigrationProvider,
  commerceMigrations,
  defineCommerceMigrations,
  type CommerceMigration,
  type CommerceMigrationMap,
} from "./migrations";

/**
 * Legacy Kysely runtime alias kept behind an explicit subpath while Effect and
 * Drizzle replace shared database contracts at the package root.
 */
export type CommerceKyselyDatabase = Kysely<CommerceDatabaseSchema>;
