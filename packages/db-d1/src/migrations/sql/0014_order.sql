CREATE TABLE IF NOT EXISTS order_record (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL,
  customer_id TEXT,
  email TEXT,
  status TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  totals TEXT NOT NULL,
  billing_address TEXT,
  shipping_address TEXT,
  payment_references TEXT NOT NULL,
  fulfillment_references TEXT NOT NULL,
  metadata TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS order_cart_id_idx
ON order_record (cart_id);

CREATE INDEX IF NOT EXISTS order_customer_id_idx
ON order_record (customer_id);

CREATE TABLE IF NOT EXISTS order_line_item (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES order_record(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  tax_total INTEGER NOT NULL,
  total INTEGER NOT NULL,
  item_snapshot TEXT NOT NULL,
  metadata TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS order_line_item_order_id_idx
ON order_line_item (order_id);

CREATE TABLE IF NOT EXISTS order_transaction (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES order_record(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  reference_id TEXT,
  metadata TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS order_transaction_order_id_idx
ON order_transaction (order_id);

CREATE TABLE IF NOT EXISTS order_state_transition (
  order_id TEXT NOT NULL REFERENCES order_record(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  metadata TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  changed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS order_post_purchase_operation (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES order_record(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
