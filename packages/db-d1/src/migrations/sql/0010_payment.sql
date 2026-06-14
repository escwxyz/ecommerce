CREATE TABLE IF NOT EXISTS payment_provider (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL,
  provider_record_id TEXT NOT NULL,
  is_enabled INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_key_idx
  ON payment_provider(provider_key);

CREATE TABLE IF NOT EXISTS payment_account_holder (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  provider_account_holder_id TEXT NOT NULL,
  email TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_account_holder_provider_idx
  ON payment_account_holder(provider_key, provider_account_holder_id);

CREATE TABLE IF NOT EXISTS payment_method (
  id TEXT PRIMARY KEY,
  account_holder_id TEXT REFERENCES payment_account_holder(id) ON DELETE SET NULL,
  provider_key TEXT NOT NULL,
  provider_payment_method_id TEXT NOT NULL,
  type TEXT NOT NULL,
  display_name TEXT,
  reusable INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS payment_method_account_holder_idx
  ON payment_method(account_holder_id);

CREATE TABLE IF NOT EXISTS payment_collection (
  id TEXT PRIMARY KEY,
  cart_id TEXT,
  amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS payment_collection_status_idx
  ON payment_collection(status);

CREATE TABLE IF NOT EXISTS payment_session (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES payment_collection(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  provider_checkout_session_id TEXT,
  provider_payment_intent_id TEXT,
  amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS payment_session_collection_idx
  ON payment_session(collection_id);

CREATE TABLE IF NOT EXISTS payment (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES payment_collection(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES payment_session(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  provider_payment_intent_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_intent_idx
  ON payment(provider_key, provider_payment_intent_id);

CREATE TABLE IF NOT EXISTS payment_capture (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  provider_capture_id TEXT,
  amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_capture_idempotency_idx
  ON payment_capture(idempotency_key);

CREATE TABLE IF NOT EXISTS payment_refund (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  provider_refund_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_refund_idempotency_idx
  ON payment_refund(idempotency_key);
