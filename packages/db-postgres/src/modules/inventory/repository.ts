import {
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  InventoryAdjustmentEventRecordSchema,
  InventoryItemRecordSchema,
  InventoryLevelRecordSchema,
  InventoryRepositoryService,
  InventoryReservationRecordSchema,
  InventoryValidationFailure,
  StockLocationRecordSchema,
  createInventoryAdjustmentEventIdEffect,
  createInventoryItemIdEffect,
  createInventoryLevelIdEffect,
  createInventoryReservationIdEffect,
  createStockLocationIdEffect,
} from "@ecommerce/inventory";
import type {
  InventoryAdjustmentEventRecord,
  InventoryExpectedError,
  InventoryItemRecord,
  InventoryLevelRecord,
  InventoryRepository,
  InventoryReservationRecord,
  InventoryReservationSaveResult,
  StockLocationRecord,
} from "@ecommerce/inventory";
import { and, desc, eq } from "drizzle-orm";
import { Effect, Layer, Option, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import type { SqlError } from "effect/unstable/sql/SqlError";

import {
  CurrentPostgresTransactionService,
  PostgresDrizzleService,
} from "../../postgres-drizzle";
import type {
  PostgresDrizzleDatabase,
  PostgresDrizzleService as PostgresDrizzleServiceShape,
  PostgresDrizzleTransaction,
} from "../../postgres-drizzle";
import {
  InventoryAdjustmentEventPostgresInsertSchema,
  InventoryAdjustmentEventPostgresRowSchema,
  InventoryItemPostgresInsertSchema,
  InventoryItemPostgresRowSchema,
  InventoryLevelPostgresInsertSchema,
  InventoryLevelPostgresRowSchema,
  InventoryReservationPostgresInsertSchema,
  InventoryReservationPostgresRowSchema,
  StockLocationPostgresInsertSchema,
  StockLocationPostgresRowSchema,
  postgresInventoryAdjustmentEvent,
  postgresInventoryItem,
  postgresInventoryLevel,
  postgresInventoryReservation,
  postgresInventoryStockLocation,
} from "./schema";
import type {
  InventoryAdjustmentEventPostgresInsert,
  InventoryAdjustmentEventPostgresRow,
  InventoryItemPostgresInsert,
  InventoryItemPostgresRow,
  InventoryLevelPostgresInsert,
  InventoryLevelPostgresRow,
  InventoryReservationPostgresInsert,
  InventoryReservationPostgresRow,
  StockLocationPostgresInsert,
  StockLocationPostgresRow,
} from "./schema";

type InventoryPostgresExecutor =
  | PostgresDrizzleDatabase
  | PostgresDrizzleTransaction;

const inventoryRepositoryName = "InventoryRepository";

const toRepositoryUnavailable =
  (operation: "delete" | "read" | "write") => (): RepositoryUnavailable =>
    new RepositoryUnavailable({
      adapter: "effect-postgres",
      operation,
      repository: inventoryRepositoryName,
    });

const toRepositoryDecodeFailure = (
  entity:
    | "adjustment-event"
    | "inventory-item"
    | "inventory-level"
    | "reservation"
    | "stock-location",
  operation: "read" | "write"
): RepositoryDecodeFailure =>
  new RepositoryDecodeFailure({
    entity,
    operation,
    repository: inventoryRepositoryName,
  });

const getInventoryExecutor = (
  service: PostgresDrizzleServiceShape
): EffectValue<InventoryPostgresExecutor> =>
  Effect.map(
    Effect.serviceOption(CurrentPostgresTransactionService),
    Option.getOrElse(() => service.database)
  );

export const toInventoryItemPostgresInsert = (
  item: InventoryItemRecord
): EffectValue<InventoryItemPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(InventoryItemPostgresInsertSchema)({
    createdAt: item.createdAt,
    id: item.id,
    metadataJson: item.metadata,
    sku: item.sku,
    title: item.title,
    updatedAt: item.updatedAt,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("inventory-item", "write"))
  );

export const toStockLocationPostgresInsert = (
  location: StockLocationRecord
): EffectValue<StockLocationPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(StockLocationPostgresInsertSchema)({
    createdAt: location.createdAt,
    id: location.id,
    metadataJson: location.metadata,
    name: location.name,
    salesChannelIdsJson: location.salesChannelIds,
    updatedAt: location.updatedAt,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("stock-location", "write"))
  );

export const toInventoryLevelPostgresInsert = (
  level: InventoryLevelRecord
): EffectValue<InventoryLevelPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(InventoryLevelPostgresInsertSchema)({
    createdAt: level.createdAt,
    id: level.id,
    inventoryItemId: level.inventoryItemId,
    reservedQuantity: level.reservedQuantity,
    stockLocationId: level.stockLocationId,
    stockedQuantity: level.stockedQuantity,
    updatedAt: level.updatedAt,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("inventory-level", "write"))
  );

export const toInventoryReservationPostgresInsert = (
  reservation: InventoryReservationRecord
): EffectValue<InventoryReservationPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(InventoryReservationPostgresInsertSchema)({
    causationId: reservation.causationId,
    correlationId: reservation.correlationId,
    createdAt: reservation.createdAt,
    id: reservation.id,
    idempotencyKey: reservation.idempotencyKey,
    inventoryItemId: reservation.inventoryItemId,
    quantity: reservation.quantity,
    releasedAt: reservation.releasedAt,
    salesChannelId: reservation.salesChannelId,
    status: reservation.status,
    stockLocationId: reservation.stockLocationId,
    updatedAt: reservation.updatedAt,
    workflowRunId: reservation.workflowRunId,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("reservation", "write"))
  );

export const toInventoryAdjustmentEventPostgresInsert = (
  event: InventoryAdjustmentEventRecord
): EffectValue<
  InventoryAdjustmentEventPostgresInsert,
  RepositoryDecodeFailure
> =>
  Schema.decodeUnknownEffect(InventoryAdjustmentEventPostgresInsertSchema)({
    adjustment: event.adjustment,
    causationId: event.causationId,
    correlationId: event.correlationId,
    createdAt: event.createdAt,
    id: event.id,
    idempotencyKey: event.idempotencyKey,
    inventoryItemId: event.inventoryItemId,
    reason: event.reason,
    stockLocationId: event.stockLocationId,
    updatedStockedQuantity: event.updatedStockedQuantity,
    workflowRunId: event.workflowRunId,
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("adjustment-event", "write")
    )
  );

const toInventoryItemRecord = (
  row: InventoryItemPostgresRow
): EffectValue<InventoryItemRecord, InventoryExpectedError> =>
  Effect.gen(function* toInventoryItemRecordEffect() {
    const id = yield* createInventoryItemIdEffect(row.id);

    return yield* Schema.decodeUnknownEffect(InventoryItemRecordSchema)({
      createdAt: row.createdAt,
      id,
      metadata: row.metadataJson,
      sku: row.sku,
      title: row.title,
      updatedAt: row.updatedAt,
    }).pipe(
      Effect.mapError(() => toRepositoryDecodeFailure("inventory-item", "read"))
    );
  });

const toStockLocationRecord = (
  row: StockLocationPostgresRow
): EffectValue<StockLocationRecord, InventoryExpectedError> =>
  Effect.gen(function* toStockLocationRecordEffect() {
    const id = yield* createStockLocationIdEffect(row.id);

    return yield* Schema.decodeUnknownEffect(StockLocationRecordSchema)({
      createdAt: row.createdAt,
      id,
      metadata: row.metadataJson,
      name: row.name,
      salesChannelIds: row.salesChannelIdsJson,
      updatedAt: row.updatedAt,
    }).pipe(
      Effect.mapError(() => toRepositoryDecodeFailure("stock-location", "read"))
    );
  });

const toInventoryLevelRecord = (
  row: InventoryLevelPostgresRow
): EffectValue<InventoryLevelRecord, InventoryExpectedError> =>
  Effect.gen(function* toInventoryLevelRecordEffect() {
    const id = yield* createInventoryLevelIdEffect(row.id);
    const inventoryItemId = yield* createInventoryItemIdEffect(
      row.inventoryItemId
    );
    const stockLocationId = yield* createStockLocationIdEffect(
      row.stockLocationId
    );

    return yield* Schema.decodeUnknownEffect(InventoryLevelRecordSchema)({
      createdAt: row.createdAt,
      id,
      inventoryItemId,
      reservedQuantity: row.reservedQuantity,
      stockLocationId,
      stockedQuantity: row.stockedQuantity,
      updatedAt: row.updatedAt,
    }).pipe(
      Effect.mapError(() =>
        toRepositoryDecodeFailure("inventory-level", "read")
      )
    );
  });

const toInventoryReservationRecord = (
  row: InventoryReservationPostgresRow
): EffectValue<InventoryReservationRecord, InventoryExpectedError> =>
  Effect.gen(function* toInventoryReservationRecordEffect() {
    const id = yield* createInventoryReservationIdEffect(row.id);
    const inventoryItemId = yield* createInventoryItemIdEffect(
      row.inventoryItemId
    );
    const stockLocationId = yield* createStockLocationIdEffect(
      row.stockLocationId
    );

    return yield* Schema.decodeUnknownEffect(InventoryReservationRecordSchema)({
      causationId: row.causationId,
      correlationId: row.correlationId,
      createdAt: row.createdAt,
      id,
      idempotencyKey: row.idempotencyKey,
      inventoryItemId,
      quantity: row.quantity,
      releasedAt: row.releasedAt,
      salesChannelId: row.salesChannelId,
      status: row.status,
      stockLocationId,
      updatedAt: row.updatedAt,
      workflowRunId: row.workflowRunId,
    }).pipe(
      Effect.mapError(() => toRepositoryDecodeFailure("reservation", "read"))
    );
  });

const toInventoryAdjustmentEventRecord = (
  row: InventoryAdjustmentEventPostgresRow
): EffectValue<InventoryAdjustmentEventRecord, InventoryExpectedError> =>
  Effect.gen(function* toInventoryAdjustmentEventRecordEffect() {
    const id = yield* createInventoryAdjustmentEventIdEffect(row.id);
    const inventoryItemId = yield* createInventoryItemIdEffect(
      row.inventoryItemId
    );
    const stockLocationId = yield* createStockLocationIdEffect(
      row.stockLocationId
    );

    return yield* Schema.decodeUnknownEffect(
      InventoryAdjustmentEventRecordSchema
    )({
      adjustment: row.adjustment,
      causationId: row.causationId,
      correlationId: row.correlationId,
      createdAt: row.createdAt,
      id,
      idempotencyKey: row.idempotencyKey,
      inventoryItemId,
      reason: row.reason,
      stockLocationId,
      updatedStockedQuantity: row.updatedStockedQuantity,
      workflowRunId: row.workflowRunId,
    }).pipe(
      Effect.mapError(() =>
        toRepositoryDecodeFailure("adjustment-event", "read")
      )
    );
  });

const decodeInventoryItemRow = (
  row: unknown
): EffectValue<InventoryItemRecord, InventoryExpectedError> =>
  Schema.decodeUnknownEffect(InventoryItemPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("inventory-item", "read")),
    Effect.flatMap(toInventoryItemRecord)
  );

const decodeStockLocationRow = (
  row: unknown
): EffectValue<StockLocationRecord, InventoryExpectedError> =>
  Schema.decodeUnknownEffect(StockLocationPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("stock-location", "read")),
    Effect.flatMap(toStockLocationRecord)
  );

const decodeInventoryLevelRow = (
  row: unknown
): EffectValue<InventoryLevelRecord, InventoryExpectedError> =>
  Schema.decodeUnknownEffect(InventoryLevelPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("inventory-level", "read")),
    Effect.flatMap(toInventoryLevelRecord)
  );

const decodeReservationRow = (
  row: unknown
): EffectValue<InventoryReservationRecord, InventoryExpectedError> =>
  Schema.decodeUnknownEffect(InventoryReservationPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("reservation", "read")),
    Effect.flatMap(toInventoryReservationRecord)
  );

const decodeAdjustmentEventRow = (
  row: unknown
): EffectValue<InventoryAdjustmentEventRecord, InventoryExpectedError> =>
  Schema.decodeUnknownEffect(InventoryAdjustmentEventPostgresRowSchema)(
    row
  ).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("adjustment-event", "read")
    ),
    Effect.flatMap(toInventoryAdjustmentEventRecord)
  );

const saveReservationWithExecutor = ({
  executor,
  reservation,
}: {
  readonly executor: InventoryPostgresExecutor;
  readonly reservation: InventoryReservationRecord;
}): EffectValue<InventoryReservationSaveResult, InventoryExpectedError> =>
  Effect.gen(function* saveReservationWithExecutorEffect() {
    const [duplicateRow] = yield* executor
      .select()
      .from(postgresInventoryReservation)
      .where(
        eq(
          postgresInventoryReservation.idempotencyKey,
          reservation.idempotencyKey
        )
      )
      .limit(1)
      .pipe(Effect.mapError(toRepositoryUnavailable("read")));

    if (duplicateRow) {
      return {
        reservation: yield* decodeReservationRow(duplicateRow),
        status: "duplicate" as const,
      };
    }

    const [levelRow] = yield* executor
      .select()
      .from(postgresInventoryLevel)
      .where(
        and(
          eq(
            postgresInventoryLevel.inventoryItemId,
            reservation.inventoryItemId
          ),
          eq(
            postgresInventoryLevel.stockLocationId,
            reservation.stockLocationId
          )
        )
      )
      .limit(1)
      .pipe(Effect.mapError(toRepositoryUnavailable("read")));

    const level = levelRow ? yield* decodeInventoryLevelRow(levelRow) : null;

    if (
      !level ||
      level.stockedQuantity - level.reservedQuantity < reservation.quantity
    ) {
      return { status: "insufficient-stock" as const };
    }

    const insert = yield* toInventoryReservationPostgresInsert(reservation);
    yield* executor
      .insert(postgresInventoryReservation)
      .values(insert)
      .pipe(Effect.asVoid, Effect.mapError(toRepositoryUnavailable("write")));
    yield* executor
      .update(postgresInventoryLevel)
      .set({
        reservedQuantity: level.reservedQuantity + reservation.quantity,
        updatedAt: reservation.updatedAt,
      })
      .where(eq(postgresInventoryLevel.id, level.id))
      .pipe(Effect.asVoid, Effect.mapError(toRepositoryUnavailable("write")));

    return {
      reservation,
      status: "reserved" as const,
    };
  });

export const createPostgresInventoryRepository = (
  service: PostgresDrizzleServiceShape
): InventoryRepository =>
  InventoryRepositoryService.of({
    findAdjustmentEvents: (inventoryItemId) =>
      Effect.gen(function* findAdjustmentEventsEffect() {
        const executor = yield* getInventoryExecutor(service);
        const rows = yield* executor
          .select()
          .from(postgresInventoryAdjustmentEvent)
          .where(
            eq(
              postgresInventoryAdjustmentEvent.inventoryItemId,
              inventoryItemId
            )
          )
          .orderBy(desc(postgresInventoryAdjustmentEvent.createdAt))
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return yield* Effect.all(rows.map(decodeAdjustmentEventRow));
      }),
    findAdjustmentEventByIdempotencyKey: (idempotencyKey) =>
      Effect.gen(function* findAdjustmentEventByIdempotencyKeyEffect() {
        const executor = yield* getInventoryExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresInventoryAdjustmentEvent)
          .where(
            eq(postgresInventoryAdjustmentEvent.idempotencyKey, idempotencyKey)
          )
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeAdjustmentEventRow(row) : null;
      }),
    findInventoryItemById: (id) =>
      Effect.gen(function* findInventoryItemByIdEffect() {
        const executor = yield* getInventoryExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresInventoryItem)
          .where(eq(postgresInventoryItem.id, id))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeInventoryItemRow(row) : null;
      }),
    findLevel: (inventoryItemId, stockLocationId) =>
      Effect.gen(function* findLevelEffect() {
        const executor = yield* getInventoryExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresInventoryLevel)
          .where(
            and(
              eq(postgresInventoryLevel.inventoryItemId, inventoryItemId),
              eq(postgresInventoryLevel.stockLocationId, stockLocationId)
            )
          )
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeInventoryLevelRow(row) : null;
      }),
    findReservationByIdempotencyKey: (idempotencyKey) =>
      Effect.gen(function* findReservationByIdempotencyKeyEffect() {
        const executor = yield* getInventoryExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresInventoryReservation)
          .where(
            eq(postgresInventoryReservation.idempotencyKey, idempotencyKey)
          )
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeReservationRow(row) : null;
      }),
    findReservationsForLevel: (inventoryItemId, stockLocationId) =>
      Effect.gen(function* findReservationsForLevelEffect() {
        const executor = yield* getInventoryExecutor(service);
        const rows = yield* executor
          .select()
          .from(postgresInventoryReservation)
          .where(
            and(
              eq(postgresInventoryReservation.inventoryItemId, inventoryItemId),
              eq(postgresInventoryReservation.stockLocationId, stockLocationId),
              eq(postgresInventoryReservation.status, "active")
            )
          )
          .orderBy(desc(postgresInventoryReservation.createdAt))
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return yield* Effect.all(rows.map(decodeReservationRow));
      }),
    findStockLocationById: (id) =>
      Effect.gen(function* findStockLocationByIdEffect() {
        const executor = yield* getInventoryExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresInventoryStockLocation)
          .where(eq(postgresInventoryStockLocation.id, id))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeStockLocationRow(row) : null;
      }),
    listStockLocationsForSalesChannel: (salesChannelId) =>
      Effect.gen(function* listStockLocationsForSalesChannelEffect() {
        const executor = yield* getInventoryExecutor(service);
        const rows = yield* executor
          .select()
          .from(postgresInventoryStockLocation)
          .orderBy(desc(postgresInventoryStockLocation.createdAt))
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));
        const locations = yield* Effect.all(rows.map(decodeStockLocationRow));

        return locations.filter((location) =>
          location.salesChannelIds.includes(salesChannelId)
        );
      }),
    saveAdjustmentEvent: (event) =>
      Effect.gen(function* saveAdjustmentEventEffect() {
        const executor = yield* getInventoryExecutor(service);
        const insert = yield* toInventoryAdjustmentEventPostgresInsert(event);
        yield* executor
          .insert(postgresInventoryAdjustmentEvent)
          .values(insert)
          .onConflictDoUpdate({
            set: insert,
            target: postgresInventoryAdjustmentEvent.id,
          })
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return event;
      }),
    saveInventoryItem: (item) =>
      Effect.gen(function* saveInventoryItemEffect() {
        const executor = yield* getInventoryExecutor(service);
        const insert = yield* toInventoryItemPostgresInsert(item);
        yield* executor
          .insert(postgresInventoryItem)
          .values(insert)
          .onConflictDoUpdate({
            set: insert,
            target: postgresInventoryItem.id,
          })
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return item;
      }),
    saveLevel: (level) =>
      Effect.gen(function* saveLevelEffect() {
        const executor = yield* getInventoryExecutor(service);
        const insert = yield* toInventoryLevelPostgresInsert(level);
        yield* executor
          .insert(postgresInventoryLevel)
          .values(insert)
          .onConflictDoUpdate({
            set: insert,
            target: [
              postgresInventoryLevel.inventoryItemId,
              postgresInventoryLevel.stockLocationId,
            ],
          })
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return level;
      }),
    saveReservationIfAvailable: (reservation) =>
      service
        .withTransaction((transaction) =>
          saveReservationWithExecutor({ executor: transaction, reservation })
        )
        .pipe(Effect.mapError(toRepositoryUnavailable("write"))),
    saveReservation: (reservation) =>
      saveReservationWithExecutor({
        executor: service.database,
        reservation,
      }).pipe(
        Effect.flatMap((result) =>
          result.status === "reserved"
            ? Effect.succeed(result.reservation)
            : new InventoryValidationFailure({
                message: "Inventory reservation could not be saved.",
              })
        )
      ),
    saveStockLocation: (location) =>
      Effect.gen(function* saveStockLocationEffect() {
        const executor = yield* getInventoryExecutor(service);
        const insert = yield* toStockLocationPostgresInsert(location);
        yield* executor
          .insert(postgresInventoryStockLocation)
          .values(insert)
          .onConflictDoUpdate({
            set: insert,
            target: postgresInventoryStockLocation.id,
          })
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return location;
      }),
  });

export const createPostgresInventoryRepositoryLayer = () =>
  Layer.effect(
    InventoryRepositoryService,
    PostgresDrizzleService.use((service) =>
      Effect.succeed(createPostgresInventoryRepository(service))
    )
  );

/** Production PostgreSQL inventory repository Layer. */
export const PostgresInventoryRepositoryLayer =
  createPostgresInventoryRepositoryLayer();

/** Runs an inventory repository Effect inside the current PostgreSQL transaction. */
export const withPostgresInventoryTransaction = <A, E, R>(
  effect: EffectValue<A, E, R>
): EffectValue<A, E | SqlError, R | PostgresDrizzleService> =>
  PostgresDrizzleService.use((service) =>
    service.withTransaction(() => effect)
  );
