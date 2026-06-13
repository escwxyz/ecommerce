import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const inventoryItemTableName = "inventory_item" as const;
export const stockLocationTableName = "inventory_stock_location" as const;
export const inventoryLevelTableName = "inventory_level" as const;
export const inventoryReservationTableName = "inventory_reservation" as const;
export const inventoryAdjustmentEventTableName =
  "inventory_adjustment_event" as const;
export const inventoryItemSkuIndexName = "inventory_item_sku_idx" as const;
export const inventoryLevelScopeIndexName =
  "inventory_level_scope_idx" as const;
export const inventoryReservationIdempotencyIndexName =
  "inventory_reservation_idempotency_idx" as const;
export const inventoryReservationLevelIndexName =
  "inventory_reservation_level_idx" as const;

type TimestampMsColumn = ColumnType<number, number, number>;

export interface InventoryItemTable {
  created_at: TimestampMsColumn;
  id: string;
  metadata_json: string;
  sku: string;
  title: string;
  updated_at: TimestampMsColumn;
}

export interface StockLocationTable {
  created_at: TimestampMsColumn;
  id: string;
  metadata_json: string;
  name: string;
  sales_channel_ids_json: string;
  updated_at: TimestampMsColumn;
}

export interface InventoryLevelTable {
  created_at: TimestampMsColumn;
  id: string;
  inventory_item_id: string;
  reserved_quantity: number;
  stock_location_id: string;
  stocked_quantity: number;
  updated_at: TimestampMsColumn;
}

export interface InventoryReservationTable {
  causation_id: string | null;
  correlation_id: string;
  created_at: TimestampMsColumn;
  id: string;
  idempotency_key: string;
  inventory_item_id: string;
  quantity: number;
  released_at: TimestampMsColumn | null;
  sales_channel_id: string | null;
  status: string;
  stock_location_id: string;
  updated_at: TimestampMsColumn;
  workflow_run_id: string | null;
}

export interface InventoryAdjustmentEventTable {
  adjustment: number;
  causation_id: string | null;
  correlation_id: string;
  created_at: TimestampMsColumn;
  id: string;
  inventory_item_id: string;
  reason: string;
  stock_location_id: string;
  updated_stocked_quantity: number;
  workflow_run_id: string | null;
}

export interface InventoryDatabase {
  inventory_adjustment_event: InventoryAdjustmentEventTable;
  inventory_item: InventoryItemTable;
  inventory_level: InventoryLevelTable;
  inventory_reservation: InventoryReservationTable;
  inventory_stock_location: StockLocationTable;
}

export const inventorySchema = {
  adjustmentEvent: inventoryAdjustmentEventTableName,
  inventoryItem: inventoryItemTableName,
  inventoryLevel: inventoryLevelTableName,
  reservation: inventoryReservationTableName,
  stockLocation: stockLocationTableName,
} as const;

export type InventoryItemRow = Selectable<InventoryItemTable>;
export type InventoryItemInsert = Insertable<InventoryItemTable>;
export type StockLocationRow = Selectable<StockLocationTable>;
export type StockLocationInsert = Insertable<StockLocationTable>;
export type InventoryLevelRow = Selectable<InventoryLevelTable>;
export type InventoryLevelInsert = Insertable<InventoryLevelTable>;
export type InventoryReservationRow = Selectable<InventoryReservationTable>;
export type InventoryReservationInsert = Insertable<InventoryReservationTable>;
export type InventoryAdjustmentEventRow =
  Selectable<InventoryAdjustmentEventTable>;
export type InventoryAdjustmentEventInsert =
  Insertable<InventoryAdjustmentEventTable>;
export type InventoryDatabaseSchema = InventoryDatabase;
export type InventorySchemaKey = keyof InventoryDatabase;

export const inventoryMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await db.schema
      .dropTable(inventoryAdjustmentEventTableName)
      .ifExists()
      .execute();
    await db.schema
      .dropTable(inventoryReservationTableName)
      .ifExists()
      .execute();
    await db.schema.dropTable(inventoryLevelTableName).ifExists().execute();
    await db.schema.dropTable(stockLocationTableName).ifExists().execute();
    await db.schema.dropTable(inventoryItemTableName).ifExists().execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable(inventoryItemTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("sku", "text", (column) => column.notNull())
      .addColumn("title", "text", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(inventoryItemSkuIndexName)
      .ifNotExists()
      .unique()
      .on(inventoryItemTableName)
      .column("sku")
      .execute();

    await db.schema
      .createTable(stockLocationTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("sales_channel_ids_json", "text", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createTable(inventoryLevelTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("inventory_item_id", "text", (column) =>
        column
          .notNull()
          .references(`${inventoryItemTableName}.id`)
          .onDelete("cascade")
      )
      .addColumn("stock_location_id", "text", (column) =>
        column
          .notNull()
          .references(`${stockLocationTableName}.id`)
          .onDelete("cascade")
      )
      .addColumn("stocked_quantity", "integer", (column) => column.notNull())
      .addColumn("reserved_quantity", "integer", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(inventoryLevelScopeIndexName)
      .ifNotExists()
      .unique()
      .on(inventoryLevelTableName)
      .columns(["inventory_item_id", "stock_location_id"])
      .execute();

    await db.schema
      .createTable(inventoryReservationTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("inventory_item_id", "text", (column) => column.notNull())
      .addColumn("stock_location_id", "text", (column) => column.notNull())
      .addColumn("sales_channel_id", "text")
      .addColumn("quantity", "integer", (column) => column.notNull())
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("idempotency_key", "text", (column) => column.notNull())
      .addColumn("correlation_id", "text", (column) => column.notNull())
      .addColumn("causation_id", "text")
      .addColumn("workflow_run_id", "text")
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .addColumn("released_at", "integer")
      .execute();

    await db.schema
      .createIndex(inventoryReservationIdempotencyIndexName)
      .ifNotExists()
      .unique()
      .on(inventoryReservationTableName)
      .column("idempotency_key")
      .execute();

    await db.schema
      .createIndex(inventoryReservationLevelIndexName)
      .ifNotExists()
      .on(inventoryReservationTableName)
      .columns(["inventory_item_id", "stock_location_id"])
      .execute();

    await db.schema
      .createTable(inventoryAdjustmentEventTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("inventory_item_id", "text", (column) => column.notNull())
      .addColumn("stock_location_id", "text", (column) => column.notNull())
      .addColumn("adjustment", "integer", (column) => column.notNull())
      .addColumn("updated_stocked_quantity", "integer", (column) =>
        column.notNull()
      )
      .addColumn("reason", "text", (column) => column.notNull())
      .addColumn("correlation_id", "text", (column) => column.notNull())
      .addColumn("causation_id", "text")
      .addColumn("workflow_run_id", "text")
      .addColumn("created_at", "integer", (column) => column.notNull())
      .execute();
  },
};
