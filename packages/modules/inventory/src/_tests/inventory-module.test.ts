import { describe, expect, it } from "bun:test";

import type {
  StatefulCoordinationRequest,
  StatefulCoordinationResult,
  StatefulCoordinator,
} from "@ecommerce/core/stateful";
import {
  createEventCollector,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { call } from "@orpc/server";

import { inventoryContractRouter } from "../contracts";
import type {
  InventoryItemId,
  InventoryRepository,
  InventoryReservationRecord,
  StockLocationId,
} from "../domain";
import {
  createInventoryItemId,
  createInventoryLevelId,
  createInventoryReservationId,
  createStockLocationId,
} from "../domain";
import { inventoryModule } from "../module";
import { createResettableInMemoryInventoryRepository } from "../repositories";
import type { ResettableInventoryRepository } from "../repositories";
import { createInventoryRouteFragment } from "../router";
import { createInventoryService } from "../services";

const createAllowedContext = () =>
  ({
    context: {
      auth: {},
      authorization: {
        evaluatePermission: () => ({ allowed: true as const }),
      },
      session: {
        user: {
          email: "ada@example.com",
          id: "user_1",
        },
      },
    },
  }) as const;

class RacingAvailabilityInventoryRepository implements InventoryRepository {
  readonly #base: ResettableInventoryRepository;
  #releaseAvailabilityReads: (() => void) | null = null;
  #availabilityReadCount = 0;
  readonly #availabilityBarrier = new Promise<void>((resolve) => {
    this.#releaseAvailabilityReads = resolve;
  });

  constructor(base: ResettableInventoryRepository) {
    this.#base = base;
  }

  findAdjustmentEvents: InventoryRepository["findAdjustmentEvents"] = (
    inventoryItemId
  ) => this.#base.findAdjustmentEvents(inventoryItemId);

  findAdjustmentEventByIdempotencyKey: InventoryRepository["findAdjustmentEventByIdempotencyKey"] =
    (idempotencyKey) =>
      this.#base.findAdjustmentEventByIdempotencyKey(idempotencyKey);

  findInventoryItemById: InventoryRepository["findInventoryItemById"] = (id) =>
    this.#base.findInventoryItemById(id);

  findLevel: InventoryRepository["findLevel"] = (
    inventoryItemId,
    stockLocationId
  ) => this.#base.findLevel(inventoryItemId, stockLocationId);

  findReservationByIdempotencyKey: InventoryRepository["findReservationByIdempotencyKey"] =
    (idempotencyKey) =>
      this.#base.findReservationByIdempotencyKey(idempotencyKey);

  async findReservationsForLevel(
    inventoryItemId: InventoryItemId,
    stockLocationId: StockLocationId
  ): Promise<readonly InventoryReservationRecord[]> {
    this.#availabilityReadCount += 1;

    if (this.#availabilityReadCount === 2) {
      this.#releaseAvailabilityReads?.();
    }

    if (this.#availabilityReadCount <= 2) {
      await this.#availabilityBarrier;
    }

    return this.#base.findReservationsForLevel(
      inventoryItemId,
      stockLocationId
    );
  }

  findStockLocationById: InventoryRepository["findStockLocationById"] = (id) =>
    this.#base.findStockLocationById(id);

  listStockLocationsForSalesChannel: InventoryRepository["listStockLocationsForSalesChannel"] =
    (salesChannelId) =>
      this.#base.listStockLocationsForSalesChannel(salesChannelId);

  saveAdjustmentEvent: InventoryRepository["saveAdjustmentEvent"] = (event) =>
    this.#base.saveAdjustmentEvent(event);

  saveInventoryItem: InventoryRepository["saveInventoryItem"] = (item) =>
    this.#base.saveInventoryItem(item);

  saveLevel: InventoryRepository["saveLevel"] = (level) =>
    this.#base.saveLevel(level);

  saveReservationIfAvailable: InventoryRepository["saveReservationIfAvailable"] =
    (reservation) => this.#base.saveReservationIfAvailable(reservation);

  saveReservation: InventoryRepository["saveReservation"] = (reservation) =>
    this.#base.saveReservation(reservation);

  saveStockLocation: InventoryRepository["saveStockLocation"] = (location) =>
    this.#base.saveStockLocation(location);
}

class DuplicateOnSaveInventoryRepository implements InventoryRepository {
  readonly #base: ResettableInventoryRepository;
  readonly #reservation: InventoryReservationRecord;

  constructor(
    base: ResettableInventoryRepository,
    reservation: InventoryReservationRecord
  ) {
    this.#base = base;
    this.#reservation = reservation;
  }

  findAdjustmentEvents: InventoryRepository["findAdjustmentEvents"] = (
    inventoryItemId
  ) => this.#base.findAdjustmentEvents(inventoryItemId);

  findAdjustmentEventByIdempotencyKey: InventoryRepository["findAdjustmentEventByIdempotencyKey"] =
    (idempotencyKey) =>
      this.#base.findAdjustmentEventByIdempotencyKey(idempotencyKey);

  findInventoryItemById: InventoryRepository["findInventoryItemById"] = (id) =>
    this.#base.findInventoryItemById(id);

  findLevel: InventoryRepository["findLevel"] = (
    inventoryItemId,
    stockLocationId
  ) => this.#base.findLevel(inventoryItemId, stockLocationId);

  findReservationByIdempotencyKey: InventoryRepository["findReservationByIdempotencyKey"] =
    () => Promise.resolve(null);

  findReservationsForLevel: InventoryRepository["findReservationsForLevel"] = (
    inventoryItemId,
    stockLocationId
  ) => this.#base.findReservationsForLevel(inventoryItemId, stockLocationId);

  findStockLocationById: InventoryRepository["findStockLocationById"] = (id) =>
    this.#base.findStockLocationById(id);

  listStockLocationsForSalesChannel: InventoryRepository["listStockLocationsForSalesChannel"] =
    (salesChannelId) =>
      this.#base.listStockLocationsForSalesChannel(salesChannelId);

  saveAdjustmentEvent: InventoryRepository["saveAdjustmentEvent"] = (event) =>
    this.#base.saveAdjustmentEvent(event);

  saveInventoryItem: InventoryRepository["saveInventoryItem"] = (item) =>
    this.#base.saveInventoryItem(item);

  saveLevel: InventoryRepository["saveLevel"] = (level) =>
    this.#base.saveLevel(level);

  saveReservationIfAvailable: InventoryRepository["saveReservationIfAvailable"] =
    () =>
      Promise.resolve({
        reservation: this.#reservation,
        status: "duplicate" as const,
      });

  saveReservation: InventoryRepository["saveReservation"] = (reservation) =>
    this.#base.saveReservation(reservation);

  saveStockLocation: InventoryRepository["saveStockLocation"] = (location) =>
    this.#base.saveStockLocation(location);
}

class InFlightDuplicateCoordinator implements StatefulCoordinator {
  readonly #seen = new Set<string>();
  readonly #onDuplicate: () => void;

  constructor(onDuplicate: () => void) {
    this.#onDuplicate = onDuplicate;
  }

  coordinate<Input = unknown, Output = unknown>(
    request: StatefulCoordinationRequest<Input>
  ): Promise<StatefulCoordinationResult<Output>> {
    const duplicate = this.#seen.has(request.idempotencyKey);

    if (duplicate) {
      this.#onDuplicate();
    } else {
      this.#seen.add(request.idempotencyKey);
    }

    return Promise.resolve({
      causationId: request.causationId,
      coordinatedAt: new Date("2026-01-01T00:00:00.000Z"),
      coordinatorKey: request.coordinatorKey,
      correlationId: request.correlationId,
      duplicate,
      idempotencyKey: request.idempotencyKey,
      operationName: request.operationName,
      output: undefined as Output,
      subject: request.subject,
      workflowRunId: request.workflowRunId,
    });
  }
}

class InFlightDuplicateInventoryRepository implements InventoryRepository {
  readonly #base: ResettableInventoryRepository;
  #duplicateLookupShouldReleaseSave = false;
  #releaseSave: (() => void) | null = null;
  #saveStarted: (() => void) | null = null;
  readonly #saveBarrier = new Promise<void>((resolve) => {
    this.#releaseSave = resolve;
  });
  readonly #saveStartedBarrier = new Promise<void>((resolve) => {
    this.#saveStarted = resolve;
  });

  constructor(base: ResettableInventoryRepository) {
    this.#base = base;
  }

  releaseSaveAfterNextDuplicateLookup(): void {
    this.#duplicateLookupShouldReleaseSave = true;
  }

  waitForSaveAttempt(): Promise<void> {
    return this.#saveStartedBarrier;
  }

  findAdjustmentEvents: InventoryRepository["findAdjustmentEvents"] = (
    inventoryItemId
  ) => this.#base.findAdjustmentEvents(inventoryItemId);

  findAdjustmentEventByIdempotencyKey: InventoryRepository["findAdjustmentEventByIdempotencyKey"] =
    (idempotencyKey) =>
      this.#base.findAdjustmentEventByIdempotencyKey(idempotencyKey);

  findInventoryItemById: InventoryRepository["findInventoryItemById"] = (id) =>
    this.#base.findInventoryItemById(id);

  findLevel: InventoryRepository["findLevel"] = (
    inventoryItemId,
    stockLocationId
  ) => this.#base.findLevel(inventoryItemId, stockLocationId);

  findReservationByIdempotencyKey: InventoryRepository["findReservationByIdempotencyKey"] =
    async (idempotencyKey) => {
      const reservation =
        await this.#base.findReservationByIdempotencyKey(idempotencyKey);

      if (!reservation && this.#duplicateLookupShouldReleaseSave) {
        this.#duplicateLookupShouldReleaseSave = false;
        this.#releaseSave?.();
      }

      return reservation;
    };

  findReservationsForLevel: InventoryRepository["findReservationsForLevel"] = (
    inventoryItemId,
    stockLocationId
  ) => this.#base.findReservationsForLevel(inventoryItemId, stockLocationId);

  findStockLocationById: InventoryRepository["findStockLocationById"] = (id) =>
    this.#base.findStockLocationById(id);

  listStockLocationsForSalesChannel: InventoryRepository["listStockLocationsForSalesChannel"] =
    (salesChannelId) =>
      this.#base.listStockLocationsForSalesChannel(salesChannelId);

  saveAdjustmentEvent: InventoryRepository["saveAdjustmentEvent"] = (event) =>
    this.#base.saveAdjustmentEvent(event);

  saveInventoryItem: InventoryRepository["saveInventoryItem"] = (item) =>
    this.#base.saveInventoryItem(item);

  saveLevel: InventoryRepository["saveLevel"] = (level) =>
    this.#base.saveLevel(level);

  saveReservationIfAvailable: InventoryRepository["saveReservationIfAvailable"] =
    async (reservation) => {
      this.#saveStarted?.();
      await this.#saveBarrier;
      return this.#base.saveReservationIfAvailable(reservation);
    };

  saveReservation: InventoryRepository["saveReservation"] = (reservation) =>
    this.#base.saveReservation(reservation);

  saveStockLocation: InventoryRepository["saveStockLocation"] = (location) =>
    this.#base.saveStockLocation(location);
}

describe("inventory module foundation", () => {
  it("declares service, schema, events, permissions, workflow steps, and extension points", () => {
    expect(inventoryModule.key).toBe("inventory");
    expect(inventoryModule.providedServices?.map(({ key }) => key)).toEqual([
      "inventory-service",
    ]);
    expect(inventoryModule.schema?.tables).toEqual([
      "inventory_item",
      "inventory_stock_location",
      "inventory_level",
      "inventory_reservation",
      "inventory_adjustment_event",
    ]);
    expect(inventoryModule.contributions?.eventTypes).toEqual([
      "inventory.reserved",
      "inventory.adjusted",
    ]);
    expect(
      inventoryModule.contributions?.workflowSteps?.map((step) => step.name)
    ).toEqual(["inventory.reserve", "inventory.adjust"]);
  });

  it("checks location-scoped availability and resolves duplicate reservations once", async () => {
    const repository = createResettableInMemoryInventoryRepository();
    const eventCollector = createEventCollector();
    const service = createInventoryService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      eventPublisher: eventCollector.publisher,
      idGenerator: createSequenceIdGenerator([
        "iitem_hat",
        "sloc_berlin",
        "ilvl_hat_berlin",
        "ires_checkout",
        "evt_reserved",
      ]),
      repository,
    });

    const item = await service.createInventoryItem({
      sku: "hat-black",
      title: "Black hat",
    });
    const location = await service.createStockLocation({
      name: "Berlin warehouse",
      salesChannelIds: ["sc_de"],
    });
    await service.setInventoryLevel({
      inventoryItemId: item.id,
      stockLocationId: location.id,
      stockedQuantity: 5,
    });

    await expect(
      service.checkAvailability({
        inventoryItemId: item.id,
        salesChannelId: "sc_de",
      })
    ).resolves.toMatchObject({
      availableQuantity: 5,
      reservedQuantity: 0,
      stockedQuantity: 5,
    });

    const firstReservation = await service.reserveInventory({
      correlationId: "checkout_1",
      idempotencyKey: "reserve_checkout_1",
      inventoryItemId: item.id,
      quantity: 2,
      salesChannelId: "sc_de",
      stockLocationId: location.id,
      workflowRunId: "workflow_1",
    });
    const duplicateReservation = await service.reserveInventory({
      correlationId: "checkout_1",
      idempotencyKey: "reserve_checkout_1",
      inventoryItemId: item.id,
      quantity: 2,
      salesChannelId: "sc_de",
      stockLocationId: location.id,
      workflowRunId: "workflow_1",
    });

    expect(firstReservation).toMatchObject({
      availability: {
        availableQuantity: 3,
        reservedQuantity: 2,
        stockedQuantity: 5,
      },
      duplicate: false,
      reservation: {
        id: "ires_checkout",
        idempotencyKey: "reserve_checkout_1",
        quantity: 2,
      },
    });
    expect(duplicateReservation).toMatchObject({
      availability: {
        availableQuantity: 3,
        reservedQuantity: 2,
      },
      duplicate: true,
      reservation: {
        id: "ires_checkout",
      },
    });
    expect(eventCollector.events.map((event) => event.name)).toEqual([
      "inventory.reserved",
    ]);
  });

  it("omits stock location from sales-channel totals aggregated across multiple warehouses", async () => {
    const repository = createResettableInMemoryInventoryRepository();
    const service = createInventoryService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "iitem_channel_total",
        "sloc_berlin_total",
        "sloc_paris_total",
        "ilvl_berlin_total",
        "ilvl_paris_total",
      ]),
      repository,
    });
    const item = await service.createInventoryItem({
      sku: "channel-total-sku",
      title: "Channel total item",
    });
    const berlin = await service.createStockLocation({
      name: "Berlin warehouse",
      salesChannelIds: ["sc_multi"],
    });
    const paris = await service.createStockLocation({
      name: "Paris warehouse",
      salesChannelIds: ["sc_multi"],
    });
    await service.setInventoryLevel({
      inventoryItemId: item.id,
      stockLocationId: berlin.id,
      stockedQuantity: 2,
    });
    await service.setInventoryLevel({
      inventoryItemId: item.id,
      stockLocationId: paris.id,
      stockedQuantity: 3,
    });

    await expect(
      service.checkAvailability({
        inventoryItemId: item.id,
        salesChannelId: "sc_multi",
      })
    ).resolves.toEqual({
      availableQuantity: 5,
      inventoryItemId: item.id,
      reservedQuantity: 0,
      scopedBy: {
        salesChannelId: "sc_multi",
      },
      stockedQuantity: 5,
    });
  });

  it("rejects concurrent reservations with different idempotency keys when stock is exhausted", async () => {
    const baseRepository = createResettableInMemoryInventoryRepository();
    const repository = new RacingAvailabilityInventoryRepository(
      baseRepository
    );
    const service = createInventoryService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "iitem_race",
        "sloc_race",
        "ilvl_race",
        "ires_race_1",
        "evt_race_1",
        "ires_race_2",
        "evt_race_2",
      ]),
      repository,
    });
    const item = await service.createInventoryItem({
      sku: "race-sku",
      title: "Race item",
    });
    const location = await service.createStockLocation({
      name: "Race warehouse",
      salesChannelIds: ["sc_race"],
    });
    await service.setInventoryLevel({
      inventoryItemId: item.id,
      stockLocationId: location.id,
      stockedQuantity: 1,
    });

    const results = await Promise.allSettled([
      service.reserveInventory({
        correlationId: "checkout_race_1",
        idempotencyKey: "reserve_race_1",
        inventoryItemId: item.id,
        quantity: 1,
        salesChannelId: "sc_race",
        stockLocationId: location.id,
      }),
      service.reserveInventory({
        correlationId: "checkout_race_2",
        idempotencyKey: "reserve_race_2",
        inventoryItemId: item.id,
        quantity: 1,
        salesChannelId: "sc_race",
        stockLocationId: location.id,
      }),
    ]);
    const reservations = await baseRepository.findReservationsForLevel(
      item.id,
      location.id
    );

    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected")
    ).toHaveLength(1);
    expect(reservations).toHaveLength(1);
  });

  it("records stock adjustments with correlation metadata", async () => {
    const repository = createResettableInMemoryInventoryRepository();
    const service = createInventoryService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "iitem_mug",
        "sloc_paris",
        "ilvl_mug_paris",
        "iadj_restock",
        "evt_adjusted",
      ]),
      repository,
    });
    const item = await service.createInventoryItem({
      sku: "mug-white",
      title: "White mug",
    });
    const location = await service.createStockLocation({
      name: "Paris warehouse",
    });
    await service.setInventoryLevel({
      inventoryItemId: item.id,
      stockLocationId: location.id,
      stockedQuantity: 1,
    });

    await expect(
      service.adjustInventory({
        adjustment: 4,
        correlationId: "stock_count_1",
        idempotencyKey: "adjust_stock_count_1",
        inventoryItemId: item.id,
        reason: "restock",
        stockLocationId: location.id,
      })
    ).resolves.toMatchObject({
      adjustment: 4,
      correlationId: "stock_count_1",
      id: "iadj_restock",
      reason: "restock",
      updatedStockedQuantity: 5,
    });
  });

  it("replays duplicate adjustment idempotency keys without mutating stock twice", async () => {
    const repository = createResettableInMemoryInventoryRepository();
    const eventCollector = createEventCollector();
    const service = createInventoryService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      eventPublisher: eventCollector.publisher,
      idGenerator: createSequenceIdGenerator([
        "iitem_adjust_retry",
        "sloc_adjust_retry",
        "ilvl_adjust_retry",
        "iadj_adjust_retry",
        "evt_adjust_retry",
        "iadj_adjust_retry_duplicate",
        "evt_adjust_retry_duplicate",
      ]),
      repository,
    });
    const item = await service.createInventoryItem({
      sku: "adjust-retry-sku",
      title: "Adjust retry item",
    });
    const location = await service.createStockLocation({
      name: "Adjust retry warehouse",
    });
    await service.setInventoryLevel({
      inventoryItemId: item.id,
      stockLocationId: location.id,
      stockedQuantity: 1,
    });

    const firstAdjustment = await service.adjustInventory({
      adjustment: 4,
      correlationId: "stock_count_retry",
      idempotencyKey: "adjust_stock_count_retry",
      inventoryItemId: item.id,
      reason: "restock",
      stockLocationId: location.id,
    });
    const duplicateAdjustment = await service.adjustInventory({
      adjustment: 4,
      correlationId: "stock_count_retry",
      idempotencyKey: "adjust_stock_count_retry",
      inventoryItemId: item.id,
      reason: "restock",
      stockLocationId: location.id,
    });

    expect(firstAdjustment).toMatchObject({
      adjustment: 4,
      id: "iadj_adjust_retry",
      updatedStockedQuantity: 5,
    });
    expect(duplicateAdjustment).toMatchObject({
      adjustment: 4,
      id: "iadj_adjust_retry",
      updatedStockedQuantity: 5,
    });
    await expect(
      repository.findLevel(item.id, location.id)
    ).resolves.toMatchObject({
      stockedQuantity: 5,
    });
    expect(eventCollector.events.map((event) => event.name)).toEqual([
      "inventory.adjusted",
    ]);
  });

  it("does not emit duplicate events when reservation save resolves as duplicate", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const baseRepository = createResettableInMemoryInventoryRepository();
    const existingReservation = {
      causationId: null,
      correlationId: "checkout_duplicate_existing",
      createdAt,
      id: createInventoryReservationId("ires_duplicate_existing"),
      idempotencyKey: "reserve_duplicate_existing",
      inventoryItemId: createInventoryItemId("iitem_duplicate"),
      quantity: 1,
      releasedAt: null,
      salesChannelId: "sc_duplicate",
      status: "active" as const,
      stockLocationId: createStockLocationId("sloc_duplicate"),
      updatedAt: createdAt,
      workflowRunId: null,
    };
    await baseRepository.saveInventoryItem({
      createdAt,
      id: existingReservation.inventoryItemId,
      metadata: {},
      sku: "duplicate-sku",
      title: "Duplicate item",
      updatedAt: createdAt,
    });
    await baseRepository.saveStockLocation({
      createdAt,
      id: existingReservation.stockLocationId,
      metadata: {},
      name: "Duplicate warehouse",
      salesChannelIds: ["sc_duplicate"],
      updatedAt: createdAt,
    });
    await baseRepository.saveLevel({
      createdAt,
      id: createInventoryLevelId("ilvl_duplicate"),
      inventoryItemId: existingReservation.inventoryItemId,
      reservedQuantity: 0,
      stockLocationId: existingReservation.stockLocationId,
      stockedQuantity: 2,
      updatedAt: createdAt,
    });
    await baseRepository.saveReservation(existingReservation);

    const eventCollector = createEventCollector();
    const service = createInventoryService({
      clock: createStaticClock(createdAt),
      eventPublisher: eventCollector.publisher,
      repository: new DuplicateOnSaveInventoryRepository(
        baseRepository,
        existingReservation
      ),
    });

    await expect(
      service.reserveInventory({
        correlationId: "checkout_duplicate_retry",
        idempotencyKey: "reserve_duplicate_existing",
        inventoryItemId: existingReservation.inventoryItemId,
        quantity: 1,
        salesChannelId: "sc_duplicate",
        stockLocationId: existingReservation.stockLocationId,
      })
    ).resolves.toMatchObject({
      availability: {
        availableQuantity: 1,
        reservedQuantity: 1,
      },
      duplicate: true,
      reservation: {
        id: existingReservation.id,
      },
    });
    expect(eventCollector.events).toHaveLength(0);
  });

  it("resolves in-flight duplicate reservations after the first request persists", async () => {
    const baseRepository = createResettableInMemoryInventoryRepository();
    const repository = new InFlightDuplicateInventoryRepository(baseRepository);
    const eventCollector = createEventCollector();
    const service = createInventoryService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      coordinator: new InFlightDuplicateCoordinator(() => {
        repository.releaseSaveAfterNextDuplicateLookup();
      }),
      eventPublisher: eventCollector.publisher,
      idGenerator: createSequenceIdGenerator([
        "iitem_inflight",
        "sloc_inflight",
        "ilvl_inflight",
        "ires_inflight",
        "evt_inflight",
      ]),
      repository,
    });

    const item = await service.createInventoryItem({
      sku: "inflight-sku",
      title: "In-flight item",
    });
    const location = await service.createStockLocation({
      name: "In-flight warehouse",
      salesChannelIds: ["sc_inflight"],
    });
    await service.setInventoryLevel({
      inventoryItemId: item.id,
      stockLocationId: location.id,
      stockedQuantity: 2,
    });

    const firstReservation = service.reserveInventory({
      correlationId: "checkout_inflight",
      idempotencyKey: "reserve_inflight",
      inventoryItemId: item.id,
      quantity: 1,
      salesChannelId: "sc_inflight",
      stockLocationId: location.id,
    });

    await repository.waitForSaveAttempt();

    const duplicateReservation = service.reserveInventory({
      correlationId: "checkout_inflight",
      idempotencyKey: "reserve_inflight",
      inventoryItemId: item.id,
      quantity: 1,
      salesChannelId: "sc_inflight",
      stockLocationId: location.id,
    });

    await expect(
      Promise.all([firstReservation, duplicateReservation])
    ).resolves.toEqual([
      expect.objectContaining({
        duplicate: false,
        reservation: expect.objectContaining({
          id: "ires_inflight",
          idempotencyKey: "reserve_inflight",
        }),
      }),
      expect.objectContaining({
        duplicate: true,
        reservation: expect.objectContaining({
          id: "ires_inflight",
          idempotencyKey: "reserve_inflight",
        }),
      }),
    ]);
    expect(eventCollector.events.map((event) => event.name)).toEqual([
      "inventory.reserved",
    ]);
  });

  it("declares contract-first route metadata", () => {
    expect(
      inventoryContractRouter.inventoryReserve["~orpc"].route.tags
    ).toEqual(["Inventory"]);
  });

  it("builds route fragments with injected repositories", async () => {
    const repository = createResettableInMemoryInventoryRepository();
    const fragment = createInventoryRouteFragment({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "iitem_route",
        "sloc_route",
        "ilvl_route",
        "ires_route",
        "evt_reserved",
      ]),
      repository,
    });
    const context = createAllowedContext();

    const item = await call(
      fragment.router.inventoryItemCreate,
      {
        sku: "route-sku",
        title: "Route item",
      },
      context
    );
    const location = await call(
      fragment.router.inventoryStockLocationCreate,
      {
        name: "Route warehouse",
        salesChannelIds: ["sc_route"],
      },
      context
    );

    await call(
      fragment.router.inventoryLevelSet,
      {
        inventoryItemId: item.id,
        stockLocationId: location.id,
        stockedQuantity: 3,
      },
      context
    );

    await expect(
      call(
        fragment.router.inventoryReserve,
        {
          correlationId: "route_checkout",
          idempotencyKey: "route_reservation",
          inventoryItemId: item.id,
          quantity: 1,
          salesChannelId: "sc_route",
          stockLocationId: location.id,
        },
        context
      )
    ).resolves.toMatchObject({
      availability: {
        availableQuantity: 2,
        reservedQuantity: 1,
      },
      duplicate: false,
    });
  });
});
