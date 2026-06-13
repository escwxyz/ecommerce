import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";

import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import { createD1InventoryRepository } from "../adapters/d1";
import {
  createInventoryAdjustmentEventId,
  createInventoryItemId,
  createInventoryLevelId,
  createInventoryReservationId,
  createStockLocationId,
  inventoryMigration,
  type InventoryDatabase,
  type InventoryRepository,
} from "../domain";
import { createResettableInMemoryInventoryRepository } from "../repositories";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const inventoryItemId = createInventoryItemId("iitem_contract");
const stockLocationId = createStockLocationId("sloc_contract");

const createInventoryItem = () => ({
  createdAt,
  id: inventoryItemId,
  metadata: {},
  sku: "contract-sku",
  title: "Contract item",
  updatedAt: createdAt,
});

const createStockLocation = () => ({
  createdAt,
  id: stockLocationId,
  metadata: {},
  name: "Contract warehouse",
  salesChannelIds: ["sc_contract"],
  updatedAt: createdAt,
});

interface RepositoryTestContext {
  readonly cleanup?: () => void;
  readonly repository: InventoryRepository;
}

const runInventoryRepositoryContract = (
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

    it("saves and reads inventory items and scoped locations", async () => {
      const repository = await setup();
      const item = createInventoryItem();
      const location = createStockLocation();

      await expect(repository.saveInventoryItem(item)).resolves.toEqual(item);
      await expect(repository.saveStockLocation(location)).resolves.toEqual(
        location
      );
      await expect(repository.findInventoryItemById(item.id)).resolves.toEqual(
        item
      );
      await expect(
        repository.findStockLocationById(location.id)
      ).resolves.toEqual(location);
      await expect(
        repository.listStockLocationsForSalesChannel("sc_contract")
      ).resolves.toEqual([location]);
    });

    it("saves levels, reservations, and adjustment events", async () => {
      const repository = await setup();
      const item = createInventoryItem();
      const location = createStockLocation();
      const level = {
        createdAt,
        id: createInventoryLevelId("ilvl_contract"),
        inventoryItemId: item.id,
        reservedQuantity: 0,
        stockLocationId: location.id,
        stockedQuantity: 10,
        updatedAt: createdAt,
      };
      const reservation = {
        causationId: null,
        correlationId: "corr_contract",
        createdAt,
        id: createInventoryReservationId("ires_contract"),
        idempotencyKey: "reserve_contract",
        inventoryItemId: item.id,
        quantity: 2,
        releasedAt: null,
        salesChannelId: "sc_contract",
        status: "active" as const,
        stockLocationId: location.id,
        updatedAt: createdAt,
        workflowRunId: "workflow_contract",
      };
      const event = {
        adjustment: 5,
        causationId: null,
        correlationId: "corr_contract",
        createdAt,
        id: createInventoryAdjustmentEventId("iadj_contract"),
        inventoryItemId: item.id,
        reason: "restock" as const,
        stockLocationId: location.id,
        updatedStockedQuantity: 15,
        workflowRunId: "workflow_contract",
      };

      await repository.saveInventoryItem(item);
      await repository.saveStockLocation(location);
      await expect(repository.saveLevel(level)).resolves.toEqual(level);
      await expect(repository.findLevel(item.id, location.id)).resolves.toEqual(
        level
      );
      await expect(repository.saveReservation(reservation)).resolves.toEqual(
        reservation
      );
      await expect(
        repository.findReservationByIdempotencyKey("reserve_contract")
      ).resolves.toEqual(reservation);
      await expect(
        repository.findReservationsForLevel(item.id, location.id)
      ).resolves.toEqual([reservation]);
      await expect(repository.saveAdjustmentEvent(event)).resolves.toEqual(
        event
      );
      await expect(repository.findAdjustmentEvents(item.id)).resolves.toEqual([
        event,
      ]);
    });

    it("atomically reserves only available stock", async () => {
      const repository = await setup();
      const item = createInventoryItem();
      const location = createStockLocation();
      const level = {
        createdAt,
        id: createInventoryLevelId("ilvl_atomic"),
        inventoryItemId: item.id,
        reservedQuantity: 0,
        stockLocationId: location.id,
        stockedQuantity: 1,
        updatedAt: createdAt,
      };
      const firstReservation = {
        causationId: null,
        correlationId: "corr_atomic_1",
        createdAt,
        id: createInventoryReservationId("ires_atomic_1"),
        idempotencyKey: "reserve_atomic_1",
        inventoryItemId: item.id,
        quantity: 1,
        releasedAt: null,
        salesChannelId: "sc_contract",
        status: "active" as const,
        stockLocationId: location.id,
        updatedAt: createdAt,
        workflowRunId: null,
      };
      const secondReservation = {
        ...firstReservation,
        correlationId: "corr_atomic_2",
        id: createInventoryReservationId("ires_atomic_2"),
        idempotencyKey: "reserve_atomic_2",
      };

      await repository.saveInventoryItem(item);
      await repository.saveStockLocation(location);
      await repository.saveLevel(level);

      await expect(
        repository.saveReservationIfAvailable(firstReservation)
      ).resolves.toEqual({
        reservation: firstReservation,
        status: "reserved",
      });
      await expect(
        repository.saveReservationIfAvailable(secondReservation)
      ).resolves.toEqual({
        status: "insufficient-stock",
      });
      await expect(repository.findLevel(item.id, location.id)).resolves.toEqual(
        {
          ...level,
          reservedQuantity: 1,
        }
      );
      await expect(
        repository.findReservationsForLevel(item.id, location.id)
      ).resolves.toEqual([firstReservation]);
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

const createKyselyD1InventoryDatabase = (sqlite: Database) =>
  new Kysely<InventoryDatabase>({
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

runInventoryRepositoryContract("in-memory inventory repository", () => ({
  repository: createResettableInMemoryInventoryRepository(),
}));

runInventoryRepositoryContract("D1 inventory repository", async () => {
  const sqlite = new Database(":memory:");
  const db = createKyselyD1InventoryDatabase(sqlite);
  await inventoryMigration.up(db);

  return {
    cleanup: () => {
      db.destroy();
      sqlite.close();
    },
    repository: createD1InventoryRepository({ db }),
  };
});
