import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  createInventoryAdjustmentEventId,
  createInventoryItemId,
  createInventoryLevelId,
  createInventoryReservationId,
  createStockLocationId,
} from "../domain";
import type {
  InventoryAdjustmentEventRecord,
  InventoryItemRecord,
  InventoryLevelRecord,
  InventoryRepository,
  InventoryReservationRecord,
  StockLocationRecord,
} from "../domain";
import { createInMemoryInventoryRepository } from "../repositories";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

const createInventoryItem = (): InventoryItemRecord => ({
  createdAt,
  id: createInventoryItemId("iitem_contract"),
  metadata: {},
  sku: "contract-sku",
  title: "Contract item",
  updatedAt: createdAt,
});

const createStockLocation = (): StockLocationRecord => ({
  createdAt,
  id: createStockLocationId("sloc_contract"),
  metadata: {},
  name: "Contract warehouse",
  salesChannelIds: ["sc_contract"],
  updatedAt: createdAt,
});

const runInventoryRepositoryContract = (
  name: string,
  createRepository: () => InventoryRepository
) => {
  describe(name, () => {
    it("saves and reads inventory items and scoped locations", async () => {
      const repository = createRepository();
      const item = createInventoryItem();
      const location = createStockLocation();

      await expect(
        Effect.runPromise(repository.saveInventoryItem(item))
      ).resolves.toEqual(item);
      await expect(
        Effect.runPromise(repository.saveStockLocation(location))
      ).resolves.toEqual(location);
      await expect(
        Effect.runPromise(repository.findInventoryItemById(item.id))
      ).resolves.toEqual(item);
      await expect(
        Effect.runPromise(repository.findStockLocationById(location.id))
      ).resolves.toEqual(location);
      await expect(
        Effect.runPromise(
          repository.listStockLocationsForSalesChannel("sc_contract")
        )
      ).resolves.toEqual([location]);
    });

    it("saves levels, reservations, and adjustment events", async () => {
      const repository = createRepository();
      const item = createInventoryItem();
      const location = createStockLocation();
      const level: InventoryLevelRecord = {
        createdAt,
        id: createInventoryLevelId("ilvl_contract"),
        inventoryItemId: item.id,
        reservedQuantity: 0,
        stockLocationId: location.id,
        stockedQuantity: 10,
        updatedAt: createdAt,
      };
      const reservation: InventoryReservationRecord = {
        causationId: null,
        correlationId: "corr_contract",
        createdAt,
        id: createInventoryReservationId("ires_contract"),
        idempotencyKey: "reserve_contract",
        inventoryItemId: item.id,
        quantity: 2,
        releasedAt: null,
        salesChannelId: "sc_contract",
        status: "active",
        stockLocationId: location.id,
        updatedAt: createdAt,
        workflowRunId: "workflow_contract",
      };
      const event: InventoryAdjustmentEventRecord = {
        adjustment: 5,
        causationId: null,
        correlationId: "corr_contract",
        createdAt,
        id: createInventoryAdjustmentEventId("iadj_contract"),
        idempotencyKey: "adjust_contract",
        inventoryItemId: item.id,
        reason: "restock",
        stockLocationId: location.id,
        updatedStockedQuantity: 15,
        workflowRunId: "workflow_contract",
      };

      await Effect.runPromise(repository.saveInventoryItem(item));
      await Effect.runPromise(repository.saveStockLocation(location));
      await expect(
        Effect.runPromise(repository.saveLevel(level))
      ).resolves.toEqual(level);
      await expect(
        Effect.runPromise(repository.findLevel(item.id, location.id))
      ).resolves.toEqual(level);
      await expect(
        Effect.runPromise(repository.saveReservation(reservation))
      ).resolves.toEqual(reservation);
      await expect(
        Effect.runPromise(
          repository.findReservationByIdempotencyKey("reserve_contract")
        )
      ).resolves.toEqual(reservation);
      await expect(
        Effect.runPromise(repository.findReservationsForLevel(item.id, location.id))
      ).resolves.toEqual([reservation]);
      await expect(
        Effect.runPromise(repository.saveAdjustmentEvent(event))
      ).resolves.toEqual(event);
      await expect(
        Effect.runPromise(
          repository.findAdjustmentEventByIdempotencyKey("adjust_contract")
        )
      ).resolves.toEqual(event);
      await expect(
        Effect.runPromise(repository.findAdjustmentEvents(item.id))
      ).resolves.toEqual([event]);
    });

    it("atomically reserves only available stock", async () => {
      const repository = createRepository();
      const item = createInventoryItem();
      const location = createStockLocation();
      const level: InventoryLevelRecord = {
        createdAt,
        id: createInventoryLevelId("ilvl_atomic"),
        inventoryItemId: item.id,
        reservedQuantity: 0,
        stockLocationId: location.id,
        stockedQuantity: 1,
        updatedAt: createdAt,
      };
      const reservation: InventoryReservationRecord = {
        causationId: null,
        correlationId: "corr_atomic",
        createdAt,
        id: createInventoryReservationId("ires_atomic"),
        idempotencyKey: "reserve_atomic",
        inventoryItemId: item.id,
        quantity: 1,
        releasedAt: null,
        salesChannelId: "sc_contract",
        status: "active",
        stockLocationId: location.id,
        updatedAt: createdAt,
        workflowRunId: null,
      };

      await Effect.runPromise(repository.saveInventoryItem(item));
      await Effect.runPromise(repository.saveStockLocation(location));
      await Effect.runPromise(repository.saveLevel(level));

      await expect(
        Effect.runPromise(repository.saveReservationIfAvailable(reservation))
      ).resolves.toMatchObject({ status: "reserved" });
      await expect(
        Effect.runPromise(
          repository.saveReservationIfAvailable({
            ...reservation,
            id: createInventoryReservationId("ires_atomic_2"),
            idempotencyKey: "reserve_atomic_2",
          })
        )
      ).resolves.toEqual({ status: "insufficient-stock" });
      await expect(
        Effect.runPromise(repository.findLevel(item.id, location.id))
      ).resolves.toMatchObject({ reservedQuantity: 1 });
    });
  });
};

runInventoryRepositoryContract("in-memory inventory repository", () =>
  createInMemoryInventoryRepository()
);
