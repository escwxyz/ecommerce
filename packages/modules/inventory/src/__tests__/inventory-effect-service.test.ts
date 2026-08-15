import { describe, expect, it } from "bun:test";

import {
  KeyedActorCommandFailure,
  type KeyedActorService,
} from "@ecommerce/core/stateful";
import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect, Exit, Logger } from "effect";

import { createInMemoryInventoryActorService } from "../coordination";
import { createInMemoryInventoryRepository } from "../repositories";
import { createInventoryService } from "../services";

describe("inventory Effect service", () => {
  it("creates scoped stock and reserves it idempotently", async () => {
    const outbox = createInMemoryOutbox();
    const service = createInventoryService({
      actorService: createInMemoryInventoryActorService(),
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "iitem_hat",
        "sloc_main",
        "ilvl_hat",
        "ires_hat",
        "evt_reserved",
      ]),
      outboxWriter: outbox.writer,
      repository: createInMemoryInventoryRepository(),
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [outbox],
      }),
    });

    const item = await Effect.runPromise(
      service.createInventoryItem({
        sku: "hat-1",
        title: "Hat",
      })
    );
    const location = await Effect.runPromise(
      service.createStockLocation({
        name: "Main warehouse",
        salesChannelIds: ["sc_web"],
      })
    );
    await Effect.runPromise(
      service.setInventoryLevel({
        inventoryItemId: item.id,
        stockLocationId: location.id,
        stockedQuantity: 3,
      })
    );
    const reservation = await Effect.runPromise(
      service.reserveInventory({
        correlationId: "corr_inventory",
        idempotencyKey: "reserve_hat",
        inventoryItemId: item.id,
        quantity: 2,
        salesChannelId: "sc_web",
        stockLocationId: location.id,
      })
    );
    const duplicate = await Effect.runPromise(
      service.reserveInventory({
        correlationId: "corr_inventory",
        idempotencyKey: "reserve_hat",
        inventoryItemId: item.id,
        quantity: 2,
        salesChannelId: "sc_web",
        stockLocationId: location.id,
      })
    );

    expect(reservation.duplicate).toBe(false);
    expect(reservation.availability.availableQuantity).toBe(1);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.reservation.id).toBe(reservation.reservation.id);
    expect(outbox.records.map((record) => record.event.name)).toEqual([
      "inventory.reserved",
    ]);
  });

  it("returns typed failures for missing levels and insufficient stock", async () => {
    const outbox = createInMemoryOutbox();
    const service = createInventoryService({
      actorService: createInMemoryInventoryActorService(),
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "iitem_hat",
        "sloc_main",
        "ilvl_hat",
        "ires_hat",
      ]),
      outboxWriter: outbox.writer,
      repository: createInMemoryInventoryRepository(),
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [outbox],
      }),
    });
    const item = await Effect.runPromise(
      service.createInventoryItem({
        sku: "hat-1",
        title: "Hat",
      })
    );
    const location = await Effect.runPromise(
      service.createStockLocation({
        name: "Main warehouse",
      })
    );
    const missingLevelExit = await Effect.runPromiseExit(
      service.reserveInventory({
        correlationId: "corr_missing",
        idempotencyKey: "reserve_missing",
        inventoryItemId: item.id,
        quantity: 1,
        stockLocationId: location.id,
      })
    );

    await Effect.runPromise(
      service.setInventoryLevel({
        inventoryItemId: item.id,
        stockLocationId: location.id,
        stockedQuantity: 0,
      })
    );
    const insufficientExit = await Effect.runPromiseExit(
      service.reserveInventory({
        correlationId: "corr_insufficient",
        idempotencyKey: "reserve_insufficient",
        inventoryItemId: item.id,
        quantity: 1,
        stockLocationId: location.id,
      })
    );

    expect(Exit.isFailure(missingLevelExit)).toBe(true);
    expect(JSON.stringify(missingLevelExit.toJSON())).toContain(
      "InventoryLevelNotFound"
    );
    expect(Exit.isFailure(insufficientExit)).toBe(true);
    expect(JSON.stringify(insufficientExit.toJSON())).toContain(
      "InventoryInsufficientStock"
    );
  });

  it("logs post-commit coordination failures without failing inventory mutations", async () => {
    const logs: unknown[] = [];
    const logger = Logger.make((options) => {
      logs.push(options.message);
    });
    const outbox = createInMemoryOutbox();
    const actorService: KeyedActorService = {
      dispatch: (command) =>
        Effect.fail(
          new KeyedActorCommandFailure({
            actorKey: command.actor.key,
            actorType: command.actor.type,
            commandId: command.commandId,
            commandName: command.commandName,
            message: "actor unavailable",
            retryable: true,
          })
        ),
    };
    const service = createInventoryService({
      actorService,
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "iitem_hat",
        "sloc_main",
        "ilvl_hat",
        "ires_hat",
        "evt_reserved",
      ]),
      outboxWriter: outbox.writer,
      repository: createInMemoryInventoryRepository(),
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [outbox],
      }),
    });

    const item = await Effect.runPromise(
      service.createInventoryItem({
        sku: "hat-1",
        title: "Hat",
      })
    );
    const location = await Effect.runPromise(
      service.createStockLocation({
        name: "Main warehouse",
      })
    );
    await Effect.runPromise(
      service.setInventoryLevel({
        inventoryItemId: item.id,
        stockLocationId: location.id,
        stockedQuantity: 3,
      })
    );
    const reservation = await Effect.runPromise(
      service
        .reserveInventory({
          correlationId: "corr_inventory",
          idempotencyKey: "reserve_hat",
          inventoryItemId: item.id,
          quantity: 2,
          stockLocationId: location.id,
        })
        .pipe(Effect.withLogger(logger))
    );

    expect(reservation.duplicate).toBe(false);
    const serializedLogs = JSON.stringify(logs);
    expect(serializedLogs).toContain("inventory.coordination.failed");
    expect(serializedLogs).toContain("inventory-reservation");
    expect(serializedLogs).toContain("corr_inventory");
    expect(serializedLogs).toContain("reserve_hat");
    expect(serializedLogs).toContain(item.id);
    expect(serializedLogs).toContain("reserveInventory");
    expect(serializedLogs).toContain(location.id);
    expect(serializedLogs).toContain("actor unavailable");
  });
});
