import type { Migration, MigrationProvider } from "kysely";

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
