CREATE TABLE IF NOT EXISTS "commerce_migration_audit" (
  "id" text PRIMARY KEY,
  "migration_id" text NOT NULL,
  "checksum" text NOT NULL,
  "description" text NOT NULL,
  "applied_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "commerce_migration_audit_migration_id_idx"
  ON "commerce_migration_audit" ("migration_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commerce_outbox" (
  "record_id" text PRIMARY KEY,
  "topic" text NOT NULL,
  "event_id" text NOT NULL,
  "event_name" text NOT NULL,
  "source_module" text,
  "payload_json" jsonb NOT NULL,
  "idempotency_key" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "available_at" timestamp with time zone NOT NULL DEFAULT now(),
  "claim_id" text,
  "claimed_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "event_emitted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_error" text,
  "transaction_id" text NOT NULL,
  "correlation_id" text,
  "causation_id" text,
  "workflow_run_id" text,
  "subject_type" text,
  "subject_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "commerce_outbox_status_check"
    CHECK ("status" IN ('pending', 'claimed', 'delivered', 'failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_outbox_claim_idx"
  ON "commerce_outbox" ("status", "available_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_outbox_event_idx"
  ON "commerce_outbox" ("event_name", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_outbox_topic_status_idx"
  ON "commerce_outbox" ("topic", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "commerce_outbox_topic_idempotency_idx"
  ON "commerce_outbox" ("topic", "idempotency_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commerce_outbox_dead_letter" (
  "dead_letter_id" text PRIMARY KEY,
  "record_id" text NOT NULL,
  "event_id" text NOT NULL,
  "attempts" integer NOT NULL,
  "reason" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_outbox_dead_letter_event_idx"
  ON "commerce_outbox_dead_letter" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_outbox_dead_letter_record_idx"
  ON "commerce_outbox_dead_letter" ("record_id");
