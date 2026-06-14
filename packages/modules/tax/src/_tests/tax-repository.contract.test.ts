import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";

import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import { createD1TaxRepository } from "../adapters/d1";
import {
  createTaxCategoryId,
  createTaxProviderConfigId,
  createTaxRateId,
  createTaxRegionId,
  taxMigration,
  type TaxCategoryRecord,
  type TaxDatabase,
  type TaxProviderConfigRecord,
  type TaxRateRecord,
  type TaxRegionRecord,
  type TaxRepository,
} from "../domain";
import { createInMemoryTaxRepository } from "../repositories";

const now = new Date("2026-01-01T00:00:00.000Z");

const createProviderConfig = (): TaxProviderConfigRecord => ({
  createdAt: now,
  id: createTaxProviderConfigId("txprov_contract"),
  isActive: true,
  metadata: {},
  providerKey: "manual",
  settings: {},
  updatedAt: now,
});

const createCategory = (): TaxCategoryRecord => ({
  code: "STANDARD",
  createdAt: now,
  description: null,
  id: createTaxCategoryId("txcat_contract"),
  metadata: {},
  name: "Standard",
  updatedAt: now,
});

const createRegion = (
  providerConfigId = createTaxProviderConfigId("txprov_contract")
): TaxRegionRecord => ({
  code: "US",
  countryCode: "US",
  createdAt: now,
  id: createTaxRegionId("txreg_contract"),
  metadata: {},
  name: "United States",
  providerConfigId,
  updatedAt: now,
});

const createRate = (): TaxRateRecord => ({
  categoryId: createTaxCategoryId("txcat_contract"),
  createdAt: now,
  id: createTaxRateId("txrate_contract"),
  metadata: {},
  name: "Standard tax",
  percentage: 7.5,
  regionId: createTaxRegionId("txreg_contract"),
  updatedAt: now,
});

const runTaxRepositoryContract = (
  name: string,
  createContext: () => Promise<RepositoryTestContext> | RepositoryTestContext
) => {
  describe(name, () => {
    let cleanup: (() => void) | undefined;

    afterEach(() => {
      cleanup?.();
      cleanup = undefined;
    });

    const setup = async () => {
      const context = await createContext();
      cleanup = context.cleanup;
      return context.repository;
    };

    it("saves and reads tax provider configs, categories, regions, and rates", async () => {
      const repository = await setup();
      const providerConfig = createProviderConfig();
      const category = createCategory();
      const region = createRegion();
      const rate = createRate();

      await repository.saveProviderConfig(providerConfig);
      await repository.saveCategory(category);
      await repository.saveRegion(region);
      await repository.saveRate(rate);

      await expect(
        repository.findProviderConfigById(providerConfig.id)
      ).resolves.toEqual(providerConfig);
      await expect(
        repository.findActiveProviderConfigByKey("manual")
      ).resolves.toEqual(providerConfig);
      await expect(repository.findCategoryById(category.id)).resolves.toEqual(
        category
      );
      await expect(repository.findRegionById(region.id)).resolves.toEqual(
        region
      );
      await expect(repository.findRatesByRegionId(region.id)).resolves.toEqual([
        rate,
      ]);
    });
  });
};

interface RepositoryTestContext {
  readonly cleanup?: () => void;
  readonly repository: TaxRepository;
}

const createFakeD1Binding = (sqlite: Database) => ({
  batch: async (statements: readonly FakeD1PreparedStatement[]) =>
    Promise.all(statements.map((statement) => statement.all())),
  exec: async (query: string) => {
    sqlite.exec(query);
    return { count: 0, duration: 0 };
  },
  prepare: (query: string) => new FakeD1PreparedStatement(sqlite, query),
});

type FakeD1Binding = ConstructorParameters<typeof D1Dialect>[0]["database"];

const createKyselyD1TaxDatabase = (sqlite: Database) =>
  new Kysely<TaxDatabase>({
    dialect: new D1Dialect({
      database: createFakeD1Binding(sqlite) as unknown as FakeD1Binding,
    }),
  });

class FakeD1PreparedStatement {
  readonly #query: string;
  readonly #sqlite: Database;
  readonly #values: readonly SQLQueryBindings[];

  constructor(
    sqlite: Database,
    query: string,
    values: readonly SQLQueryBindings[] = []
  ) {
    this.#query = query;
    this.#sqlite = sqlite;
    this.#values = values;
  }

  bind(...values: readonly SQLQueryBindings[]): FakeD1PreparedStatement {
    return new FakeD1PreparedStatement(this.#sqlite, this.#query, values);
  }

  all() {
    const normalizedQuery = this.#query.trim().toLowerCase();
    const statement = this.#sqlite.query(this.#query);

    if (
      normalizedQuery.startsWith("select") ||
      normalizedQuery.startsWith("pragma")
    ) {
      return Promise.resolve({
        meta: { changes: 0, last_row_id: 0 },
        results: statement.all(...this.#values),
        success: true,
      });
    }

    const result = statement.run(...this.#values);
    return Promise.resolve({
      meta: {
        changes: result.changes,
        last_row_id: Number(result.lastInsertRowid),
      },
      results: [],
      success: true,
    });
  }
}

const createMigratedD1TaxContext = async (): Promise<{
  readonly db: Kysely<TaxDatabase>;
  readonly repository: TaxRepository;
  readonly sqlite: Database;
}> => {
  const sqlite = new Database(":memory:");
  sqlite.exec("pragma foreign_keys = on");
  const db = createKyselyD1TaxDatabase(sqlite);
  await taxMigration.up(db);

  return {
    db,
    repository: createD1TaxRepository({ db }),
    sqlite,
  };
};

runTaxRepositoryContract("in-memory tax repository", () => ({
  repository: createInMemoryTaxRepository(),
}));

runTaxRepositoryContract("D1 tax repository", async () => {
  const { db, repository, sqlite } = await createMigratedD1TaxContext();

  return {
    cleanup: () => {
      db.destroy();
      sqlite.close();
    },
    repository,
  };
});

describe("tax migration", () => {
  it("creates the tax tables through the Kysely migration", async () => {
    const { db, sqlite } = await createMigratedD1TaxContext();

    try {
      const tables = sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name);

      expect(tables).toContain("tax_category");
      expect(tables).toContain("tax_provider_config");
      expect(tables).toContain("tax_region");
      expect(tables).toContain("tax_rate");
      expect(tables).toContain("tax_calculation_policy");
    } finally {
      await db.destroy();
      sqlite.close();
    }
  });
});
