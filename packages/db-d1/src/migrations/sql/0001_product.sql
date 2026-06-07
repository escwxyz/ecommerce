CREATE TABLE IF NOT EXISTS product (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS product_handle_idx ON product(handle);
