CREATE TABLE IF NOT EXISTS cart (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  email TEXT,
  region_id TEXT,
  sales_channel_id TEXT,
  currency_code TEXT NOT NULL,
  shipping_option_id TEXT,
  payment_collection_id TEXT,
  billing_address_json TEXT,
  shipping_address_json TEXT,
  totals_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS cart_customer_idx
ON cart (customer_id);

CREATE TABLE IF NOT EXISTS cart_line_item (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  metadata_json TEXT NOT NULL,
  idempotency_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS cart_line_item_cart_idx
ON cart_line_item (cart_id);

CREATE UNIQUE INDEX IF NOT EXISTS cart_line_item_idempotency_idx
ON cart_line_item (idempotency_key);

CREATE TABLE IF NOT EXISTS cart_adjustment (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
  line_item_id TEXT,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  amount INTEGER NOT NULL,
  metadata_json TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS cart_adjustment_cart_idx
ON cart_adjustment (cart_id);

CREATE UNIQUE INDEX IF NOT EXISTS cart_adjustment_idempotency_idx
ON cart_adjustment (idempotency_key);
