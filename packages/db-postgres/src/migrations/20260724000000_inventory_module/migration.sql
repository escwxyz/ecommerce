CREATE TABLE IF NOT EXISTS "inventory_item" (
	"id" text PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"title" text NOT NULL,
	"metadata_json" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_item_sku_idx" ON "inventory_item" USING btree ("sku");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_item_created_at_idx" ON "inventory_item" USING btree ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_stock_location" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"metadata_json" jsonb NOT NULL,
	"sales_channel_ids_json" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_stock_location_created_at_idx" ON "inventory_stock_location" USING btree ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_level" (
	"id" text PRIMARY KEY NOT NULL,
	"inventory_item_id" text NOT NULL,
	"stock_location_id" text NOT NULL,
	"stocked_quantity" integer NOT NULL,
	"reserved_quantity" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "inventory_level_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "inventory_level_stock_location_id_inventory_stock_location_id_fk" FOREIGN KEY ("stock_location_id") REFERENCES "public"."inventory_stock_location"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_level_scope_idx" ON "inventory_level" USING btree ("inventory_item_id","stock_location_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_level_item_idx" ON "inventory_level" USING btree ("inventory_item_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_reservation" (
	"id" text PRIMARY KEY NOT NULL,
	"inventory_item_id" text NOT NULL,
	"stock_location_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"status" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"correlation_id" text NOT NULL,
	"causation_id" text,
	"workflow_run_id" text,
	"sales_channel_id" text,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "inventory_reservation_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "inventory_reservation_stock_location_id_inventory_stock_location_id_fk" FOREIGN KEY ("stock_location_id") REFERENCES "public"."inventory_stock_location"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_reservation_idempotency_idx" ON "inventory_reservation" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_reservation_level_idx" ON "inventory_reservation" USING btree ("inventory_item_id","stock_location_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_adjustment_event" (
	"id" text PRIMARY KEY NOT NULL,
	"inventory_item_id" text NOT NULL,
	"stock_location_id" text NOT NULL,
	"adjustment" integer NOT NULL,
	"updated_stocked_quantity" integer NOT NULL,
	"reason" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"correlation_id" text NOT NULL,
	"causation_id" text,
	"workflow_run_id" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "inventory_adjustment_event_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "inventory_adjustment_event_stock_location_id_inventory_stock_location_id_fk" FOREIGN KEY ("stock_location_id") REFERENCES "public"."inventory_stock_location"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_adjustment_event_idempotency_idx" ON "inventory_adjustment_event" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_adjustment_event_item_idx" ON "inventory_adjustment_event" USING btree ("inventory_item_id");
