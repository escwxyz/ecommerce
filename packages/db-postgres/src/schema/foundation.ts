import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Drizzle migration table name used by the Effect PostgreSQL migrator. */
export const drizzleMigrationsTableName = "__drizzle_migrations" as const;

/** PostgreSQL table that stores project-level migration audit records. */
export const commerceMigrationAuditTableName =
  "commerce_migration_audit" as const;

/** PostgreSQL table that stores transactional outbox records. */
export const commerceOutboxTableName = "commerce_outbox" as const;

/** PostgreSQL table that stores terminal outbox delivery failures. */
export const commerceOutboxDeadLetterTableName =
  "commerce_outbox_dead_letter" as const;

/** Project-level migration audit records separate from Drizzle's own journal. */
export const commerceMigrationAudit = pgTable(
  commerceMigrationAuditTableName,
  {
    appliedAt: timestamp("applied_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    checksum: text("checksum").notNull(),
    description: text("description").notNull(),
    id: text("id").primaryKey(),
    migrationId: text("migration_id").notNull(),
  },
  (table) => [
    uniqueIndex("commerce_migration_audit_migration_id_idx").on(
      table.migrationId
    ),
  ]
);

/** Transactional outbox records committed beside module state changes. */
export const commerceOutbox = pgTable(
  commerceOutboxTableName,
  {
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    causationId: text("causation_id"),
    claimId: text("claim_id"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    correlationId: text("correlation_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    eventEmittedAt: timestamp("event_emitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    eventId: text("event_id").notNull(),
    eventName: text("event_name").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    lastError: text("last_error"),
    payloadJson: jsonb("payload_json").notNull(),
    recordId: text("record_id").primaryKey(),
    sourceModule: text("source_module"),
    status: text("status").notNull().default("pending"),
    subjectId: text("subject_id"),
    subjectType: text("subject_type"),
    traceId: text("trace_id"),
    topic: text("topic").notNull(),
    transactionId: text("transaction_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    workflowRunId: text("workflow_run_id"),
  },
  (table) => [
    index("commerce_outbox_claim_idx").on(table.status, table.availableAt),
    index("commerce_outbox_event_idx").on(table.eventName, table.createdAt),
    index("commerce_outbox_topic_status_idx").on(table.topic, table.status),
    uniqueIndex("commerce_outbox_topic_idempotency_idx").on(
      table.topic,
      table.idempotencyKey
    ),
  ]
);

/** Terminal delivery failures for records no longer claimable from the outbox. */
export const commerceOutboxDeadLetter = pgTable(
  commerceOutboxDeadLetterTableName,
  {
    attempts: integer("attempts").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deadLetterId: text("dead_letter_id").primaryKey(),
    eventId: text("event_id").notNull(),
    reason: text("reason").notNull(),
    recordId: text("record_id").notNull(),
  },
  (table) => [
    index("commerce_outbox_dead_letter_event_idx").on(table.eventId),
    index("commerce_outbox_dead_letter_record_idx").on(table.recordId),
  ]
);

/** Drizzle table map for the clean PostgreSQL foundation schema. */
export const postgresFoundationSchema = {
  commerceMigrationAudit,
  commerceOutbox,
  commerceOutboxDeadLetter,
} as const;

export type CommerceMigrationAuditRow =
  typeof commerceMigrationAudit.$inferSelect;
export type CommerceMigrationAuditInsert =
  typeof commerceMigrationAudit.$inferInsert;
export type CommerceOutboxRow = typeof commerceOutbox.$inferSelect;
export type CommerceOutboxInsert = typeof commerceOutbox.$inferInsert;
export type CommerceOutboxDeadLetterRow =
  typeof commerceOutboxDeadLetter.$inferSelect;
export type CommerceOutboxDeadLetterInsert =
  typeof commerceOutboxDeadLetter.$inferInsert;
