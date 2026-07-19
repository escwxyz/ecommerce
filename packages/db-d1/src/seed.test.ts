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
    readonly taxRate: string;
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

  it("creates connected golden checkout prerequisites", async () => {
    const seedModule = await loadSeedModule();
    expect(seedModule).not.toBeNull();
    if (!seedModule) {
      return;
    }

    const database = createMigratedDatabase();
    database.exec(seedModule.generateDevelopmentSeedSql());

    const checkoutFixture = database
      .query<
        {
          inventory_item_id: string;
          shipping_option_id: string;
          stock_location_id: string;
          variant_id: string;
        },
        []
      >(
        `SELECT
          ii.id AS inventory_item_id,
          il.stock_location_id,
          so.id AS shipping_option_id,
          json_extract(ii.metadata_json, '$.variantId') AS variant_id
        FROM inventory_item ii
        JOIN inventory_level il ON il.inventory_item_id = ii.id
        JOIN shipping_option so ON so.id = 'shipopt_dev_ground'
        WHERE json_extract(ii.metadata_json, '$.variantId') = 'variant_dev_tshirt_black'`
      )
      .get();

    expect(checkoutFixture).toEqual({
      inventory_item_id: seedModule.developmentSeedIds.inventoryItem,
      shipping_option_id: seedModule.developmentSeedIds.fulfillmentOption,
      stock_location_id: seedModule.developmentSeedIds.stockLocation,
      variant_id: seedModule.developmentSeedIds.productVariant,
    });

    const taxFixture = database
      .query<
        {
          rate_region_id: string;
          tax_region_id: string;
          tax_region_name: string;
        },
        []
      >(
        `SELECT
          tr.id AS tax_region_id,
          tr.name AS tax_region_name,
          trt.region_id AS rate_region_id
        FROM tax_region tr
        JOIN tax_rate trt ON trt.region_id = tr.id
        WHERE tr.id = 'reg_dev_us'`
      )
      .get();

    expect(taxFixture).toEqual({
      rate_region_id: seedModule.developmentSeedIds.taxRegion,
      tax_region_id: seedModule.developmentSeedIds.region,
      tax_region_name: "United States",
    });

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
      inventoryLevel: countRows(database, "inventory_level"),
      shippingOption: countRows(database, "shipping_option"),
    };

    database.exec(seedSql);

    expect({
      inventoryLevel: countRows(database, "inventory_level"),
      shippingOption: countRows(database, "shipping_option"),
    }).toEqual(seededCounts);

    expect(countRows(database, "cart")).toBe(0);
    expect(countRows(database, "order_record")).toBe(0);
    expect(countRows(database, "payment_collection")).toBe(0);
    expect(countRows(database, "fulfillment")).toBe(0);
    expect(countRows(database, "event_outbox")).toBe(0);
    expect(countRows(database, "user")).toBe(0);

    database.close();
  });
});
