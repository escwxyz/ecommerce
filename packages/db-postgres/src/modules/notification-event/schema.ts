import {
  EventEnvelopeSchema,
  EventOutboxStatusSchema,
  EventSerializedIdSchema,
  NotificationChannelSchema,
  NotificationDispatchSerializedIdSchema,
  NotificationDispatchStatusSchema,
  NotificationEventTrimmedStringSchema,
  NotificationProviderSerializedIdSchema,
  NotificationRecipientSchema,
  NotificationTemplateSerializedIdSchema,
} from "@ecommerce/notification-event";
import {
  createInsertSchema,
  createSelectSchema,
} from "drizzle-orm/effect-schema";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Schema } from "effect";

export const postgresEventOutboxTableName = "event_outbox" as const;
export const postgresEventDeadLetterTableName = "event_dead_letter" as const;
export const postgresNotificationProviderTableName =
  "notification_provider" as const;
export const postgresNotificationTemplateTableName =
  "notification_template" as const;
export const postgresNotificationDispatchTableName =
  "notification_dispatch" as const;

export const postgresEventOutbox = pgTable(
  postgresEventOutboxTableName,
  {
    attempts: integer("attempts").notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    envelopeJson: jsonb("envelope_json")
      .$type<typeof EventEnvelopeSchema.Type>()
      .notNull(),
    eventId: text("event_id").notNull(),
    id: text("id").primaryKey(),
    lastError: text("last_error"),
    status: text("status").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("event_outbox_available_at_idx").on(table.availableAt),
    index("event_outbox_event_id_idx").on(table.eventId),
    index("event_outbox_status_idx").on(table.status),
  ]
);

export const postgresEventDeadLetter = pgTable(
  postgresEventDeadLetterTableName,
  {
    attempts: integer("attempts").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    eventId: text("event_id").notNull(),
    id: text("id").primaryKey(),
    outboxId: text("outbox_id")
      .notNull()
      .references(() => postgresEventOutbox.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
  },
  (table) => [
    index("event_dead_letter_created_at_idx").on(table.createdAt),
    index("event_dead_letter_event_id_idx").on(table.eventId),
    index("event_dead_letter_outbox_id_idx").on(table.outboxId),
  ]
);

export const postgresNotificationProvider = pgTable(
  postgresNotificationProviderTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    isEnabled: boolean("is_enabled").notNull(),
    providerKey: text("provider_key").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("notification_provider_provider_key_idx").on(table.providerKey),
  ]
);

export const postgresNotificationTemplate = pgTable(
  postgresNotificationTemplateTableName,
  {
    channel: text("channel").notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    providerKey: text("provider_key").notNull(),
    subject: text("subject"),
    templateKey: text("template_key").notNull(),
  },
  (table) => [
    uniqueIndex("notification_template_key_channel_idx").on(
      table.templateKey,
      table.channel
    ),
    index("notification_template_provider_key_idx").on(table.providerKey),
  ]
);

export const postgresNotificationDispatch = pgTable(
  postgresNotificationDispatchTableName,
  {
    attempts: integer("attempts").notNull(),
    causationId: text("causation_id"),
    channel: text("channel").notNull(),
    correlationId: text("correlation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    lastError: text("last_error"),
    payloadJson: jsonb("payload_json").$type<unknown>().notNull(),
    providerKey: text("provider_key").notNull(),
    providerMessageId: text("provider_message_id"),
    recipientJson: jsonb("recipient_json")
      .$type<typeof NotificationRecipientSchema.Type>()
      .notNull(),
    status: text("status").notNull(),
    templateId: text("template_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    workflowRunId: text("workflow_run_id"),
  },
  (table) => [
    index("notification_dispatch_created_at_idx").on(table.createdAt),
    uniqueIndex("notification_dispatch_idempotency_key_idx").on(
      table.idempotencyKey
    ),
    index("notification_dispatch_status_idx").on(table.status),
  ]
);

export const EventOutboxPostgresRowSchema = createSelectSchema(
  postgresEventOutbox,
  {
    envelopeJson: () => EventEnvelopeSchema,
    eventId: () => EventSerializedIdSchema,
    id: () => EventSerializedIdSchema,
    lastError: () => Schema.NullOr(NotificationEventTrimmedStringSchema),
    status: () => EventOutboxStatusSchema,
  }
);
export const EventOutboxPostgresInsertSchema = createInsertSchema(
  postgresEventOutbox,
  {
    envelopeJson: () => EventEnvelopeSchema,
    eventId: () => EventSerializedIdSchema,
    id: () => EventSerializedIdSchema,
    lastError: () => Schema.NullOr(NotificationEventTrimmedStringSchema),
    status: () => EventOutboxStatusSchema,
  }
);

export const EventDeadLetterPostgresRowSchema = createSelectSchema(
  postgresEventDeadLetter,
  {
    eventId: () => EventSerializedIdSchema,
    id: () => NotificationEventTrimmedStringSchema,
    outboxId: () => EventSerializedIdSchema,
    reason: () => NotificationEventTrimmedStringSchema,
  }
);
export const EventDeadLetterPostgresInsertSchema = createInsertSchema(
  postgresEventDeadLetter,
  {
    eventId: () => EventSerializedIdSchema,
    id: () => NotificationEventTrimmedStringSchema,
    outboxId: () => EventSerializedIdSchema,
    reason: () => NotificationEventTrimmedStringSchema,
  }
);

export const NotificationProviderPostgresRowSchema = createSelectSchema(
  postgresNotificationProvider,
  {
    id: () => NotificationProviderSerializedIdSchema,
    providerKey: () => NotificationEventTrimmedStringSchema,
  }
);
export const NotificationProviderPostgresInsertSchema = createInsertSchema(
  postgresNotificationProvider,
  {
    id: () => NotificationProviderSerializedIdSchema,
    providerKey: () => NotificationEventTrimmedStringSchema,
  }
);

export const NotificationTemplatePostgresRowSchema = createSelectSchema(
  postgresNotificationTemplate,
  {
    channel: () => NotificationChannelSchema,
    id: () => NotificationTemplateSerializedIdSchema,
    name: () => NotificationEventTrimmedStringSchema,
    providerKey: () => NotificationEventTrimmedStringSchema,
    subject: () => Schema.NullOr(NotificationEventTrimmedStringSchema),
    templateKey: () => NotificationEventTrimmedStringSchema,
  }
);
export const NotificationTemplatePostgresInsertSchema = createInsertSchema(
  postgresNotificationTemplate,
  {
    channel: () => NotificationChannelSchema,
    id: () => NotificationTemplateSerializedIdSchema,
    name: () => NotificationEventTrimmedStringSchema,
    providerKey: () => NotificationEventTrimmedStringSchema,
    subject: () => Schema.NullOr(NotificationEventTrimmedStringSchema),
    templateKey: () => NotificationEventTrimmedStringSchema,
  }
);

export const NotificationDispatchPostgresRowSchema = createSelectSchema(
  postgresNotificationDispatch,
  {
    causationId: () => Schema.NullOr(NotificationEventTrimmedStringSchema),
    channel: () => NotificationChannelSchema,
    id: () => NotificationDispatchSerializedIdSchema,
    idempotencyKey: () => NotificationEventTrimmedStringSchema,
    lastError: () => Schema.NullOr(NotificationEventTrimmedStringSchema),
    providerKey: () => NotificationEventTrimmedStringSchema,
    providerMessageId: () =>
      Schema.NullOr(NotificationEventTrimmedStringSchema),
    recipientJson: () => NotificationRecipientSchema,
    status: () => NotificationDispatchStatusSchema,
    templateId: () => NotificationTemplateSerializedIdSchema,
    workflowRunId: () => Schema.NullOr(NotificationEventTrimmedStringSchema),
  }
);
export const NotificationDispatchPostgresInsertSchema = createInsertSchema(
  postgresNotificationDispatch,
  {
    causationId: () => Schema.NullOr(NotificationEventTrimmedStringSchema),
    channel: () => NotificationChannelSchema,
    id: () => NotificationDispatchSerializedIdSchema,
    idempotencyKey: () => NotificationEventTrimmedStringSchema,
    lastError: () => Schema.NullOr(NotificationEventTrimmedStringSchema),
    providerKey: () => NotificationEventTrimmedStringSchema,
    providerMessageId: () =>
      Schema.NullOr(NotificationEventTrimmedStringSchema),
    recipientJson: () => NotificationRecipientSchema,
    status: () => NotificationDispatchStatusSchema,
    templateId: () => NotificationTemplateSerializedIdSchema,
    workflowRunId: () => Schema.NullOr(NotificationEventTrimmedStringSchema),
  }
);

export type EventOutboxPostgresRow = typeof EventOutboxPostgresRowSchema.Type;
export type EventOutboxPostgresInsert =
  typeof EventOutboxPostgresInsertSchema.Type;
export type EventDeadLetterPostgresRow =
  typeof EventDeadLetterPostgresRowSchema.Type;
export type EventDeadLetterPostgresInsert =
  typeof EventDeadLetterPostgresInsertSchema.Type;
export type NotificationProviderPostgresRow =
  typeof NotificationProviderPostgresRowSchema.Type;
export type NotificationProviderPostgresInsert =
  typeof NotificationProviderPostgresInsertSchema.Type;
export type NotificationTemplatePostgresRow =
  typeof NotificationTemplatePostgresRowSchema.Type;
export type NotificationTemplatePostgresInsert =
  typeof NotificationTemplatePostgresInsertSchema.Type;
export type NotificationDispatchPostgresRow =
  typeof NotificationDispatchPostgresRowSchema.Type;
export type NotificationDispatchPostgresInsert =
  typeof NotificationDispatchPostgresInsertSchema.Type;
