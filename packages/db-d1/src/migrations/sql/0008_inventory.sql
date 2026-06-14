CREATE TABLE IF NOT EXISTS inventory_item (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  title TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_item_sku_idx
  ON inventory_item(sku);

CREATE TABLE IF NOT EXISTS inventory_stock_location (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sales_channel_ids_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_level (
  id TEXT PRIMARY KEY,
  inventory_item_id TEXT NOT NULL REFERENCES inventory_item(id) ON DELETE CASCADE,
  stock_location_id TEXT NOT NULL REFERENCES inventory_stock_location(id) ON DELETE CASCADE,
  stocked_quantity INTEGER NOT NULL,
  reserved_quantity INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_level_scope_idx
  ON inventory_level(inventory_item_id, stock_location_id);

CREATE TABLE IF NOT EXISTS inventory_reservation (
  id TEXT PRIMARY KEY,
  inventory_item_id TEXT NOT NULL,
  stock_location_id TEXT NOT NULL,
  sales_channel_id TEXT,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  workflow_run_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  released_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_reservation_idempotency_idx
  ON inventory_reservation(idempotency_key);

CREATE INDEX IF NOT EXISTS inventory_reservation_level_idx
  ON inventory_reservation(inventory_item_id, stock_location_id);

CREATE TABLE IF NOT EXISTS inventory_adjustment_event (
  id TEXT PRIMARY KEY,
  inventory_item_id TEXT NOT NULL,
  stock_location_id TEXT NOT NULL,
  adjustment INTEGER NOT NULL,
  updated_stocked_quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  workflow_run_id TEXT,
  created_at INTEGER NOT NULL
);
