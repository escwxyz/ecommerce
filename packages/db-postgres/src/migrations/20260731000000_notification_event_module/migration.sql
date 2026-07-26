CREATE TABLE IF NOT EXISTS "event_outbox" (
  "id" text PRIMARY KEY NOT NULL,
  "event_id" text NOT NULL,
  "envelope_json" jsonb NOT NULL,
  "status" text NOT NULL,
  "attempts" integer NOT NULL,
  "available_at" timestamp with time zone NOT NULL,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_outbox_available_at_idx" ON "event_outbox" ("available_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_outbox_event_id_idx" ON "event_outbox" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_outbox_status_idx" ON "event_outbox" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_dead_letter" (
  "id" text PRIMARY KEY NOT NULL,
  "outbox_id" text NOT NULL,
  "event_id" text NOT NULL,
  "reason" text NOT NULL,
  "attempts" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "event_dead_letter_outbox_id_event_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "event_outbox"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_dead_letter_created_at_idx" ON "event_dead_letter" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_dead_letter_event_id_idx" ON "event_dead_letter" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_dead_letter_outbox_id_idx" ON "event_dead_letter" ("outbox_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_provider" (
  "id" text PRIMARY KEY NOT NULL,
  "provider_key" text NOT NULL,
  "is_enabled" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_provider_provider_key_idx" ON "notification_provider" ("provider_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_template" (
  "id" text PRIMARY KEY NOT NULL,
  "template_key" text NOT NULL,
  "channel" text NOT NULL,
  "provider_key" text NOT NULL,
  "name" text NOT NULL,
  "subject" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_template_key_channel_idx" ON "notification_template" ("template_key","channel");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_template_provider_key_idx" ON "notification_template" ("provider_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_dispatch" (
  "id" text PRIMARY KEY NOT NULL,
  "template_id" text NOT NULL,
  "provider_key" text NOT NULL,
  "channel" text NOT NULL,
  "recipient_json" jsonb NOT NULL,
  "payload_json" jsonb NOT NULL,
  "status" text NOT NULL,
  "attempts" integer NOT NULL,
  "idempotency_key" text NOT NULL,
  "provider_message_id" text,
  "last_error" text,
  "correlation_id" text NOT NULL,
  "causation_id" text,
  "workflow_run_id" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_dispatch_created_at_idx" ON "notification_dispatch" ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_dispatch_idempotency_key_idx" ON "notification_dispatch" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_dispatch_status_idx" ON "notification_dispatch" ("status");
