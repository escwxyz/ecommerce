import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";

import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import { createD1StoreRepository } from "../adapters/d1";
import {
  createStoreId,
  storeMigration,
  storeSchema,
  storeTableName,
  type StoreDatabase,
  type StoreLegacyRepository,
  type StoreSettings,
} from "../domain";
import {
  createInMemoryStoreRepository,
  createStoreLegacyRepositoryFromRepository,
} from "../repositories";

const createStoreSettings = (name: string): StoreSettings => ({
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  defaultCurrencyCode: "USD",
  defaultLocale: "en-US",
  defaultRegionId: null,
  defaultSalesChannelId: null,
  id: createStoreId("store_contract"),
  metadata: {},
  name,
  supportedCurrencyCodes: ["USD"],
  timezone: "UTC",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

interface RepositoryTestContext {
  readonly cleanup?: () => void;
  readonly repository: StoreLegacyRepository;
}

const runStoreRepositoryContract = (
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

    it("saves and reads store settings", async () => {
      const repository = await setup();
      const settings = createStoreSettings("Contract Store");

      await expect(repository.getStoreSettings()).resolves.toBeNull();
      await expect(repository.saveStoreSettings(settings)).resolves.toEqual(
        settings
      );
      await expect(repository.getStoreSettings()).resolves.toEqual(settings);
    });

    it("replaces the singleton store settings record", async () => {
      const repository = await setup();

      await repository.saveStoreSettings(createStoreSettings("First"));
      await repository.saveStoreSettings(createStoreSettings("Second"));

      await expect(repository.getStoreSettings()).resolves.toMatchObject({
        name: "Second",
      });
    });
  });
};

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

const createKyselyD1StoreDatabase = (sqlite: Database) =>
  new Kysely<StoreDatabase>({
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

runStoreRepositoryContract("in-memory store repository", () => ({
  repository: createStoreLegacyRepositoryFromRepository(
    createInMemoryStoreRepository()
  ),
}));

runStoreRepositoryContract("D1 store repository", async () => {
  const sqlite = new Database(":memory:");
  const db = createKyselyD1StoreDatabase(sqlite);
  await storeMigration.up(db);

  return {
    cleanup: () => sqlite.close(),
    repository: createD1StoreRepository({ db }),
  };
});

describe("store schema contribution", () => {
  it("declares the owned store table and migration hooks", () => {
    expect(storeTableName).toBe("store");
    expect(storeSchema).toEqual({
      store: "store",
    });
    expect(typeof storeMigration.up).toBe("function");
    expect(typeof storeMigration.down).toBe("function");
  });

  it("creates the store table through the Kysely migration", async () => {
    const sqlite = new Database(":memory:");
    const db = createKyselyD1StoreDatabase(sqlite);

    await storeMigration.up(db);

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toContain("store");

    sqlite.close();
  });
});
