import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface DevelopmentSeedModule {
  readonly developmentSeedIds: {
    readonly customer: string;
    readonly fulfillmentOption: string;
    readonly inventoryItem: string;
    readonly priceSet: string;
    readonly product: string;
    readonly productVariant: string;
    readonly region: string;
    readonly salesChannel: string;
    readonly stockLocation: string;
    readonly taxCategory: string;
    readonly taxRegion: string;
  };
  getDevelopmentSeedWranglerArguments?(artifactPath: string): readonly string[];
  generateDevelopmentSeedSql(): string;
}

const loadSeedModule = async (): Promise<DevelopmentSeedModule | null> =>
  import("./seed/index")
    .then((module) => module as DevelopmentSeedModule)
    .catch(() => null);

const createMigratedDatabase = (): Database => {
  const database = new Database(":memory:");
  const migrationsDirectory = join(import.meta.dir, "migrations", "sql");

  database.exec("PRAGMA foreign_keys = ON;");
  for (const migrationFile of readdirSync(migrationsDirectory).sort()) {
    if (migrationFile.endsWith(".sql")) {
      database.exec(
        readFileSync(join(migrationsDirectory, migrationFile), "utf8")
      );
    }
  }

  return database;
};

const countRows = (database: Database, table: string): number => {
  const result = database
    .query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM "${table}"`)
    .get();

  return result?.count ?? 0;
};

describe("deterministic development seed", () => {
  it("provides an adapter-owned generated seed artifact", async () => {
    const seedModule = await loadSeedModule();

    expect(seedModule).not.toBeNull();
    expect(seedModule?.generateDevelopmentSeedSql()).toContain(
      "BEGIN TRANSACTION;"
    );
  });

  it("defines a local-only Wrangler command and repository scripts", async () => {
    const seedModule = await loadSeedModule();
    expect(seedModule).not.toBeNull();
    expect(seedModule?.getDevelopmentSeedWranglerArguments).toBeFunction();
    if (!seedModule?.getDevelopmentSeedWranglerArguments) {
      return;
    }

    expect(
      seedModule.getDevelopmentSeedWranglerArguments(
        "/tmp/development-seed.sql"
      )
    ).toEqual([
      "d1",
      "execute",
      "Database",
      "--local",
      "--file",
      "/tmp/development-seed.sql",
    ]);

    const packageJson = await Bun.file(
      new URL("../package.json", import.meta.url)
    ).json();
    const rootPackageJson = await Bun.file(
      new URL("../../../package.json", import.meta.url)
    ).json();
    const turboConfig = await Bun.file(
      new URL("../../../turbo.json", import.meta.url)
    ).json();
    const wranglerConfig = await Bun.file(
      new URL("../wrangler.jsonc", import.meta.url)
    ).text();

    expect(packageJson.scripts["db:push"]).toBe(
      "wrangler d1 migrations apply Database --local"
    );
    expect(packageJson.scripts["db:seed"]).toBe("bun ./src/seed/run.ts");
    expect(rootPackageJson.scripts["db:seed"]).toBe(
      "turbo -F @ecommerce/db-d1 db:seed"
    );
    expect(turboConfig.tasks["db:seed"]).toEqual({ cache: false });
    expect(wranglerConfig).toContain('"migrations_dir": "src/migrations/sql"');
  });

  it("keeps migrated fulfillment prerequisites out of D1 seed data", async () => {
    const seedModule = await loadSeedModule();
    expect(seedModule).not.toBeNull();
    if (!seedModule) {
      return;
    }

    const database = createMigratedDatabase();
    database.exec(seedModule.generateDevelopmentSeedSql());

    expect(seedModule.developmentSeedIds.fulfillmentOption).toBe(
      "shipopt_dev_ground"
    );
    expect(() => countRows(database, "shipping_option")).toThrow();

    database.close();
  });

  it("is idempotent and excludes transaction and auth history", async () => {
    const seedModule = await loadSeedModule();
    expect(seedModule).not.toBeNull();
    if (!seedModule) {
      return;
    }

    const database = createMigratedDatabase();
    const seedSql = seedModule.generateDevelopmentSeedSql();
    database.exec(seedSql);

    const seededCounts = {
      eventOutbox: countRows(database, "event_outbox"),
    };

    database.exec(seedSql);

    expect({
      eventOutbox: countRows(database, "event_outbox"),
    }).toEqual(seededCounts);

    expect(countRows(database, "order_record")).toBe(0);
    expect(countRows(database, "payment_collection")).toBe(0);
    expect(countRows(database, "event_outbox")).toBe(0);
    expect(countRows(database, "user")).toBe(0);

    database.close();
  });
});
