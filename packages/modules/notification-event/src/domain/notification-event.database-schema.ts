import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const eventOutboxTableName = "event_outbox" as const;
export const eventDeadLetterTableName = "event_dead_letter" as const;
export const notificationTemplateTableName = "notification_template" as const;
export const notificationDispatchTableName = "notification_dispatch" as const;
export const notificationProviderTableName = "notification_provider" as const;
export const eventOutboxStatusIndexName = "event_outbox_status_idx" as const;
export const eventDeadLetterEventIndexName =
  "event_dead_letter_event_idx" as const;
export const notificationTemplateKeyIndexName =
  "notification_template_key_idx" as const;
export const notificationDispatchIdempotencyIndexName =
  "notification_dispatch_idempotency_idx" as const;
export const notificationProviderKeyIndexName =
  "notification_provider_key_idx" as const;

type TimestampMsColumn = ColumnType<number, number, number>;
type BooleanColumn = ColumnType<number, number, number>;

export interface EventOutboxTable {
  attempts: number;
  available_at: TimestampMsColumn;
  causation_id: string | null;
  correlation_id: string | null;
  created_at: TimestampMsColumn;
  emitted_at: TimestampMsColumn;
  event_id: string;
  event_name: string;
  id: string;
  last_error: string | null;
  payload_json: string;
  source_module: string | null;
  status: string;
  subject_id: string | null;
  subject_type: string | null;
  updated_at: TimestampMsColumn;
  workflow_run_id: string | null;
}

export interface EventDeadLetterTable {
  attempts: number;
  created_at: TimestampMsColumn;
  event_id: string;
  id: string;
  outbox_id: string;
  reason: string;
}

export interface NotificationTemplateTable {
  channel: string;
  id: string;
  name: string;
  provider_key: string;
  subject: string | null;
  template_key: string;
}

export interface NotificationDispatchTable {
  attempts: number;
  causation_id: string | null;
  channel: string;
  correlation_id: string;
  created_at: TimestampMsColumn;
  delivered_at: TimestampMsColumn | null;
  id: string;
  idempotency_key: string;
  last_error: string | null;
  payload_json: string;
  provider_key: string;
  provider_message_id: string | null;
  recipient_address: string;
  recipient_type: string;
  status: string;
  template_id: string;
  updated_at: TimestampMsColumn;
  workflow_run_id: string | null;
}

export interface NotificationProviderTable {
  created_at: TimestampMsColumn;
  id: string;
  is_enabled: BooleanColumn;
  provider_key: string;
  updated_at: TimestampMsColumn;
}

export interface NotificationEventDatabase {
  event_dead_letter: EventDeadLetterTable;
  event_outbox: EventOutboxTable;
  notification_dispatch: NotificationDispatchTable;
  notification_provider: NotificationProviderTable;
  notification_template: NotificationTemplateTable;
}

export const notificationEventSchema = {
  deadLetter: eventDeadLetterTableName,
  dispatch: notificationDispatchTableName,
  outbox: eventOutboxTableName,
  provider: notificationProviderTableName,
  template: notificationTemplateTableName,
} as const;

export type EventOutboxRow = Selectable<EventOutboxTable>;
export type EventOutboxInsert = Insertable<EventOutboxTable>;
export type EventDeadLetterRow = Selectable<EventDeadLetterTable>;
export type EventDeadLetterInsert = Insertable<EventDeadLetterTable>;
export type NotificationTemplateRow = Selectable<NotificationTemplateTable>;
export type NotificationTemplateInsert = Insertable<NotificationTemplateTable>;
export type NotificationDispatchRow = Selectable<NotificationDispatchTable>;
export type NotificationDispatchInsert = Insertable<NotificationDispatchTable>;
export type NotificationProviderRow = Selectable<NotificationProviderTable>;
export type NotificationProviderInsert = Insertable<NotificationProviderTable>;
export type NotificationEventDatabaseSchema = NotificationEventDatabase;
export type NotificationEventSchemaKey = keyof NotificationEventDatabase;

export const notificationEventMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await db.schema
      .dropTable(notificationDispatchTableName)
      .ifExists()
      .execute();
    await db.schema
      .dropTable(notificationTemplateTableName)
      .ifExists()
      .execute();
    await db.schema
      .dropTable(notificationProviderTableName)
      .ifExists()
      .execute();
    await db.schema.dropTable(eventDeadLetterTableName).ifExists().execute();
    await db.schema.dropTable(eventOutboxTableName).ifExists().execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable(eventOutboxTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("event_id", "text", (column) => column.notNull())
      .addColumn("event_name", "text", (column) => column.notNull())
      .addColumn("source_module", "text")
      .addColumn("payload_json", "text", (column) => column.notNull())
      .addColumn("emitted_at", "integer", (column) => column.notNull())
      .addColumn("correlation_id", "text")
      .addColumn("causation_id", "text")
      .addColumn("workflow_run_id", "text")
      .addColumn("subject_type", "text")
      .addColumn("subject_id", "text")
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("attempts", "integer", (column) => column.notNull())
      .addColumn("available_at", "integer", (column) => column.notNull())
      .addColumn("last_error", "text")
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(eventOutboxStatusIndexName)
      .ifNotExists()
      .on(eventOutboxTableName)
      .columns(["status", "available_at"])
      .execute();

    await db.schema
      .createTable(eventDeadLetterTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("outbox_id", "text", (column) => column.notNull())
      .addColumn("event_id", "text", (column) => column.notNull())
      .addColumn("attempts", "integer", (column) => column.notNull())
      .addColumn("reason", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(eventDeadLetterEventIndexName)
      .ifNotExists()
      .on(eventDeadLetterTableName)
      .column("event_id")
      .execute();

    await db.schema
      .createTable(notificationProviderTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("provider_key", "text", (column) => column.notNull())
      .addColumn("is_enabled", "integer", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(notificationProviderKeyIndexName)
      .ifNotExists()
      .unique()
      .on(notificationProviderTableName)
      .column("provider_key")
      .execute();

    await db.schema
      .createTable(notificationTemplateTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("template_key", "text", (column) => column.notNull())
      .addColumn("channel", "text", (column) => column.notNull())
      .addColumn("provider_key", "text", (column) => column.notNull())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("subject", "text")
      .execute();

    await db.schema
      .createIndex(notificationTemplateKeyIndexName)
      .ifNotExists()
      .unique()
      .on(notificationTemplateTableName)
      .columns(["template_key", "channel"])
      .execute();

    await db.schema
      .createTable(notificationDispatchTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("idempotency_key", "text", (column) => column.notNull())
      .addColumn("template_id", "text", (column) => column.notNull())
      .addColumn("channel", "text", (column) => column.notNull())
      .addColumn("recipient_type", "text", (column) => column.notNull())
      .addColumn("recipient_address", "text", (column) => column.notNull())
      .addColumn("provider_key", "text", (column) => column.notNull())
      .addColumn("provider_message_id", "text")
      .addColumn("payload_json", "text", (column) => column.notNull())
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("attempts", "integer", (column) => column.notNull())
      .addColumn("correlation_id", "text", (column) => column.notNull())
      .addColumn("causation_id", "text")
      .addColumn("workflow_run_id", "text")
      .addColumn("last_error", "text")
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .addColumn("delivered_at", "integer")
      .execute();

    await db.schema
      .createIndex(notificationDispatchIdempotencyIndexName)
      .ifNotExists()
      .unique()
      .on(notificationDispatchTableName)
      .column("idempotency_key")
      .execute();
  },
};
