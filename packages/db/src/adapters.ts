import type { Kysely } from "kysely";

export type DatabaseDialectType = "sqlite" | "postgres";

export interface DatabaseDescriptor {
  readonly config: unknown;
  readonly entrypoint: string;
  readonly supportsRequestScope?: boolean;
  readonly type: DatabaseDialectType;
}

export interface D1Config {
  readonly binding: string;
}

export interface SqliteConfig {
  readonly url: string;
}

export interface LibsqlConfig {
  readonly authToken?: string;
  readonly url: string;
}

export interface PostgresConfig {
  readonly connectionString?: string;
  readonly database?: string;
  readonly host?: string;
  readonly password?: string;
  readonly port?: number;
  readonly ssl?: boolean;
  readonly user?: string;
}

export const d1 = (config: D1Config): DatabaseDescriptor => ({
  config,
  entrypoint: "@ecommerce/db-d1",
  supportsRequestScope: true,
  type: "sqlite",
});

export const sqlite = (config: SqliteConfig): DatabaseDescriptor => ({
  config,
  entrypoint: "@ecommerce/db-libsql",
  type: "sqlite",
});

export const libsql = (config: LibsqlConfig): DatabaseDescriptor => ({
  config,
  entrypoint: "@ecommerce/db-libsql",
  type: "sqlite",
});

export const postgres = (config: PostgresConfig): DatabaseDescriptor => ({
  config,
  entrypoint: "@ecommerce/db-postgres",
  type: "postgres",
});

export interface KyselyDatabaseRuntime<
  TDatabase extends object = Record<string, unknown>,
> {
  readonly db: Kysely<TDatabase>;
  readonly supportsRequestScope?: boolean;
  readonly type: DatabaseDialectType;
}

export const defineKyselyDatabaseRuntime = <TDatabase extends object>(
  runtime: KyselyDatabaseRuntime<TDatabase>
): KyselyDatabaseRuntime<TDatabase> => runtime;
