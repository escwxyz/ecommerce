import {
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  EventDeadLetterRecordSchema,
  EventOutboxRecordSchema,
  NotificationDispatchRecordSchema,
  NotificationEventRepositoryService,
  NotificationProviderRecordSchema,
  NotificationTemplateSchema,
} from "@ecommerce/notification-event";
import type {
  EventDeadLetterRecord,
  EventOutboxRecord,
  NotificationChannel,
  NotificationDispatchRecord,
  NotificationEventExpectedError,
  NotificationEventRepository,
  NotificationProviderRecord,
  NotificationTemplate,
} from "@ecommerce/notification-event";
import { desc, eq } from "drizzle-orm";
import { Effect, Layer, Option, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import type { SqlError } from "effect/unstable/sql/SqlError";

import {
  CurrentPostgresTransactionService,
  PostgresDrizzleService,
} from "../../postgres-drizzle";
import type {
  PostgresDrizzleDatabase,
  PostgresDrizzleService as PostgresDrizzleServiceShape,
  PostgresDrizzleTransaction,
} from "../../postgres-drizzle";
import {
  EventDeadLetterPostgresInsertSchema,
  EventDeadLetterPostgresRowSchema,
  EventOutboxPostgresInsertSchema,
  EventOutboxPostgresRowSchema,
  NotificationDispatchPostgresInsertSchema,
  NotificationDispatchPostgresRowSchema,
  NotificationProviderPostgresInsertSchema,
  NotificationProviderPostgresRowSchema,
  NotificationTemplatePostgresInsertSchema,
  NotificationTemplatePostgresRowSchema,
  postgresEventDeadLetter,
  postgresEventOutbox,
  postgresNotificationDispatch,
  postgresNotificationProvider,
  postgresNotificationTemplate,
} from "./schema";
import type {
  EventDeadLetterPostgresInsert,
  EventDeadLetterPostgresRow,
  EventOutboxPostgresInsert,
  EventOutboxPostgresRow,
  NotificationDispatchPostgresInsert,
  NotificationDispatchPostgresRow,
  NotificationProviderPostgresInsert,
  NotificationProviderPostgresRow,
  NotificationTemplatePostgresInsert,
  NotificationTemplatePostgresRow,
} from "./schema";

type NotificationEventPostgresExecutor =
  | PostgresDrizzleDatabase
  | PostgresDrizzleTransaction;

const notificationEventRepositoryName = "NotificationEventRepository";

const toRepositoryUnavailable =
  (operation: "read" | "write") => (): RepositoryUnavailable =>
    new RepositoryUnavailable({
      adapter: "effect-postgres",
      operation,
      repository: notificationEventRepositoryName,
    });

const toRepositoryDecodeFailure = (
  entity:
    | "event-dead-letter"
    | "event-outbox"
    | "notification-dispatch"
    | "notification-provider"
    | "notification-template",
  operation: "read" | "write"
): RepositoryDecodeFailure =>
  new RepositoryDecodeFailure({
    entity,
    operation,
    repository: notificationEventRepositoryName,
  });

const getNotificationEventExecutor = (
  service: PostgresDrizzleServiceShape
): EffectValue<NotificationEventPostgresExecutor> =>
  Effect.map(
    Effect.serviceOption(CurrentPostgresTransactionService),
    Option.getOrElse(() => service.database)
  );

export const toEventOutboxPostgresInsert = (
  record: EventOutboxRecord
): EffectValue<EventOutboxPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(EventOutboxPostgresInsertSchema)({
    attempts: record.attempts,
    availableAt: record.availableAt,
    createdAt: record.createdAt,
    envelopeJson: record.envelope,
    eventId: record.eventId,
    id: record.id,
    lastError: record.lastError ?? null,
    status: record.status,
    updatedAt: record.updatedAt,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("event-outbox", "write"))
  );

export const toEventDeadLetterPostgresInsert = (
  record: EventDeadLetterRecord
): EffectValue<EventDeadLetterPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(EventDeadLetterPostgresInsertSchema)(record).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("event-dead-letter", "write")
    )
  );

export const toNotificationProviderPostgresInsert = (
  record: NotificationProviderRecord
): EffectValue<NotificationProviderPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(NotificationProviderPostgresInsertSchema)(
    record
  ).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("notification-provider", "write")
    )
  );

export const toNotificationTemplatePostgresInsert = (
  template: NotificationTemplate
): EffectValue<NotificationTemplatePostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(NotificationTemplatePostgresInsertSchema)({
    ...template,
    subject: template.subject ?? null,
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("notification-template", "write")
    )
  );

export const toNotificationDispatchPostgresInsert = (
  record: NotificationDispatchRecord
): EffectValue<NotificationDispatchPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(NotificationDispatchPostgresInsertSchema)({
    attempts: record.attempts,
    causationId: record.causationId ?? null,
    channel: record.channel,
    correlationId: record.correlationId,
    createdAt: record.createdAt,
    deliveredAt: record.deliveredAt,
    id: record.id,
    idempotencyKey: record.idempotencyKey,
    lastError: record.lastError ?? null,
    payloadJson: record.payload,
    providerKey: record.providerKey,
    providerMessageId: record.providerMessageId ?? null,
    recipientJson: record.recipient,
    status: record.status,
    templateId: record.templateId,
    updatedAt: record.updatedAt,
    workflowRunId: record.workflowRunId ?? null,
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("notification-dispatch", "write")
    )
  );

const toEventOutboxRecord = (
  row: EventOutboxPostgresRow
): EffectValue<EventOutboxRecord, NotificationEventExpectedError> =>
  Schema.decodeUnknownEffect(EventOutboxRecordSchema)({
    attempts: row.attempts,
    availableAt: row.availableAt,
    createdAt: row.createdAt,
    envelope: row.envelopeJson,
    eventId: row.eventId,
    id: row.id,
    lastError: row.lastError ?? undefined,
    status: row.status,
    updatedAt: row.updatedAt,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("event-outbox", "read"))
  );

const toEventDeadLetterRecord = (
  row: EventDeadLetterPostgresRow
): EffectValue<EventDeadLetterRecord, NotificationEventExpectedError> =>
  Schema.decodeUnknownEffect(EventDeadLetterRecordSchema)(row).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("event-dead-letter", "read")
    )
  );

const toNotificationProviderRecord = (
  row: NotificationProviderPostgresRow
): EffectValue<NotificationProviderRecord, NotificationEventExpectedError> =>
  Schema.decodeUnknownEffect(NotificationProviderRecordSchema)(row).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("notification-provider", "read")
    )
  );

const toNotificationTemplate = (
  row: NotificationTemplatePostgresRow
): EffectValue<NotificationTemplate, NotificationEventExpectedError> =>
  Schema.decodeUnknownEffect(NotificationTemplateSchema)({
    channel: row.channel,
    id: row.id,
    name: row.name,
    providerKey: row.providerKey,
    subject: row.subject ?? undefined,
    templateKey: row.templateKey,
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("notification-template", "read")
    )
  );

const toNotificationDispatchRecord = (
  row: NotificationDispatchPostgresRow
): EffectValue<NotificationDispatchRecord, NotificationEventExpectedError> =>
  Schema.decodeUnknownEffect(NotificationDispatchRecordSchema)({
    attempts: row.attempts,
    causationId: row.causationId ?? undefined,
    channel: row.channel,
    correlationId: row.correlationId,
    createdAt: row.createdAt,
    deliveredAt: row.deliveredAt ?? undefined,
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    lastError: row.lastError ?? undefined,
    payload: row.payloadJson,
    providerKey: row.providerKey,
    providerMessageId: row.providerMessageId ?? undefined,
    recipient: row.recipientJson,
    status: row.status,
    templateId: row.templateId,
    updatedAt: row.updatedAt,
    workflowRunId: row.workflowRunId ?? undefined,
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("notification-dispatch", "read")
    )
  );

const decodeEventOutboxRow = (
  row: unknown
): EffectValue<EventOutboxRecord, NotificationEventExpectedError> =>
  Schema.decodeUnknownEffect(EventOutboxPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("event-outbox", "read")),
    Effect.map((decoded) => decoded as EventOutboxPostgresRow),
    Effect.flatMap(toEventOutboxRecord)
  );

const decodeEventDeadLetterRow = (
  row: unknown
): EffectValue<EventDeadLetterRecord, NotificationEventExpectedError> =>
  Schema.decodeUnknownEffect(EventDeadLetterPostgresRowSchema)(row).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("event-dead-letter", "read")
    ),
    Effect.map((decoded) => decoded as EventDeadLetterPostgresRow),
    Effect.flatMap(toEventDeadLetterRecord)
  );

const decodeNotificationProviderRow = (
  row: unknown
): EffectValue<NotificationProviderRecord, NotificationEventExpectedError> =>
  Schema.decodeUnknownEffect(NotificationProviderPostgresRowSchema)(row).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("notification-provider", "read")
    ),
    Effect.map((decoded) => decoded as NotificationProviderPostgresRow),
    Effect.flatMap(toNotificationProviderRecord)
  );

const decodeNotificationTemplateRow = (
  row: unknown
): EffectValue<NotificationTemplate, NotificationEventExpectedError> =>
  Schema.decodeUnknownEffect(NotificationTemplatePostgresRowSchema)(row).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("notification-template", "read")
    ),
    Effect.map((decoded) => decoded as NotificationTemplatePostgresRow),
    Effect.flatMap(toNotificationTemplate)
  );

const decodeNotificationDispatchRow = (
  row: unknown
): EffectValue<NotificationDispatchRecord, NotificationEventExpectedError> =>
  Schema.decodeUnknownEffect(NotificationDispatchPostgresRowSchema)(row).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("notification-dispatch", "read")
    ),
    Effect.map((decoded) => decoded as NotificationDispatchPostgresRow),
    Effect.flatMap(toNotificationDispatchRecord)
  );

/** Creates the PostgreSQL-backed notification-event repository. */
export const createPostgresNotificationEventRepository = (
  service: PostgresDrizzleServiceShape
): NotificationEventRepository =>
  NotificationEventRepositoryService.of({
    findDispatchByIdempotencyKey: (idempotencyKey) =>
      Effect.gen(function* findDispatchByIdempotencyKeyEffect() {
        const executor = yield* getNotificationEventExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresNotificationDispatch)
          .where(
            eq(postgresNotificationDispatch.idempotencyKey, idempotencyKey)
          )
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeNotificationDispatchRow(row) : null;
      }),
    findOutboxById: (outboxId) =>
      Effect.gen(function* findOutboxByIdEffect() {
        const executor = yield* getNotificationEventExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresEventOutbox)
          .where(eq(postgresEventOutbox.id, outboxId))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeEventOutboxRow(row) : null;
      }),
    findTemplateByKey: ({
      channel,
      templateKey,
    }: {
      readonly channel: NotificationChannel;
      readonly templateKey: string;
    }) =>
      Effect.gen(function* findTemplateByKeyEffect() {
        const executor = yield* getNotificationEventExecutor(service);
        const rows = yield* executor
          .select()
          .from(postgresNotificationTemplate)
          .where(eq(postgresNotificationTemplate.templateKey, templateKey))
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));
        const row = rows.find((candidate) => candidate.channel === channel);

        return row ? yield* decodeNotificationTemplateRow(row) : null;
      }),
    listDeadLetters: Effect.gen(function* listDeadLettersEffect() {
      const executor = yield* getNotificationEventExecutor(service);
      const rows = yield* executor
        .select()
        .from(postgresEventDeadLetter)
        .orderBy(desc(postgresEventDeadLetter.createdAt))
        .pipe(Effect.mapError(toRepositoryUnavailable("read")));

      return yield* Effect.all(rows.map(decodeEventDeadLetterRow));
    }),
    listDispatches: Effect.gen(function* listDispatchesEffect() {
      const executor = yield* getNotificationEventExecutor(service);
      const rows = yield* executor
        .select()
        .from(postgresNotificationDispatch)
        .orderBy(
          desc(postgresNotificationDispatch.createdAt),
          desc(postgresNotificationDispatch.id)
        )
        .pipe(Effect.mapError(toRepositoryUnavailable("read")));

      return yield* Effect.all(rows.map(decodeNotificationDispatchRow));
    }),
    saveDeadLetter: (record) =>
      Effect.gen(function* saveDeadLetterEffect() {
        const executor = yield* getNotificationEventExecutor(service);
        const insert = yield* toEventDeadLetterPostgresInsert(record);
        const [row] = yield* executor
          .insert(postgresEventDeadLetter)
          .values(insert)
          .onConflictDoUpdate({
            set: {
              attempts: insert.attempts,
              createdAt: insert.createdAt,
              eventId: insert.eventId,
              outboxId: insert.outboxId,
              reason: insert.reason,
            },
            target: postgresEventDeadLetter.id,
          })
          .returning()
          .pipe(Effect.mapError(toRepositoryUnavailable("write")));

        return row ? yield* decodeEventDeadLetterRow(row) : record;
      }),
    saveDispatch: (record) =>
      Effect.gen(function* saveDispatchEffect() {
        const existing = yield* createPostgresNotificationEventRepository(
          service
        ).findDispatchByIdempotencyKey(record.idempotencyKey);

        if (existing && existing.id !== record.id) {
          return existing;
        }

        const executor = yield* getNotificationEventExecutor(service);
        const insert = yield* toNotificationDispatchPostgresInsert(record);
        const [row] = yield* executor
          .insert(postgresNotificationDispatch)
          .values(insert)
          .onConflictDoUpdate({
            set: {
              attempts: insert.attempts,
              causationId: insert.causationId,
              channel: insert.channel,
              correlationId: insert.correlationId,
              createdAt: insert.createdAt,
              deliveredAt: insert.deliveredAt,
              idempotencyKey: insert.idempotencyKey,
              lastError: insert.lastError,
              payloadJson: insert.payloadJson,
              providerKey: insert.providerKey,
              providerMessageId: insert.providerMessageId,
              recipientJson: insert.recipientJson,
              status: insert.status,
              templateId: insert.templateId,
              updatedAt: insert.updatedAt,
              workflowRunId: insert.workflowRunId,
            },
            target: postgresNotificationDispatch.id,
          })
          .returning()
          .pipe(Effect.mapError(toRepositoryUnavailable("write")));

        return row ? yield* decodeNotificationDispatchRow(row) : record;
      }),
    saveOutbox: (record) =>
      Effect.gen(function* saveOutboxEffect() {
        const executor = yield* getNotificationEventExecutor(service);
        const insert = yield* toEventOutboxPostgresInsert(record);
        const [row] = yield* executor
          .insert(postgresEventOutbox)
          .values(insert)
          .onConflictDoUpdate({
            set: {
              attempts: insert.attempts,
              availableAt: insert.availableAt,
              envelopeJson: insert.envelopeJson,
              eventId: insert.eventId,
              lastError: insert.lastError,
              status: insert.status,
              updatedAt: insert.updatedAt,
            },
            target: postgresEventOutbox.id,
          })
          .returning()
          .pipe(Effect.mapError(toRepositoryUnavailable("write")));

        return row ? yield* decodeEventOutboxRow(row) : record;
      }),
    saveProviderRecord: (record) =>
      Effect.gen(function* saveProviderRecordEffect() {
        const executor = yield* getNotificationEventExecutor(service);
        const insert = yield* toNotificationProviderPostgresInsert(record);
        const [row] = yield* executor
          .insert(postgresNotificationProvider)
          .values(insert)
          .onConflictDoUpdate({
            set: {
              createdAt: insert.createdAt,
              isEnabled: insert.isEnabled,
              providerKey: insert.providerKey,
              updatedAt: insert.updatedAt,
            },
            target: postgresNotificationProvider.id,
          })
          .returning()
          .pipe(Effect.mapError(toRepositoryUnavailable("write")));

        return row ? yield* decodeNotificationProviderRow(row) : record;
      }),
    saveTemplate: (template) =>
      Effect.gen(function* saveTemplateEffect() {
        const executor = yield* getNotificationEventExecutor(service);
        const insert = yield* toNotificationTemplatePostgresInsert(template);
        const [row] = yield* executor
          .insert(postgresNotificationTemplate)
          .values(insert)
          .onConflictDoUpdate({
            set: {
              channel: insert.channel,
              name: insert.name,
              providerKey: insert.providerKey,
              subject: insert.subject,
              templateKey: insert.templateKey,
            },
            target: postgresNotificationTemplate.id,
          })
          .returning()
          .pipe(Effect.mapError(toRepositoryUnavailable("write")));

        return row ? yield* decodeNotificationTemplateRow(row) : template;
      }),
  });

export const createPostgresNotificationEventRepositoryLayer = () =>
  Layer.effect(
    NotificationEventRepositoryService,
    PostgresDrizzleService.use((service) =>
      Effect.succeed(createPostgresNotificationEventRepository(service))
    )
  );

/** Production PostgreSQL notification-event repository Layer. */
export const PostgresNotificationEventRepositoryLayer =
  createPostgresNotificationEventRepositoryLayer();

/** Runs notification-event repository Effects inside a PostgreSQL transaction. */
export const withPostgresNotificationEventTransaction = <A, E, R>(
  effect: EffectValue<A, E, R>
): EffectValue<A, E | SqlError, R | PostgresDrizzleService> =>
  PostgresDrizzleService.use((service) =>
    service.withTransaction(() => effect)
  );
