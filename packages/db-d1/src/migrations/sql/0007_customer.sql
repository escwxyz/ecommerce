CREATE TABLE IF NOT EXISTS customer (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  auth_user_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_email_idx
  ON customer(email);

CREATE UNIQUE INDEX IF NOT EXISTS customer_auth_user_id_idx
  ON customer(auth_user_id);

CREATE TABLE IF NOT EXISTS customer_address (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  address1 TEXT NOT NULL,
  address2 TEXT,
  city TEXT NOT NULL,
  province TEXT,
  postal_code TEXT NOT NULL,
  country_code TEXT NOT NULL,
  phone TEXT,
  is_default_billing INTEGER NOT NULL,
  is_default_shipping INTEGER NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS customer_address_customer_id_idx
  ON customer_address(customer_id);

CREATE TABLE IF NOT EXISTS customer_group (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  name TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_group_handle_idx
  ON customer_group(handle);

CREATE TABLE IF NOT EXISTS customer_group_customer (
  customer_id TEXT NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  customer_group_id TEXT NOT NULL REFERENCES customer_group(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, customer_group_id)
);
