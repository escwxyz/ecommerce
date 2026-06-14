import type { Kysely } from "kysely";
import { sql } from "kysely";

import type {
  InventoryAdjustmentEventRecord,
  InventoryAdjustmentEventRow,
  InventoryDatabase,
  InventoryItemRecord,
  InventoryItemRow,
  InventoryLevelRecord,
  InventoryLevelRow,
  InventoryRepository,
  InventoryReservationRecord,
  InventoryReservationSaveResult,
  InventoryReservationRow,
  StockLocationRecord,
  StockLocationRow,
} from "../../domain";
import {
  createInventoryAdjustmentEventId,
  createInventoryItemId,
  createInventoryLevelId,
  createInventoryReservationId,
  createStockLocationId,
} from "../../domain";

export type InventoryD1Database = Kysely<InventoryDatabase>;

export interface CreateD1InventoryRepositoryOptions {
  readonly db: InventoryD1Database;
}

const parseJsonColumn = <Value>(value: string): Value => JSON.parse(value);
const toJsonColumn = (value: unknown): string => JSON.stringify(value);
const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "SQLITE_CONSTRAINT_UNIQUE";

const toInventoryItemRecord = (row: InventoryItemRow): InventoryItemRecord => ({
  createdAt: new Date(row.created_at),
  id: createInventoryItemId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  sku: row.sku,
  title: row.title,
  updatedAt: new Date(row.updated_at),
});

const toStockLocationRecord = (row: StockLocationRow): StockLocationRecord => ({
  createdAt: new Date(row.created_at),
  id: createStockLocationId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  name: row.name,
  salesChannelIds: parseJsonColumn(row.sales_channel_ids_json),
  updatedAt: new Date(row.updated_at),
});

const toInventoryLevelRecord = (
  row: InventoryLevelRow
): InventoryLevelRecord => ({
  createdAt: new Date(row.created_at),
  id: createInventoryLevelId(row.id),
  inventoryItemId: createInventoryItemId(row.inventory_item_id),
  reservedQuantity: row.reserved_quantity,
  stockLocationId: createStockLocationId(row.stock_location_id),
  stockedQuantity: row.stocked_quantity,
  updatedAt: new Date(row.updated_at),
});

const toInventoryReservationRecord = (
  row: InventoryReservationRow
): InventoryReservationRecord => ({
  causationId: row.causation_id,
  correlationId: row.correlation_id,
  createdAt: new Date(row.created_at),
  id: createInventoryReservationId(row.id),
  idempotencyKey: row.idempotency_key,
  inventoryItemId: createInventoryItemId(row.inventory_item_id),
  quantity: row.quantity,
  releasedAt: row.released_at === null ? null : new Date(row.released_at),
  salesChannelId: row.sales_channel_id,
  status: row.status as InventoryReservationRecord["status"],
  stockLocationId: createStockLocationId(row.stock_location_id),
  updatedAt: new Date(row.updated_at),
  workflowRunId: row.workflow_run_id,
});

const toInventoryAdjustmentEventRecord = (
  row: InventoryAdjustmentEventRow
): InventoryAdjustmentEventRecord => ({
  adjustment: row.adjustment,
  causationId: row.causation_id,
  correlationId: row.correlation_id,
  createdAt: new Date(row.created_at),
  id: createInventoryAdjustmentEventId(row.id),
  inventoryItemId: createInventoryItemId(row.inventory_item_id),
  reason: row.reason as InventoryAdjustmentEventRecord["reason"],
  stockLocationId: createStockLocationId(row.stock_location_id),
  updatedStockedQuantity: row.updated_stocked_quantity,
  workflowRunId: row.workflow_run_id,
});

export const createD1InventoryRepository = ({
  db,
}: CreateD1InventoryRepositoryOptions): InventoryRepository => ({
  findAdjustmentEvents: async (inventoryItemId) => {
    const rows = await db
      .selectFrom("inventory_adjustment_event")
      .selectAll()
      .where("inventory_item_id", "=", inventoryItemId)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toInventoryAdjustmentEventRecord);
  },
  findInventoryItemById: async (id) => {
    const row = await db
      .selectFrom("inventory_item")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toInventoryItemRecord(row) : null;
  },
  findLevel: async (inventoryItemId, stockLocationId) => {
    const row = await db
      .selectFrom("inventory_level")
      .selectAll()
      .where("inventory_item_id", "=", inventoryItemId)
      .where("stock_location_id", "=", stockLocationId)
      .executeTakeFirst();

    return row ? toInventoryLevelRecord(row) : null;
  },
  findReservationByIdempotencyKey: async (idempotencyKey) => {
    const row = await db
      .selectFrom("inventory_reservation")
      .selectAll()
      .where("idempotency_key", "=", idempotencyKey)
      .executeTakeFirst();

    return row ? toInventoryReservationRecord(row) : null;
  },
  findReservationsForLevel: async (inventoryItemId, stockLocationId) => {
    const rows = await db
      .selectFrom("inventory_reservation")
      .selectAll()
      .where("inventory_item_id", "=", inventoryItemId)
      .where("stock_location_id", "=", stockLocationId)
      .where("status", "=", "active")
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toInventoryReservationRecord);
  },
  findStockLocationById: async (id) => {
    const row = await db
      .selectFrom("inventory_stock_location")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toStockLocationRecord(row) : null;
  },
  listStockLocationsForSalesChannel: async (salesChannelId) => {
    const rows = await db
      .selectFrom("inventory_stock_location")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    return rows
      .map(toStockLocationRecord)
      .filter((location) => location.salesChannelIds.includes(salesChannelId));
  },
  saveAdjustmentEvent: async (event) => {
    await db
      .insertInto("inventory_adjustment_event")
      .values({
        adjustment: event.adjustment,
        causation_id: event.causationId,
        correlation_id: event.correlationId,
        created_at: event.createdAt.getTime(),
        id: event.id,
        inventory_item_id: event.inventoryItemId,
        reason: event.reason,
        stock_location_id: event.stockLocationId,
        updated_stocked_quantity: event.updatedStockedQuantity,
        workflow_run_id: event.workflowRunId,
      })
      .execute();

    return event;
  },
  saveInventoryItem: async (item) => {
    const values = {
      created_at: item.createdAt.getTime(),
      id: item.id,
      metadata_json: toJsonColumn(item.metadata),
      sku: item.sku,
      title: item.title,
      updated_at: item.updatedAt.getTime(),
    } as const;

    await db
      .insertInto("inventory_item")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          metadata_json: values.metadata_json,
          sku: values.sku,
          title: values.title,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return item;
  },
  saveLevel: async (level) => {
    const values = {
      created_at: level.createdAt.getTime(),
      id: level.id,
      inventory_item_id: level.inventoryItemId,
      reserved_quantity: level.reservedQuantity,
      stock_location_id: level.stockLocationId,
      stocked_quantity: level.stockedQuantity,
      updated_at: level.updatedAt.getTime(),
    } as const;

    await db
      .insertInto("inventory_level")
      .values(values)
      .onConflict((conflict) =>
        conflict
          .columns(["inventory_item_id", "stock_location_id"])
          .doUpdateSet({
            reserved_quantity: values.reserved_quantity,
            stocked_quantity: values.stocked_quantity,
            updated_at: values.updated_at,
          })
      )
      .execute();

    return level;
  },
  saveReservationIfAvailable: async (reservation) => {
    const existing = await db
      .selectFrom("inventory_reservation")
      .selectAll()
      .where("idempotency_key", "=", reservation.idempotencyKey)
      .executeTakeFirst();

    if (existing) {
      return {
        reservation: toInventoryReservationRecord(existing),
        status: "duplicate",
      } satisfies InventoryReservationSaveResult;
    }

    const updateResult = await db
      .updateTable("inventory_level")
      .set({
        reserved_quantity: sql<number>`reserved_quantity + ${reservation.quantity}`,
        updated_at: reservation.updatedAt.getTime(),
      })
      .where("inventory_item_id", "=", reservation.inventoryItemId)
      .where("stock_location_id", "=", reservation.stockLocationId)
      .where(
        sql<boolean>`stocked_quantity - reserved_quantity >= ${reservation.quantity}`
      )
      .executeTakeFirst();

    if (updateResult.numUpdatedRows === 0n) {
      return {
        status: "insufficient-stock",
      } satisfies InventoryReservationSaveResult;
    }

    const values = {
      causation_id: reservation.causationId,
      correlation_id: reservation.correlationId,
      created_at: reservation.createdAt.getTime(),
      id: reservation.id,
      idempotency_key: reservation.idempotencyKey,
      inventory_item_id: reservation.inventoryItemId,
      quantity: reservation.quantity,
      released_at: reservation.releasedAt?.getTime() ?? null,
      sales_channel_id: reservation.salesChannelId,
      status: reservation.status,
      stock_location_id: reservation.stockLocationId,
      updated_at: reservation.updatedAt.getTime(),
      workflow_run_id: reservation.workflowRunId,
    } as const;

    try {
      await db.insertInto("inventory_reservation").values(values).execute();
    } catch (error) {
      await db
        .updateTable("inventory_level")
        .set({
          reserved_quantity: sql<number>`reserved_quantity - ${reservation.quantity}`,
          updated_at: reservation.updatedAt.getTime(),
        })
        .where("inventory_item_id", "=", reservation.inventoryItemId)
        .where("stock_location_id", "=", reservation.stockLocationId)
        .execute();

      if (isUniqueConstraintError(error)) {
        const duplicate = await db
          .selectFrom("inventory_reservation")
          .selectAll()
          .where("idempotency_key", "=", reservation.idempotencyKey)
          .executeTakeFirst();

        if (duplicate) {
          return {
            reservation: toInventoryReservationRecord(duplicate),
            status: "duplicate",
          } satisfies InventoryReservationSaveResult;
        }
      }

      throw error;
    }

    return {
      reservation,
      status: "reserved",
    } satisfies InventoryReservationSaveResult;
  },
  saveReservation: async (reservation) => {
    const result = await createD1InventoryRepository({
      db,
    }).saveReservationIfAvailable(reservation);

    if (result.status !== "reserved") {
      throw new Error("Inventory reservation could not be saved.");
    }

    return result.reservation;
  },
  saveStockLocation: async (location) => {
    const values = {
      created_at: location.createdAt.getTime(),
      id: location.id,
      metadata_json: toJsonColumn(location.metadata),
      name: location.name,
      sales_channel_ids_json: toJsonColumn(location.salesChannelIds),
      updated_at: location.updatedAt.getTime(),
    } as const;

    await db
      .insertInto("inventory_stock_location")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          metadata_json: values.metadata_json,
          name: values.name,
          sales_channel_ids_json: values.sales_channel_ids_json,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return location;
  },
});
