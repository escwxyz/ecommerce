import {
  StaticCommerceMigrationProvider,
  commerceMigrations,
} from "@ecommerce/db";
import type { CommerceDatabase } from "@ecommerce/db";
import { Migrator } from "kysely";
import type { Kysely } from "kysely";

export const D1_MIGRATION_TABLE = "_commerce_migrations";
export const D1_MIGRATION_LOCK_TABLE = "_commerce_migrations_lock";

export interface D1MigrationStatus {
  readonly applied: readonly string[];
  readonly pending: readonly string[];
}

export const createD1Migrator = (db: Kysely<CommerceDatabase>): Migrator =>
  new Migrator({
    db,
    migrationLockTableName: D1_MIGRATION_LOCK_TABLE,
    migrationTableName: D1_MIGRATION_TABLE,
    provider: new StaticCommerceMigrationProvider(commerceMigrations),
  });

export const migrateD1ToLatest = (db: Kysely<CommerceDatabase>) =>
  createD1Migrator(db).migrateToLatest();

export const getD1MigrationStatus = async (
  db: Kysely<CommerceDatabase>
): Promise<D1MigrationStatus> => {
  const migrations = await createD1Migrator(db).getMigrations();

  const applied: string[] = [];
  const pending: string[] = [];

  for (const migration of migrations) {
    if (migration.executedAt) {
      applied.push(migration.name);
      continue;
    }
    pending.push(migration.name);
  }

  return { applied, pending };
};
