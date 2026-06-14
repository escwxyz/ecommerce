CREATE TABLE IF NOT EXISTS event_outbox (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  source_module TEXT,
  payload_json TEXT NOT NULL,
  emitted_at INTEGER NOT NULL,
  correlation_id TEXT,
  causation_id TEXT,
  workflow_run_id TEXT,
  subject_type TEXT,
  subject_id TEXT,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  available_at INTEGER NOT NULL,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS event_outbox_status_idx
ON event_outbox (status, available_at);

CREATE TABLE IF NOT EXISTS event_dead_letter (
  id TEXT PRIMARY KEY,
  outbox_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS event_dead_letter_event_idx
ON event_dead_letter (event_id);

CREATE TABLE IF NOT EXISTS notification_provider (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL,
  is_enabled INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_provider_key_idx
ON notification_provider (provider_key);

CREATE TABLE IF NOT EXISTS notification_template (
  id TEXT PRIMARY KEY,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_template_key_idx
ON notification_template (template_key, channel);

CREATE TABLE IF NOT EXISTS notification_dispatch (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  template_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  provider_message_id TEXT,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  workflow_run_id TEXT,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  delivered_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_dispatch_idempotency_idx
ON notification_dispatch (idempotency_key);
