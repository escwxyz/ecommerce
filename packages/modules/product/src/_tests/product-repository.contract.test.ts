import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";

import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import { createD1ProductRepository } from "../adapters/d1";
import {
  createProductId,
  productMigration,
  type ProductDatabase,
  type ProductRepository,
} from "../domain";
import { createInMemoryProductRepository } from "../repositories";
import { createProductService } from "../services";

interface RepositoryTestContext {
  readonly cleanup?: () => void;
  readonly repository: ProductRepository;
}

const createProductRecord = (id: string, createdAt: Date) => ({
  createdAt,
  handle: `handle-${id}`,
  id: createProductId(id),
  status: "draft" as const,
  title: `Product ${id}`,
  updatedAt: createdAt,
});

const runProductRepositoryContract = (
  name: string,
  createContext: () => RepositoryTestContext
) => {
  describe(name, () => {
    let cleanup: (() => void) | undefined;

    afterEach(() => {
      cleanup?.();
      cleanup = undefined;
    });

    const setup = () => {
      const context = createContext();
      cleanup = context.cleanup;
      return context.repository;
    };

    it("saves and reads products by ID and handle", async () => {
      const repository = setup();
      const product = createProductRecord(
        "prod_contract_1",
        new Date("2026-01-01T00:00:00.000Z")
      );

      await expect(repository.saveProduct(product)).resolves.toEqual(product);
      await expect(repository.findProductById(product.id)).resolves.toEqual(
        product
      );
      await expect(
        repository.findProductByHandle(product.handle)
      ).resolves.toEqual(product);
    });

    it("returns null for missing products", async () => {
      const repository = setup();

      await expect(
        repository.findProductById(createProductId("prod_missing"))
      ).resolves.toBeNull();
      await expect(
        repository.findProductByHandle("missing")
      ).resolves.toBeNull();
    });

    it("lists newest products first", async () => {
      const repository = setup();
      const older = createProductRecord(
        "prod_contract_older",
        new Date("2026-01-01T00:00:00.000Z")
      );
      const newer = createProductRecord(
        "prod_contract_newer",
        new Date("2026-01-02T00:00:00.000Z")
      );

      await repository.saveProduct(older);
      await repository.saveProduct(newer);

      await expect(repository.listProducts()).resolves.toEqual([newer, older]);
    });

    it("preserves duplicate-handle service behavior", async () => {
      const repository = setup();
      const service = createProductService({
        clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
        idGenerator: createSequenceIdGenerator(["prod_a", "prod_b"]),
        repository,
      });

      await service.createProductDraft({
        handle: "duplicate",
        title: "Duplicate",
      });

      await expect(
        service.createProductDraft({
          handle: "duplicate",
          title: "Duplicate again",
        })
      ).rejects.toThrow(/already exists/);
    });
  });
};

const createSqliteProductTable = (sqlite: Database) => {
  sqlite.run(`
    create table product (
      id text primary key,
      handle text not null,
      title text not null,
      status text not null,
      created_at integer not null,
      updated_at integer not null
    )
  `);
  sqlite.run("create unique index product_handle_idx on product(handle)");
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

const createKyselyD1ProductDatabase = (sqlite: Database) =>
  new Kysely<ProductDatabase>({
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

runProductRepositoryContract("in-memory product repository", () => ({
  repository: createInMemoryProductRepository(),
}));

runProductRepositoryContract("D1 product repository", () => {
  const sqlite = new Database(":memory:");
  createSqliteProductTable(sqlite);
  const db = createKyselyD1ProductDatabase(sqlite);

  return {
    cleanup: () => sqlite.close(),
    repository: createD1ProductRepository({
      db,
    }),
  };
});

describe("D1 product repository persistence constraints", () => {
  it("rejects duplicate handles at the storage layer", async () => {
    const sqlite = new Database(":memory:");
    createSqliteProductTable(sqlite);
    const db = createKyselyD1ProductDatabase(sqlite);
    const repository = createD1ProductRepository({ db });
    const createdAt = new Date("2026-01-01T00:00:00.000Z");

    await repository.saveProduct({
      createdAt,
      handle: "duplicate-handle",
      id: createProductId("prod_first"),
      status: "draft",
      title: "First product",
      updatedAt: createdAt,
    });

    await expect(
      repository.saveProduct({
        createdAt,
        handle: "duplicate-handle",
        id: createProductId("prod_second"),
        status: "draft",
        title: "Second product",
        updatedAt: createdAt,
      })
    ).rejects.toThrow(/Product handle "duplicate-handle" already exists/);

    sqlite.close();
  });
});

describe("product Kysely migration", () => {
  it("creates the product table and unique handle index for D1-compatible SQLite", async () => {
    const sqlite = new Database(":memory:");
    const db = createKyselyD1ProductDatabase(sqlite);

    await productMigration.up(db);

    const table = sqlite
      .query("select name from sqlite_master where type = 'table' and name = ?")
      .get("product");
    const index = sqlite
      .query("select name from sqlite_master where type = 'index' and name = ?")
      .get("product_handle_idx");
    const uniqueIndex = sqlite
      .query("pragma index_list('product')")
      .all() as Array<{ name: string; unique: number }>;

    expect(table).toBeDefined();
    expect(index).toBeDefined();
    expect(
      uniqueIndex.find((candidate) => candidate.name === "product_handle_idx")
    ).toMatchObject({
      name: "product_handle_idx",
      unique: 1,
    });
    sqlite.close();
  });
});
