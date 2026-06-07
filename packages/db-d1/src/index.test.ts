import { Database, type SQLQueryBindings } from "bun:sqlite";
import { describe, expect, it } from "bun:test";

import type { D1Database } from "@cloudflare/workers-types";
import { columnExists, indexExists, tableExists } from "@ecommerce/db";

import { createD1Database, migrateD1ToLatest } from "./index";

const createFakeBinding = (): D1Database =>
  ({
    prepare: () => ({
      bind: () => ({
        all: () =>
          Promise.resolve({
            meta: { changes: 0, last_row_id: 0 },
            results: [],
            success: true,
          }),
      }),
    }),
  }) as unknown as D1Database;

const createSqliteBackedFakeBinding = (sqlite: Database): D1Database =>
  ({
    batch: async (statements: readonly FakeD1PreparedStatement[]) =>
      Promise.all(statements.map((statement) => statement.all())),
    exec: async (query: string) => {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
    prepare: (query: string) => new FakeD1PreparedStatement(sqlite, query),
  }) as unknown as D1Database;

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

describe("db d1 adapter", () => {
  it("creates a Kysely runtime from an explicit D1 binding", () => {
    const database = createD1Database(createFakeBinding());

    expect(database.db).toBeDefined();
    expect(database.authDatabase).toBeDefined();
    expect(database.supportsRequestScope).toBe(true);
    expect(database.type).toBe("sqlite");
  });

  it("exposes a migration runner for the D1-backed Kysely runtime", async () => {
    const database = createD1Database(createFakeBinding());
    const result = await migrateD1ToLatest(database.db);

    expect(result).toHaveProperty("results");
    await expect(tableExists(database.db, "product")).resolves.toBe(false);
  });

  it("applies the commerce auth and product migrations on D1-compatible SQLite", async () => {
    const sqlite = new Database(":memory:");
    const database = createD1Database(createSqliteBackedFakeBinding(sqlite));

    const result = await migrateD1ToLatest(database.db);

    expect(result.error).toBeUndefined();
    await expect(tableExists(database.db, "user")).resolves.toBe(true);
    await expect(tableExists(database.db, "session")).resolves.toBe(true);
    await expect(tableExists(database.db, "account")).resolves.toBe(true);
    await expect(tableExists(database.db, "verification")).resolves.toBe(true);
    await expect(tableExists(database.db, "product")).resolves.toBe(true);
    await expect(columnExists(database.db, "user", "role")).resolves.toBe(true);
    await expect(columnExists(database.db, "user", "banned")).resolves.toBe(
      true
    );
    await expect(
      columnExists(database.db, "session", "impersonatedBy")
    ).resolves.toBe(true);
    await expect(indexExists(database.db, "session_userId_idx")).resolves.toBe(
      true
    );
    await expect(indexExists(database.db, "product_handle_idx")).resolves.toBe(
      true
    );

    sqlite.close();
  });
});
