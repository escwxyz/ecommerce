import { defineApiContractRoute } from "@ecommerce/module-contracts";

import {
  AdjustInventoryInputSchema,
  CreateInventoryItemInputSchema,
  CreateStockLocationInputSchema,
  InventoryAdjustmentEventApiRecordSchema,
  InventoryAvailabilityApiSchema,
  InventoryAvailabilityInputSchema,
  InventoryItemApiRecordSchema,
  InventoryLevelApiRecordSchema,
  ReservationResultApiSchema,
  ReserveInventoryInputSchema,
  SetInventoryLevelInputSchema,
  StockLocationApiRecordSchema,
} from "../domain";

export const inventoryContractRouter = {
  inventoryAdjust: defineApiContractRoute({
    description:
      "Apply a traceable stock adjustment to an inventory level and emit an adjustment event.",
    method: "POST",
    operationId: "inventoryAdjust",
    path: "/inventory/adjustments",
    successDescription: "Inventory adjustment event created.",
    summary: "Adjust inventory",
    tags: ["Inventory"],
  })
    .input(AdjustInventoryInputSchema)
    .output(InventoryAdjustmentEventApiRecordSchema),
  inventoryAvailabilityCheck: defineApiContractRoute({
    description:
      "Calculate item availability for a stock-location or sales-channel scope.",
    method: "POST",
    operationId: "inventoryAvailabilityCheck",
    path: "/inventory/availability",
    successDescription: "Inventory availability returned.",
    summary: "Check inventory availability",
    tags: ["Inventory"],
  })
    .input(InventoryAvailabilityInputSchema)
    .output(InventoryAvailabilityApiSchema),
  inventoryItemCreate: defineApiContractRoute({
    description: "Create an inventory-owned stock keeping item.",
    method: "POST",
    operationId: "inventoryItemCreate",
    path: "/inventory/items",
    successDescription: "Inventory item created.",
    summary: "Create inventory item",
    tags: ["Inventory"],
  })
    .input(CreateInventoryItemInputSchema)
    .output(InventoryItemApiRecordSchema),
  inventoryLevelSet: defineApiContractRoute({
    description: "Set stocked quantity for an item at a stock location.",
    method: "PUT",
    operationId: "inventoryLevelSet",
    path: "/inventory/levels",
    successDescription: "Inventory level upserted.",
    summary: "Set inventory level",
    tags: ["Inventory"],
  })
    .input(SetInventoryLevelInputSchema)
    .output(InventoryLevelApiRecordSchema),
  inventoryReserve: defineApiContractRoute({
    description:
      "Reserve stock with stable correlation and idempotency metadata.",
    method: "POST",
    operationId: "inventoryReserve",
    path: "/inventory/reservations",
    successDescription: "Inventory reservation resolved.",
    summary: "Reserve inventory",
    tags: ["Inventory"],
  })
    .input(ReserveInventoryInputSchema)
    .output(ReservationResultApiSchema),
  inventoryStockLocationCreate: defineApiContractRoute({
    description: "Create a stock location with declared sales-channel scope.",
    method: "POST",
    operationId: "inventoryStockLocationCreate",
    path: "/inventory/stock-locations",
    successDescription: "Stock location created.",
    summary: "Create stock location",
    tags: ["Inventory"],
  })
    .input(CreateStockLocationInputSchema)
    .output(StockLocationApiRecordSchema),
} as const;
