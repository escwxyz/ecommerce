import type { ColumnDataType, Kysely, RawBuilder } from "kysely";
import { sql } from "kysely";

import type { DatabaseDialectType } from "./adapters";

export type { DatabaseDialectType };

export const detectDialect = <TDatabase extends object>(
  db: Kysely<TDatabase>
): DatabaseDialectType => {
  const adapterName = db.getExecutor().adapter.constructor.name;
  return adapterName === "PostgresAdapter" ? "postgres" : "sqlite";
};

export const isPostgres = <TDatabase extends object>(
  db: Kysely<TDatabase>
): boolean => detectDialect(db) === "postgres";

export const isSqlite = <TDatabase extends object>(
  db: Kysely<TDatabase>
): boolean => detectDialect(db) === "sqlite";

export const currentTimestamp = <TDatabase extends object>(
  db: Kysely<TDatabase>
): RawBuilder<string> =>
  isPostgres(db) ? sql`CURRENT_TIMESTAMP` : sql`(datetime('now'))`;

export const currentTimestampMs = <TDatabase extends object>(
  db: Kysely<TDatabase>
): RawBuilder<number> =>
  isPostgres(db)
    ? sql`(extract(epoch from CURRENT_TIMESTAMP) * 1000)::bigint`
    : sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const binaryType = <TDatabase extends object>(
  db: Kysely<TDatabase>
): ColumnDataType => (isPostgres(db) ? "bytea" : "blob");

export const tableExists = async <TDatabase extends object>(
  db: Kysely<TDatabase>,
  tableName: string
): Promise<boolean> => {
  if (isPostgres(db)) {
    const result = await sql<{ exists: boolean }>`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${tableName}
      ) as exists
    `.execute(db);
    return result.rows[0]?.exists === true;
  }

  const result = await sql<{ name: string }>`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name = ${tableName}
  `.execute(db);
  return result.rows.length > 0;
};

export const indexExists = async <TDatabase extends object>(
  db: Kysely<TDatabase>,
  indexName: string
): Promise<boolean> => {
  if (isPostgres(db)) {
    const result = await sql<{ exists: boolean }>`
      SELECT EXISTS(
        SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema() AND indexname = ${indexName}
      ) as exists
    `.execute(db);
    return result.rows[0]?.exists === true;
  }

  const result = await sql<{ name: string }>`
    SELECT name FROM sqlite_master
    WHERE type = 'index' AND name = ${indexName}
  `.execute(db);
  return result.rows.length > 0;
};

export const columnExists = async <TDatabase extends object>(
  db: Kysely<TDatabase>,
  tableName: string,
  columnName: string
): Promise<boolean> => {
  if (isPostgres(db)) {
    const result = await sql<{ exists: boolean }>`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = ${tableName}
          AND column_name = ${columnName}
      ) as exists
    `.execute(db);
    return result.rows[0]?.exists === true;
  }

  const result = await sql<{ name: string }>`
    SELECT name FROM pragma_table_info(${tableName})
    WHERE name = ${columnName}
  `.execute(db);
  return result.rows.length > 0;
};

export const listTablesLike = async <TDatabase extends object>(
  db: Kysely<TDatabase>,
  pattern: string
): Promise<string[]> => {
  if (isPostgres(db)) {
    const result = await sql<{ table_name: string }>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE ${pattern}
    `.execute(db);
    return result.rows.map((row) => row.table_name);
  }

  const result = await sql<{ name: string }>`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name LIKE ${pattern}
  `.execute(db);
  return result.rows.map((row) => row.name);
};

export const jsonExtractExpr = <TDatabase extends object>(
  db: Kysely<TDatabase>,
  column: string,
  path: string
): string =>
  isPostgres(db)
    ? `${column}->>'${path}'`
    : `json_extract(${column}, '$.${path}')`;
