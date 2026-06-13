import { describe, expect, it } from "bun:test";

import {
  createEventCollector,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { call } from "@orpc/server";

import { inventoryContractRouter } from "../contracts";
import { inventoryModule } from "../module";
import { createResettableInMemoryInventoryRepository } from "../repositories";
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
