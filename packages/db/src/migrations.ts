import type { Migration, MigrationProvider } from "kysely";

import { authMigration } from "./schema/auth";
import { notificationEventMigration } from "./schema/notification-event";
import { orderMigration } from "./schema/order";
import { paymentMigration } from "./schema/payment";

export type CommerceMigration = Migration;
export type CommerceMigrationMap = Readonly<Record<string, CommerceMigration>>;

export class StaticCommerceMigrationProvider implements MigrationProvider {
  readonly #migrations: CommerceMigrationMap;

  constructor(migrations: CommerceMigrationMap) {
    this.#migrations = migrations;
  }

  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve({ ...this.#migrations });
  }
}

export const defineCommerceMigrations = <
  TMigrations extends CommerceMigrationMap,
>(
  migrations: TMigrations
): TMigrations => migrations;

export const commerceMigrations = defineCommerceMigrations({
  "000_auth": authMigration,
  "009_payment": paymentMigration,
  "011_notification_event": notificationEventMigration,
  "013_order": orderMigration,
});
