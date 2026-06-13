CREATE TABLE IF NOT EXISTS region (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  tax_provider_id TEXT,
  payment_provider_ids_json TEXT NOT NULL DEFAULT '[]',
  fulfillment_option_ids_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS region_country (
  region_id TEXT NOT NULL REFERENCES region(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  PRIMARY KEY (region_id, country_code)
);

CREATE INDEX IF NOT EXISTS region_country_region_idx
  ON region_country(region_id);

CREATE TABLE IF NOT EXISTS sales_channel (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_channel_product (
  sales_channel_id TEXT NOT NULL REFERENCES sales_channel(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  PRIMARY KEY (sales_channel_id, product_id)
);

CREATE INDEX IF NOT EXISTS sales_channel_product_channel_idx
  ON sales_channel_product(sales_channel_id);
