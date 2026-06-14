import type { Kysely } from "kysely";

import type {
  EventDeadLetterInsert,
  EventDeadLetterRecord,
  EventDeadLetterRow,
  EventOutboxInsert,
  EventOutboxRecord,
  EventOutboxRow,
  NotificationChannel,
  NotificationDispatchInsert,
  NotificationDispatchRecord,
  NotificationDispatchRow,
  NotificationEventDatabase,
  NotificationEventRepository,
  NotificationProviderInsert,
  NotificationProviderRecord,
  NotificationRecipient,
  NotificationTemplate,
  NotificationTemplateInsert,
  NotificationTemplateRow,
} from "../../domain";

export type NotificationEventD1Database = Kysely<NotificationEventDatabase>;

export interface CreateD1NotificationEventRepositoryOptions {
  readonly db: NotificationEventD1Database;
}

const parseJsonColumn = <Value>(value: string): Value => JSON.parse(value);
const toJsonColumn = (value: unknown): string => JSON.stringify(value);
const toDate = (timestamp: number): Date => new Date(timestamp);
const toTimestamp = (date: Date): number => date.getTime();

const toOutboxRecord = (row: EventOutboxRow): EventOutboxRecord => ({
  attempts: row.attempts,
  availableAt: toDate(row.available_at),
  createdAt: toDate(row.created_at),
  envelope: {
    causationId: row.causation_id ?? undefined,
    correlationId: row.correlation_id ?? undefined,
    emittedAt: toDate(row.emitted_at),
    id: row.event_id,
    name: row.event_name,
    payload: parseJsonColumn(row.payload_json),
    sourceModule: row.source_module ?? undefined,
    subject:
      row.subject_id && row.subject_type
        ? { id: row.subject_id, type: row.subject_type }
        : undefined,
    workflowRunId: row.workflow_run_id ?? undefined,
  },
  eventId: row.event_id,
  id: row.id,
  lastError: row.last_error ?? undefined,
  status: row.status as EventOutboxRecord["status"],
  updatedAt: toDate(row.updated_at),
});

const toOutboxInsert = (record: EventOutboxRecord): EventOutboxInsert => ({
  attempts: record.attempts,
  available_at: toTimestamp(record.availableAt),
  causation_id: record.envelope.causationId ?? null,
  correlation_id: record.envelope.correlationId ?? null,
  created_at: toTimestamp(record.createdAt),
  emitted_at: toTimestamp(record.envelope.emittedAt),
  event_id: record.eventId,
  event_name: record.envelope.name,
  id: record.id,
  last_error: record.lastError ?? null,
  payload_json: toJsonColumn(record.envelope.payload),
  source_module: record.envelope.sourceModule ?? null,
  status: record.status,
  subject_id: record.envelope.subject?.id ?? null,
  subject_type: record.envelope.subject?.type ?? null,
  updated_at: toTimestamp(record.updatedAt),
  workflow_run_id: record.envelope.workflowRunId ?? null,
});

const toDeadLetterRecord = (
  row: EventDeadLetterRow
): EventDeadLetterRecord => ({
  attempts: row.attempts,
  createdAt: toDate(row.created_at),
  eventId: row.event_id,
  id: row.id,
  outboxId: row.outbox_id,
  reason: row.reason,
});

const toDeadLetterInsert = (
  record: EventDeadLetterRecord
): EventDeadLetterInsert => ({
  attempts: record.attempts,
  created_at: toTimestamp(record.createdAt),
  event_id: record.eventId,
  id: record.id,
  outbox_id: record.outboxId,
  reason: record.reason,
});

const toTemplateRecord = (
  row: NotificationTemplateRow
): NotificationTemplate => ({
  channel: row.channel as NotificationChannel,
  id: row.id,
  name: row.name,
  providerKey: row.provider_key,
  subject: row.subject ?? undefined,
  templateKey: row.template_key,
});

const toTemplateInsert = (
  template: NotificationTemplate
): NotificationTemplateInsert => ({
  channel: template.channel,
  id: template.id,
  name: template.name,
  provider_key: template.providerKey,
  subject: template.subject ?? null,
  template_key: template.templateKey,
});

const toDispatchRecord = (
  row: NotificationDispatchRow
): NotificationDispatchRecord => ({
  attempts: row.attempts,
  causationId: row.causation_id ?? undefined,
  channel: row.channel as NotificationDispatchRecord["channel"],
  correlationId: row.correlation_id,
  createdAt: toDate(row.created_at),
  deliveredAt: row.delivered_at ? toDate(row.delivered_at) : undefined,
  id: row.id,
  idempotencyKey: row.idempotency_key,
  lastError: row.last_error ?? undefined,
  payload: parseJsonColumn(row.payload_json),
  providerKey: row.provider_key,
  providerMessageId: row.provider_message_id ?? undefined,
  recipient: {
    address: row.recipient_address,
    type: row.recipient_type,
  } satisfies NotificationRecipient,
  status: row.status as NotificationDispatchRecord["status"],
  templateId: row.template_id,
  updatedAt: toDate(row.updated_at),
  workflowRunId: row.workflow_run_id ?? undefined,
});

const toDispatchInsert = (
  record: NotificationDispatchRecord
): NotificationDispatchInsert => ({
  attempts: record.attempts,
  causation_id: record.causationId ?? null,
  channel: record.channel,
  correlation_id: record.correlationId,
  created_at: toTimestamp(record.createdAt),
  delivered_at: record.deliveredAt ? toTimestamp(record.deliveredAt) : null,
  id: record.id,
  idempotency_key: record.idempotencyKey,
  last_error: record.lastError ?? null,
  payload_json: toJsonColumn(record.payload),
  provider_key: record.providerKey,
  provider_message_id: record.providerMessageId ?? null,
  recipient_address: record.recipient.address,
  recipient_type: record.recipient.type,
  status: record.status,
  template_id: record.templateId,
  updated_at: toTimestamp(record.updatedAt),
  workflow_run_id: record.workflowRunId ?? null,
});

const toProviderInsert = (
  record: NotificationProviderRecord
): NotificationProviderInsert => ({
  created_at: toTimestamp(record.createdAt),
  id: record.id,
  is_enabled: record.isEnabled ? 1 : 0,
  provider_key: record.providerKey,
  updated_at: toTimestamp(record.updatedAt),
});

export const createD1NotificationEventRepository = ({
  db,
}: CreateD1NotificationEventRepositoryOptions): NotificationEventRepository => ({
  findDispatchByIdempotencyKey: async (idempotencyKey) => {
    const row = await db
      .selectFrom("notification_dispatch")
      .selectAll()
      .where("idempotency_key", "=", idempotencyKey)
      .executeTakeFirst();

    return row ? toDispatchRecord(row) : null;
  },
  findOutboxById: async (outboxId) => {
    const row = await db
      .selectFrom("event_outbox")
      .selectAll()
      .where("id", "=", outboxId)
      .executeTakeFirst();

    return row ? toOutboxRecord(row) : null;
  },
  findTemplateByKey: async ({ channel, templateKey }) => {
    const row = await db
      .selectFrom("notification_template")
      .selectAll()
      .where("channel", "=", channel)
      .where("template_key", "=", templateKey)
      .executeTakeFirst();

    return row ? toTemplateRecord(row) : null;
  },
  listDeadLetters: async () => {
    const rows = await db
      .selectFrom("event_dead_letter")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toDeadLetterRecord);
  },
  listDispatches: async () => {
    const rows = await db
      .selectFrom("notification_dispatch")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toDispatchRecord);
  },
  saveDeadLetter: async (record) => {
    const values = toDeadLetterInsert(record);

    await db
      .insertInto("event_dead_letter")
      .values(values)
      .onConflict((conflict) => conflict.column("id").doNothing())
      .execute();

    return record;
  },
  saveDispatch: async (record) => {
    const values = toDispatchInsert(record);

    await db
      .insertInto("notification_dispatch")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          attempts: values.attempts,
          delivered_at: values.delivered_at,
          last_error: values.last_error,
          provider_message_id: values.provider_message_id,
          status: values.status,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return record;
  },
  saveOutbox: async (record) => {
    const values = toOutboxInsert(record);

    await db
      .insertInto("event_outbox")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          attempts: values.attempts,
          available_at: values.available_at,
          last_error: values.last_error,
          status: values.status,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return record;
  },
  saveProviderRecord: async (record) => {
    const values = toProviderInsert(record);

    await db
      .insertInto("notification_provider")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("provider_key").doUpdateSet({
          is_enabled: values.is_enabled,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return record;
  },
  saveTemplate: async (template) => {
    const values = toTemplateInsert(template);

    await db
      .insertInto("notification_template")
      .values(values)
      .onConflict((conflict) =>
        conflict.columns(["template_key", "channel"]).doUpdateSet({
          name: values.name,
          provider_key: values.provider_key,
          subject: values.subject,
        })
      )
      .execute();

    return template;
  },
});
