import {
  InventoryAdjustmentEventSerializedIdSchema,
  InventoryAdjustmentReasonSchema,
  InventoryItemSerializedIdSchema,
  InventoryLevelSerializedIdSchema,
  InventoryMetadataSchema,
  InventoryReservationSerializedIdSchema,
  InventoryReservationStatusSchema,
  InventoryTrimmedStringSchema,
  StockLocationSerializedIdSchema,
} from "@ecommerce/inventory";
import {
  createInsertSchema,
  createSelectSchema,
} from "drizzle-orm/effect-schema";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Schema } from "effect";

export const postgresInventoryItemTableName = "inventory_item" as const;
export const postgresInventoryStockLocationTableName =
  "inventory_stock_location" as const;
export const postgresInventoryLevelTableName = "inventory_level" as const;
export const postgresInventoryReservationTableName =
  "inventory_reservation" as const;
export const postgresInventoryAdjustmentEventTableName =
  "inventory_adjustment_event" as const;

export const postgresInventoryItem = pgTable(
  postgresInventoryItemTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof InventoryMetadataSchema.Type>()
      .notNull(),
    sku: text("sku").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("inventory_item_sku_idx").on(table.sku),
    index("inventory_item_created_at_idx").on(table.createdAt),
  ]
);

export const postgresInventoryStockLocation = pgTable(
  postgresInventoryStockLocationTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof InventoryMetadataSchema.Type>()
      .notNull(),
    name: text("name").notNull(),
    salesChannelIdsJson: jsonb("sales_channel_ids_json")
      .$type<readonly string[]>()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("inventory_stock_location_created_at_idx").on(table.createdAt)]
);

export const postgresInventoryLevel = pgTable(
  postgresInventoryLevelTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    inventoryItemId: text("inventory_item_id")
      .notNull()
      .references(() => postgresInventoryItem.id, { onDelete: "cascade" }),
    reservedQuantity: integer("reserved_quantity").notNull(),
    stockLocationId: text("stock_location_id")
      .notNull()
      .references(() => postgresInventoryStockLocation.id, {
        onDelete: "cascade",
      }),
    stockedQuantity: integer("stocked_quantity").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("inventory_level_scope_idx").on(
      table.inventoryItemId,
      table.stockLocationId
    ),
    index("inventory_level_item_idx").on(table.inventoryItemId),
  ]
);

export const postgresInventoryReservation = pgTable(
  postgresInventoryReservationTableName,
  {
    causationId: text("causation_id"),
    correlationId: text("correlation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    inventoryItemId: text("inventory_item_id")
      .notNull()
      .references(() => postgresInventoryItem.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    salesChannelId: text("sales_channel_id"),
    status: text("status").notNull(),
    stockLocationId: text("stock_location_id")
      .notNull()
      .references(() => postgresInventoryStockLocation.id, {
        onDelete: "cascade",
      }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    workflowRunId: text("workflow_run_id"),
  },
  (table) => [
    uniqueIndex("inventory_reservation_idempotency_idx").on(
      table.idempotencyKey
    ),
    index("inventory_reservation_level_idx").on(
      table.inventoryItemId,
      table.stockLocationId
    ),
  ]
);

export const postgresInventoryAdjustmentEvent = pgTable(
  postgresInventoryAdjustmentEventTableName,
  {
    adjustment: integer("adjustment").notNull(),
    causationId: text("causation_id"),
    correlationId: text("correlation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    inventoryItemId: text("inventory_item_id")
      .notNull()
      .references(() => postgresInventoryItem.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    stockLocationId: text("stock_location_id")
      .notNull()
      .references(() => postgresInventoryStockLocation.id, {
        onDelete: "cascade",
      }),
    updatedStockedQuantity: integer("updated_stocked_quantity").notNull(),
    workflowRunId: text("workflow_run_id"),
  },
  (table) => [
    uniqueIndex("inventory_adjustment_event_idempotency_idx").on(
      table.idempotencyKey
    ),
    index("inventory_adjustment_event_item_idx").on(table.inventoryItemId),
  ]
);

export const InventoryItemPostgresRowSchema = createSelectSchema(
  postgresInventoryItem,
  {
    id: () => InventoryItemSerializedIdSchema,
    metadataJson: () => InventoryMetadataSchema,
    sku: () => InventoryTrimmedStringSchema,
    title: () => InventoryTrimmedStringSchema,
  }
);
export const InventoryItemPostgresInsertSchema = createInsertSchema(
  postgresInventoryItem,
  {
    id: () => InventoryItemSerializedIdSchema,
    metadataJson: () => InventoryMetadataSchema,
    sku: () => InventoryTrimmedStringSchema,
    title: () => InventoryTrimmedStringSchema,
  }
);

export const StockLocationPostgresRowSchema = createSelectSchema(
  postgresInventoryStockLocation,
  {
    id: () => StockLocationSerializedIdSchema,
    metadataJson: () => InventoryMetadataSchema,
    name: () => InventoryTrimmedStringSchema,
    salesChannelIdsJson: () => Schema.Array(InventoryTrimmedStringSchema),
  }
);
export const StockLocationPostgresInsertSchema = createInsertSchema(
  postgresInventoryStockLocation,
  {
    id: () => StockLocationSerializedIdSchema,
    metadataJson: () => InventoryMetadataSchema,
    name: () => InventoryTrimmedStringSchema,
    salesChannelIdsJson: () => Schema.Array(InventoryTrimmedStringSchema),
  }
);

export const InventoryLevelPostgresRowSchema = createSelectSchema(
  postgresInventoryLevel,
  {
    id: () => InventoryLevelSerializedIdSchema,
    inventoryItemId: () => InventoryItemSerializedIdSchema,
    stockLocationId: () => StockLocationSerializedIdSchema,
  }
);
export const InventoryLevelPostgresInsertSchema = createInsertSchema(
  postgresInventoryLevel,
  {
    id: () => InventoryLevelSerializedIdSchema,
    inventoryItemId: () => InventoryItemSerializedIdSchema,
    stockLocationId: () => StockLocationSerializedIdSchema,
  }
);

export const InventoryReservationPostgresRowSchema = createSelectSchema(
  postgresInventoryReservation,
  {
    id: () => InventoryReservationSerializedIdSchema,
    inventoryItemId: () => InventoryItemSerializedIdSchema,
    status: () => InventoryReservationStatusSchema,
    stockLocationId: () => StockLocationSerializedIdSchema,
  }
);
export const InventoryReservationPostgresInsertSchema = createInsertSchema(
  postgresInventoryReservation,
  {
    id: () => InventoryReservationSerializedIdSchema,
    inventoryItemId: () => InventoryItemSerializedIdSchema,
    status: () => InventoryReservationStatusSchema,
    stockLocationId: () => StockLocationSerializedIdSchema,
  }
);

export const InventoryAdjustmentEventPostgresRowSchema = createSelectSchema(
  postgresInventoryAdjustmentEvent,
  {
    id: () => InventoryAdjustmentEventSerializedIdSchema,
    inventoryItemId: () => InventoryItemSerializedIdSchema,
    reason: () => InventoryAdjustmentReasonSchema,
    stockLocationId: () => StockLocationSerializedIdSchema,
  }
);
export const InventoryAdjustmentEventPostgresInsertSchema = createInsertSchema(
  postgresInventoryAdjustmentEvent,
  {
    id: () => InventoryAdjustmentEventSerializedIdSchema,
    inventoryItemId: () => InventoryItemSerializedIdSchema,
    reason: () => InventoryAdjustmentReasonSchema,
    stockLocationId: () => StockLocationSerializedIdSchema,
  }
);

export type InventoryItemPostgresRow =
  typeof InventoryItemPostgresRowSchema.Type;
export type InventoryItemPostgresInsert =
  typeof InventoryItemPostgresInsertSchema.Type;
export type StockLocationPostgresRow =
  typeof StockLocationPostgresRowSchema.Type;
export type StockLocationPostgresInsert =
  typeof StockLocationPostgresInsertSchema.Type;
export type InventoryLevelPostgresRow =
  typeof InventoryLevelPostgresRowSchema.Type;
export type InventoryLevelPostgresInsert =
  typeof InventoryLevelPostgresInsertSchema.Type;
export type InventoryReservationPostgresRow =
  typeof InventoryReservationPostgresRowSchema.Type;
export type InventoryReservationPostgresInsert =
  typeof InventoryReservationPostgresInsertSchema.Type;
export type InventoryAdjustmentEventPostgresRow =
  typeof InventoryAdjustmentEventPostgresRowSchema.Type;
export type InventoryAdjustmentEventPostgresInsert =
  typeof InventoryAdjustmentEventPostgresInsertSchema.Type;
