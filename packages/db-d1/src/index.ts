import type { D1Database } from "@cloudflare/workers-types";
import { defineKyselyDatabaseRuntime } from "@ecommerce/db";
import type { CommerceDatabase } from "@ecommerce/db";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

export interface D1CommerceDatabaseRuntime {
  readonly authDatabase: D1Database;
  readonly binding: D1Database;
  readonly db: Kysely<CommerceDatabase>;
  readonly supportsRequestScope: true;
  readonly type: "sqlite";
}

/**
 * Creates the Cloudflare D1-backed Kysely runtime from an explicit Worker
 * binding. Auth receives the raw D1 binding because Better Auth internally
 * wraps D1 through its Kysely relational adapter path.
 */
export const createD1Database = (
  binding: D1Database
): D1CommerceDatabaseRuntime => {
  const runtime = defineKyselyDatabaseRuntime<CommerceDatabase>({
    db: new Kysely<CommerceDatabase>({
      dialect: new D1Dialect({ database: binding }),
    }),
    supportsRequestScope: true,
    type: "sqlite",
  });

  return {
    authDatabase: binding,
    binding,
    db: runtime.db,
    supportsRequestScope: true,
    type: "sqlite",
  };
};

export {
  createD1Migrator,
  getD1MigrationStatus,
  migrateD1ToLatest,
} from "./migrations/runner";
