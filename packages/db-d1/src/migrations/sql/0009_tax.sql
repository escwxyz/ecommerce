CREATE TABLE IF NOT EXISTS tax_category (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tax_category_code_idx
  ON tax_category(code);

CREATE TABLE IF NOT EXISTS tax_provider_config (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tax_provider_config_key_idx
  ON tax_provider_config(provider_key);

CREATE TABLE IF NOT EXISTS tax_region (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  provider_config_id TEXT REFERENCES tax_provider_config(id) ON DELETE SET NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tax_region_code_idx
  ON tax_region(code);

CREATE TABLE IF NOT EXISTS tax_rate (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES tax_region(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES tax_category(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  percentage REAL NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tax_rate_region_idx
  ON tax_rate(region_id);

CREATE INDEX IF NOT EXISTS tax_rate_category_idx
  ON tax_rate(category_id);

CREATE TABLE IF NOT EXISTS tax_calculation_policy (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES tax_region(id) ON DELETE CASCADE,
  prices_include_tax INTEGER NOT NULL,
  round_at TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
