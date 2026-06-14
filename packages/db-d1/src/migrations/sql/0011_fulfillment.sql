CREATE TABLE IF NOT EXISTS fulfillment_provider (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL,
  provider_record_id TEXT NOT NULL,
  is_enabled INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS fulfillment_provider_key_idx
  ON fulfillment_provider(provider_key);

CREATE TABLE IF NOT EXISTS fulfillment_set (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shipping_profile (
  id TEXT PRIMARY KEY,
  fulfillment_set_id TEXT NOT NULL REFERENCES fulfillment_set(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS shipping_profile_set_idx
  ON shipping_profile(fulfillment_set_id);

CREATE TABLE IF NOT EXISTS service_zone (
  id TEXT PRIMARY KEY,
  fulfillment_set_id TEXT NOT NULL REFERENCES fulfillment_set(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country_codes_json TEXT NOT NULL DEFAULT '[]',
  region_ids_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS service_zone_set_idx
  ON service_zone(fulfillment_set_id);

CREATE TABLE IF NOT EXISTS shipping_option (
  id TEXT PRIMARY KEY,
  fulfillment_set_id TEXT NOT NULL REFERENCES fulfillment_set(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES shipping_profile(id) ON DELETE CASCADE,
  service_zone_id TEXT NOT NULL REFERENCES service_zone(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  provider_service_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price_amount INTEGER,
  currency_code TEXT,
  is_enabled INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS shipping_option_set_idx
  ON shipping_option(fulfillment_set_id);

CREATE INDEX IF NOT EXISTS shipping_option_provider_idx
  ON shipping_option(provider_key, provider_service_id);

CREATE TABLE IF NOT EXISTS fulfillment (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  order_id TEXT NOT NULL,
  shipping_option_id TEXT NOT NULL REFERENCES shipping_option(id) ON DELETE RESTRICT,
  provider_key TEXT NOT NULL,
  provider_fulfillment_id TEXT,
  status TEXT NOT NULL,
  items_json TEXT NOT NULL DEFAULT '[]',
  address_json TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS fulfillment_idempotency_idx
  ON fulfillment(idempotency_key);

CREATE INDEX IF NOT EXISTS fulfillment_order_idx
  ON fulfillment(order_id);

CREATE TABLE IF NOT EXISTS shipment (
  id TEXT PRIMARY KEY,
  fulfillment_id TEXT NOT NULL REFERENCES fulfillment(id) ON DELETE CASCADE,
  provider_shipment_id TEXT NOT NULL,
  status TEXT NOT NULL,
  carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  label_url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS shipment_fulfillment_idx
  ON shipment(fulfillment_id);

CREATE TABLE IF NOT EXISTS return_shipment_link (
  id TEXT PRIMARY KEY,
  fulfillment_id TEXT NOT NULL REFERENCES fulfillment(id) ON DELETE CASCADE,
  shipment_id TEXT NOT NULL REFERENCES shipment(id) ON DELETE CASCADE,
  return_id TEXT NOT NULL,
  provider_return_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS return_shipment_fulfillment_idx
  ON return_shipment_link(fulfillment_id);
