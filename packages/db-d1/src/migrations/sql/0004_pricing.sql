CREATE TABLE IF NOT EXISTS pricing_currency (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  precision INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pricing_price_set (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pricing_price_list (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  starts_at INTEGER,
  ends_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pricing_money_amount (
  id TEXT PRIMARY KEY,
  price_set_id TEXT NOT NULL REFERENCES pricing_price_set(id) ON DELETE CASCADE,
  price_list_id TEXT REFERENCES pricing_price_list(id) ON DELETE SET NULL,
  currency_code TEXT NOT NULL REFERENCES pricing_currency(code) ON DELETE RESTRICT,
  amount INTEGER NOT NULL,
  rules_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS pricing_money_amount_price_set_idx
  ON pricing_money_amount(price_set_id);

CREATE TABLE IF NOT EXISTS pricing_price_rule (
  id TEXT PRIMARY KEY,
  price_list_id TEXT NOT NULL REFERENCES pricing_price_list(id) ON DELETE CASCADE,
  attribute TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS pricing_price_rule_price_list_idx
  ON pricing_price_rule(price_list_id);

CREATE TABLE IF NOT EXISTS pricing_price_preference (
  id TEXT PRIMARY KEY,
  attribute TEXT NOT NULL,
  value TEXT NOT NULL,
  currency_code TEXT NOT NULL REFERENCES pricing_currency(code) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS pricing_price_preference_scope_idx
  ON pricing_price_preference(attribute, value);
