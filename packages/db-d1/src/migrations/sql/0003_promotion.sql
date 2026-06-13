CREATE TABLE IF NOT EXISTS promotion_campaign (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS promotion_promotion (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES promotion_campaign(id) ON DELETE SET NULL,
  code TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  application_method_json TEXT NOT NULL,
  starts_at INTEGER,
  ends_at INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS promotion_code_idx
  ON promotion_promotion(code)
  WHERE code IS NOT NULL;

CREATE TABLE IF NOT EXISTS promotion_rule (
  id TEXT PRIMARY KEY,
  promotion_id TEXT NOT NULL REFERENCES promotion_promotion(id) ON DELETE CASCADE,
  attribute TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS promotion_rule_promotion_idx
  ON promotion_rule(promotion_id);

CREATE TABLE IF NOT EXISTS promotion_usage_limit (
  id TEXT PRIMARY KEY,
  promotion_id TEXT NOT NULL REFERENCES promotion_promotion(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  limit_value INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS promotion_usage_limit_promotion_idx
  ON promotion_usage_limit(promotion_id);

CREATE TABLE IF NOT EXISTS promotion_redemption (
  id TEXT PRIMARY KEY,
  promotion_id TEXT NOT NULL REFERENCES promotion_promotion(id) ON DELETE CASCADE,
  cart_id TEXT NOT NULL,
  adjustment_ids_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS promotion_redemption_promotion_idx
  ON promotion_redemption(promotion_id);
