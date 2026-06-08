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
  productCatalogMigration,
  productMigration,
  type ProductDatabase,
  type ProductRepository,
} from "../domain";
import { createInMemoryProductRepository } from "../repositories";
import { createProductService } from "../services";

const emptyCatalog = {
  categories: [],
  collections: [],
  media: [],
  metadata: {},
  options: [],
  publishedAt: null,
  searchableText: "",
  tags: [],
  variants: [],
};

interface RepositoryTestContext {
  readonly cleanup?: () => void;
  readonly repository: ProductRepository;
}

const createProductRecord = (id: string, createdAt: Date) => ({
  catalog: emptyCatalog,
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

    it("updates product-owned catalog fields without changing identity", async () => {
      const repository = setup();
      const product = createProductRecord(
        "prod_contract_catalog",
        new Date("2026-01-01T00:00:00.000Z")
      );
      await repository.saveProduct(product);

      const updated = {
        ...product,
        catalog: {
          ...product.catalog,
          options: [
            {
              id: "opt_size",
              metadata: {},
              title: "Size",
              values: [
                {
                  id: "optval_small",
                  label: "Small",
                  metadata: {},
                  value: "S",
                },
              ],
            },
          ],
          variants: [
            {
              id: "variant_small",
              metadata: {},
              optionValueIds: ["optval_small"],
              status: "active" as const,
              title: "Small",
            },
          ],
        },
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      };

      await expect(repository.updateProduct(updated)).resolves.toEqual(updated);
      await expect(repository.findProductById(product.id)).resolves.toEqual(
        updated
      );
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
      catalog_metadata text not null,
      catalog_searchable_text text not null,
      catalog_published_at integer,
      created_at integer not null,
      updated_at integer not null
    )
  `);
  sqlite.run("create unique index product_handle_idx on product(handle)");
  sqlite.run(`
    create table product_variant (
      id text primary key,
      product_id text not null,
      title text not null,
      sku text,
      status text not null,
      option_value_ids text not null,
      searchable_text text,
      metadata text not null
    )
  `);
  sqlite.run(`
    create table product_option (
      id text primary key,
      product_id text not null,
      title text not null,
      metadata text not null
    )
  `);
  sqlite.run(`
    create table product_option_value (
      id text primary key,
      option_id text not null,
      label text not null,
      value text not null,
      metadata text not null
    )
  `);
  sqlite.run(`
    create table product_variant_option (
      variant_id text not null,
      option_value_id text not null,
      primary key (variant_id, option_value_id)
    )
  `);
  sqlite.run(`
    create table product_collection (
      id text primary key,
      handle text not null,
      title text not null
    )
  `);
  sqlite.run(`
    create table product_collection_product (
      product_id text not null,
      product_collection_id text not null,
      primary key (product_id, product_collection_id)
    )
  `);
  sqlite.run(`
    create table product_category (
      id text primary key,
      handle text not null,
      title text not null,
      parent_id text
    )
  `);
  sqlite.run(`
    create table product_category_product (
      product_id text not null,
      product_category_id text not null,
      primary key (product_id, product_category_id)
    )
  `);
  sqlite.run(`
    create table product_media (
      id text primary key,
      product_id text not null,
      url text not null,
      type text not null,
      alt_text text,
      metadata text not null
    )
  `);
  sqlite.run(`
    create table product_tag (
      id text primary key,
      value text not null
    )
  `);
  sqlite.run(`
    create table product_tags (
      product_id text not null,
      product_tag_id text not null,
      primary key (product_id, product_tag_id)
    )
  `);
  sqlite.run(`
    create table product_type (
      id text primary key,
      value text not null
    )
  `);
  sqlite.run(`
    create table product_type_product (
      product_id text not null,
      product_type_id text not null,
      primary key (product_id, product_type_id)
    )
  `);
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
      catalog: emptyCatalog,
      createdAt,
      handle: "duplicate-handle",
      id: createProductId("prod_first"),
      status: "draft",
      title: "First product",
      updatedAt: createdAt,
    });

    await expect(
      repository.saveProduct({
        catalog: emptyCatalog,
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

  it("persists expanded catalog entities in normalized product tables", async () => {
    const sqlite = new Database(":memory:");
    createSqliteProductTable(sqlite);
    const db = createKyselyD1ProductDatabase(sqlite);
    const repository = createD1ProductRepository({ db });
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const product = createProductRecord("prod_normalized", createdAt);

    await repository.saveProduct(product);
    await repository.setProductCatalogMetadata({
      metadata: {
        season: "summer",
      },
      productId: product.id,
      publishedAt: new Date("2026-01-02T00:00:00.000Z"),
      searchableText: "Normalized shirt",
    });
    await repository.addProductOption(product.id, {
      id: "opt_size",
      metadata: {},
      title: "Size",
      values: [
        {
          id: "optval_medium",
          label: "Medium",
          metadata: {},
          value: "M",
        },
      ],
    });
    await repository.addProductVariant(product.id, {
      id: "variant_medium",
      metadata: {},
      optionValueIds: ["optval_medium"],
      status: "active",
      title: "Medium",
    });
    await repository.addProductCollection(product.id, {
      handle: "summer",
      id: "pcol_summer",
      title: "Summer",
    });
    await repository.addProductCategory(product.id, {
      handle: "shirts",
      id: "pcat_shirts",
      title: "Shirts",
    });
    await repository.addProductMedia(product.id, {
      altText: "Front of shirt",
      id: "img_front",
      metadata: {},
      type: "image",
      url: "https://example.com/front.jpg",
    });
    await repository.addProductTag(product.id, "featured");

    const countRows = (tableName: string) =>
      sqlite.query(`select count(*) as count from ${tableName}`).get() as {
        count: number;
      };

    expect(countRows("product_variant").count).toBe(1);
    expect(countRows("product_option").count).toBe(1);
    expect(countRows("product_option_value").count).toBe(1);
    expect(countRows("product_variant_option").count).toBe(1);
    expect(countRows("product_collection").count).toBe(1);
    expect(countRows("product_collection_product").count).toBe(1);
    expect(countRows("product_category").count).toBe(1);
    expect(countRows("product_category_product").count).toBe(1);
    expect(countRows("product_media").count).toBe(1);
    expect(countRows("product_tag").count).toBe(1);
    expect(countRows("product_tags").count).toBe(1);

    await expect(repository.findProductById(product.id)).resolves.toMatchObject(
      {
        catalog: {
          categories: [{ id: "pcat_shirts" }],
          collections: [{ id: "pcol_summer" }],
          media: [{ id: "img_front" }],
          tags: ["featured"],
          variants: [{ id: "variant_medium" }],
        },
      }
    );

    sqlite.close();
  });

  it("updates products with shared catalog references without duplicating global rows", async () => {
    const sqlite = new Database(":memory:");
    createSqliteProductTable(sqlite);
    const db = createKyselyD1ProductDatabase(sqlite);
    const repository = createD1ProductRepository({ db });
    const createdAt = new Date("2026-01-01T00:00:00.000Z");

    const initial = {
      ...createProductRecord("prod_shared_refs", createdAt),
      catalog: {
        ...emptyCatalog,
        categories: [
          {
            handle: "shirts",
            id: "pcat_shirts",
            title: "Shirts",
          },
        ],
        collections: [
          {
            handle: "summer",
            id: "pcol_summer",
            title: "Summer",
          },
        ],
        tags: ["featured"],
      },
    };

    await repository.saveProduct(initial);

    const updated = {
      ...initial,
      catalog: {
        ...initial.catalog,
        metadata: { season: "summer" },
        searchableText: "Shared reference update",
      },
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };

    await expect(repository.updateProduct(updated)).resolves.toEqual(updated);

    const countRows = (tableName: string) =>
      sqlite.query(`select count(*) as count from ${tableName}`).get() as {
        count: number;
      };

    expect(countRows("product_collection").count).toBe(1);
    expect(countRows("product_collection_product").count).toBe(1);
    expect(countRows("product_category").count).toBe(1);
    expect(countRows("product_category_product").count).toBe(1);
    expect(countRows("product_tag").count).toBe(1);
    expect(countRows("product_tags").count).toBe(1);

    await expect(repository.findProductById(updated.id)).resolves.toEqual(
      updated
    );

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
    const columns = sqlite
      .query("pragma table_info('product')")
      .all() as Array<{
      name: string;
    }>;

    expect(table).toBeDefined();
    expect(index).toBeDefined();
    expect(columns.map((column) => column.name)).not.toContain(
      "catalog_metadata"
    );
    expect(
      uniqueIndex.find((candidate) => candidate.name === "product_handle_idx")
    ).toMatchObject({
      name: "product_handle_idx",
      unique: 1,
    });
    sqlite.close();
  });

  it("upgrades an existing product table with catalog expansion tables", async () => {
    const sqlite = new Database(":memory:");
    const db = createKyselyD1ProductDatabase(sqlite);

    await productMigration.up(db);
    await productCatalogMigration.up(db);

    const tableNames = sqlite
      .query("select name from sqlite_master where type = 'table'")
      .all() as Array<{ name: string }>;
    const columns = sqlite
      .query("pragma table_info('product')")
      .all() as Array<{
      name: string;
    }>;

    expect(tableNames.map((candidate) => candidate.name)).toEqual(
      expect.arrayContaining([
        "product_variant",
        "product_option",
        "product_option_value",
        "product_variant_option",
        "product_collection",
        "product_collection_product",
        "product_category",
        "product_category_product",
        "product_media",
        "product_tag",
        "product_tags",
        "product_type",
        "product_type_product",
      ])
    );
    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "catalog_metadata",
        "catalog_searchable_text",
        "catalog_published_at",
      ])
    );
    sqlite.close();
  });
});
