CREATE TABLE IF NOT EXISTS store (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  default_currency_code TEXT NOT NULL,
  supported_currency_codes_json TEXT NOT NULL DEFAULT '[]',
  default_region_id TEXT,
  default_sales_channel_id TEXT,
  default_locale TEXT NOT NULL,
  timezone TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
