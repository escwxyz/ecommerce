import {
  CurrentTransactionService,
  OutboxClaimerService,
  OutboxPersistenceFailure,
  OutboxWriterService,
} from "@ecommerce/core/persistence";
import type {
  OutboxClaim,
  OutboxEnqueueResult,
  OutboxMessage,
  OutboxRecord,
  OutboxStatus,
} from "@ecommerce/core/persistence";
import { and, eq, sql } from "drizzle-orm";
import { Effect, Layer, Option } from "effect";

import {
  CurrentPostgresTransactionService,
  PostgresDrizzleService,
} from "./postgres-drizzle";
import type {
  PostgresDrizzleDatabase,
  PostgresDrizzleService as PostgresDrizzleServiceShape,
  PostgresDrizzleTransaction,
} from "./postgres-drizzle";
import { commerceOutbox, commerceOutboxDeadLetter } from "./schema/index";
import type { CommerceOutboxRow } from "./schema/index";

/** SQL clause that makes PostgreSQL outbox claims safe for concurrent workers. */
export const postgresOutboxClaimLockClause = "FOR UPDATE SKIP LOCKED" as const;

/** Default time before a claimed outbox record is considered abandoned. */
export const postgresOutboxDefaultClaimLeaseMs = 5 * 60 * 1000;

/** Options for deterministic or production PostgreSQL outbox identifiers. */
export interface PostgresOutboxLayerOptions {
  readonly claimLeaseMs?: number;
  readonly now?: Effect.Effect<Date>;
  readonly nextClaimId?: Effect.Effect<string>;
  readonly nextDeadLetterId?: Effect.Effect<string>;
  readonly nextRecordId?: Effect.Effect<string>;
}

interface PostgresOutboxClaimRow extends Record<string, unknown> {
  readonly attempts: number;
  readonly causationId: string | null;
  readonly claimId: string | null;
  readonly claimedAt: Date | string | null;
  readonly correlationId: string | null;
  readonly createdAt: Date | string;
  readonly deliveredAt: Date | string | null;
  readonly eventEmittedAt: Date | string;
  readonly eventId: string;
  readonly eventName: string;
  readonly idempotencyKey: string;
  readonly lastError: string | null;
  readonly payloadJson: unknown;
  readonly recordId: string;
  readonly sourceModule: string | null;
  readonly status: string;
  readonly subjectId: string | null;
  readonly subjectType: string | null;
  readonly traceId: string | null;
  readonly topic: string;
  readonly transactionId: string;
  readonly workflowRunId: string | null;
}

type PostgresOutboxExecutor =
  | PostgresDrizzleDatabase
  | PostgresDrizzleTransaction;

const hasQueryRows = <TRow>(
  value: unknown
): value is {
  readonly rows: readonly TRow[];
} =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray(Reflect.get(value, "rows"));

const normalizeQueryRows = <TRow>(value: unknown): readonly TRow[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (hasQueryRows<TRow>(value)) {
    return value.rows;
  }

  return [];
};

const defaultIdentifier = (prefix: string) =>
  Effect.sync(() => `${prefix}_${crypto.randomUUID()}`);

const defaultNow = Effect.sync(() => new Date());

const getAbandonedClaimCutoff = ({
  claimLeaseMs,
  claimedAt,
}: {
  readonly claimLeaseMs: number;
  readonly claimedAt: Date;
}): Date => new Date(claimedAt.getTime() - claimLeaseMs);

const toPersistenceFailure =
  (operation: "claim" | "deliver" | "enqueue" | "fail", topic: string) =>
  (): OutboxPersistenceFailure =>
    new OutboxPersistenceFailure({
      operation,
      topic,
    });

const toDate = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

const isOutboxStatus = (value: string): value is OutboxStatus =>
  value === "pending" ||
  value === "claimed" ||
  value === "delivered" ||
  value === "failed";

const requireOutboxStatus = (value: string): OutboxStatus => {
  if (isOutboxStatus(value)) {
    return value;
  }

  throw new Error(`Unexpected outbox status "${value}".`);
};

export const toStoredOutboxRecord = (
  row: CommerceOutboxRow | PostgresOutboxClaimRow
): OutboxRecord => {
  const subject =
    row.subjectType && row.subjectId
      ? {
          id: row.subjectId,
          type: row.subjectType,
        }
      : undefined;
  const lastError = row.lastError ?? undefined;

  return {
    attempts: row.attempts,
    createdAt: toDate(row.createdAt),
    event: {
      causationId: row.causationId ?? undefined,
      correlationId: row.correlationId ?? undefined,
      emittedAt: toDate(row.eventEmittedAt),
      id: row.eventId,
      name: row.eventName,
      payload: row.payloadJson,
      sourceModule: row.sourceModule ?? undefined,
      subject,
      traceId: row.traceId ?? undefined,
      workflowRunId: row.workflowRunId ?? undefined,
    },
    idempotencyKey: row.idempotencyKey,
    lastError,
    recordId: row.recordId,
    status: requireOutboxStatus(row.status),
    topic: row.topic,
    transactionId: row.transactionId,
  };
};

export const toEnqueuedOutboxRecord = <EventName extends string, Payload>({
  message,
  row,
}: {
  readonly message: OutboxMessage<EventName, Payload>;
  readonly row: CommerceOutboxRow;
}): OutboxRecord<EventName, Payload> => ({
  attempts: row.attempts,
  createdAt: row.createdAt,
  event: message.event,
  idempotencyKey: row.idempotencyKey,
  lastError: row.lastError ?? undefined,
  recordId: row.recordId,
  status: requireOutboxStatus(row.status),
  topic: row.topic,
  transactionId: row.transactionId,
});

export const buildPostgresOutboxInsert = <EventName extends string, Payload>({
  message,
  now,
  recordId,
  transactionId,
}: {
  readonly message: OutboxMessage<EventName, Payload>;
  readonly now: Date;
  readonly recordId: string;
  readonly transactionId: string;
}) => ({
  attempts: 0,
  availableAt: now,
  causationId: message.event.causationId,
  correlationId: message.event.correlationId,
  createdAt: now,
  eventEmittedAt: message.event.emittedAt,
  eventId: message.event.id,
  eventName: message.event.name,
  idempotencyKey: message.idempotencyKey,
  payloadJson: message.event.payload,
  recordId,
  sourceModule: message.event.sourceModule,
  status: "pending",
  subjectId: message.event.subject?.id,
  subjectType: message.event.subject?.type,
  traceId: message.event.traceId,
  topic: message.topic,
  transactionId,
  updatedAt: now,
  workflowRunId: message.event.workflowRunId,
});

const getOutboxWriteExecutor = (
  service: PostgresDrizzleServiceShape
): Effect.Effect<PostgresOutboxExecutor> =>
  Effect.map(
    Effect.serviceOption(CurrentPostgresTransactionService),
    Option.getOrElse(() => service.database)
  );

const findOutboxByIdempotency = <EventName extends string, Payload>({
  executor,
  message,
}: {
  readonly executor: PostgresOutboxExecutor;
  readonly message: OutboxMessage<EventName, Payload>;
}) =>
  executor
    .select()
    .from(commerceOutbox)
    .where(
      and(
        eq(commerceOutbox.topic, message.topic),
        eq(commerceOutbox.idempotencyKey, message.idempotencyKey)
      )
    );

const enqueueOutboxMessage = <EventName extends string, Payload>({
  message,
  nextRecordId,
  now,
  service,
}: {
  readonly message: OutboxMessage<EventName, Payload>;
  readonly nextRecordId: Effect.Effect<string>;
  readonly now: Effect.Effect<Date>;
  readonly service: PostgresDrizzleServiceShape;
}): Effect.Effect<
  OutboxEnqueueResult<EventName, Payload>,
  OutboxPersistenceFailure,
  CurrentTransactionService
> =>
  Effect.gen(function* enqueueOutboxMessageGenerator() {
    const currentTransaction = yield* CurrentTransactionService;
    const executor = yield* getOutboxWriteExecutor(service);
    const createdAt = yield* now;
    const recordId = yield* nextRecordId;
    const insertedRows = yield* executor
      .insert(commerceOutbox)
      .values(
        buildPostgresOutboxInsert({
          message,
          now: createdAt,
          recordId,
          transactionId: currentTransaction.transactionId,
        })
      )
      .onConflictDoNothing({
        target: [commerceOutbox.topic, commerceOutbox.idempotencyKey],
      })
      .returning();

    const [inserted] = insertedRows;

    if (inserted) {
      return {
        record: toEnqueuedOutboxRecord({
          message,
          row: inserted,
        }),
      };
    }

    const existingRows = yield* findOutboxByIdempotency({
      executor,
      message,
    });
    const [existing] = existingRows;

    if (!existing) {
      return yield* Effect.fail(
        new OutboxPersistenceFailure({
          operation: "enqueue",
          topic: message.topic,
        })
      );
    }

    return {
      record: toEnqueuedOutboxRecord({
        message,
        row: existing,
      }),
    };
  }).pipe(Effect.mapError(toPersistenceFailure("enqueue", message.topic)));

const claimPendingOutboxRecords = ({
  claimLeaseMs,
  limit,
  nextClaimId,
  now,
  service,
  topic,
}: {
  readonly claimLeaseMs: number;
  readonly limit: number;
  readonly nextClaimId: Effect.Effect<string>;
  readonly now: Effect.Effect<Date>;
  readonly service: PostgresDrizzleServiceShape;
  readonly topic: string;
}): Effect.Effect<OutboxClaim, OutboxPersistenceFailure> =>
  Effect.gen(function* claimPendingOutboxRecordsGenerator() {
    const claimId = yield* nextClaimId;
    const claimedAt = yield* now;
    const abandonedClaimedBefore = getAbandonedClaimCutoff({
      claimLeaseMs,
      claimedAt,
    });
    const boundedLimit = Math.max(0, Math.floor(limit));

    if (boundedLimit === 0) {
      return {
        claimedAt,
        claimId,
        records: [],
      };
    }

    const result = yield* service.database.execute<PostgresOutboxClaimRow>(sql`
      WITH claimable AS (
        SELECT record_id
        FROM ${commerceOutbox}
        WHERE topic = ${topic}
          AND available_at <= ${claimedAt}
          AND (
            status = 'pending'
            OR (
              status = 'claimed'
              AND claimed_at IS NOT NULL
              AND claimed_at <= ${abandonedClaimedBefore}
            )
          )
        ORDER BY available_at ASC, created_at ASC, record_id ASC
        LIMIT ${boundedLimit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE ${commerceOutbox}
      SET status = 'claimed',
          claim_id = ${claimId},
          claimed_at = ${claimedAt},
          attempts = ${commerceOutbox.attempts} + 1,
          updated_at = ${claimedAt}
      FROM claimable
      WHERE ${commerceOutbox.recordId} = claimable.record_id
      RETURNING
        ${commerceOutbox.attempts} AS "attempts",
        ${commerceOutbox.causationId} AS "causationId",
        ${commerceOutbox.claimId} AS "claimId",
        ${commerceOutbox.claimedAt} AS "claimedAt",
        ${commerceOutbox.correlationId} AS "correlationId",
        ${commerceOutbox.createdAt} AS "createdAt",
        ${commerceOutbox.deliveredAt} AS "deliveredAt",
        ${commerceOutbox.eventEmittedAt} AS "eventEmittedAt",
        ${commerceOutbox.eventId} AS "eventId",
        ${commerceOutbox.eventName} AS "eventName",
        ${commerceOutbox.idempotencyKey} AS "idempotencyKey",
        ${commerceOutbox.lastError} AS "lastError",
        ${commerceOutbox.payloadJson} AS "payloadJson",
        ${commerceOutbox.recordId} AS "recordId",
        ${commerceOutbox.sourceModule} AS "sourceModule",
        ${commerceOutbox.status} AS "status",
        ${commerceOutbox.subjectId} AS "subjectId",
        ${commerceOutbox.subjectType} AS "subjectType",
        ${commerceOutbox.traceId} AS "traceId",
        ${commerceOutbox.topic} AS "topic",
        ${commerceOutbox.transactionId} AS "transactionId",
        ${commerceOutbox.workflowRunId} AS "workflowRunId"
    `);

    const rows = normalizeQueryRows<PostgresOutboxClaimRow>(result);
    const records = yield* Effect.all(
      rows.map((row) =>
        Effect.try({
          catch: toPersistenceFailure("claim", topic),
          try: () => toStoredOutboxRecord(row),
        })
      )
    );

    return {
      claimedAt,
      claimId,
      records,
    };
  }).pipe(Effect.mapError(toPersistenceFailure("claim", topic)));

const markOutboxDelivered = ({
  now,
  recordId,
  service,
}: {
  readonly now: Effect.Effect<Date>;
  readonly recordId: string;
  readonly service: PostgresDrizzleServiceShape;
}) =>
  Effect.gen(function* markOutboxDeliveredGenerator() {
    const deliveredAt = yield* now;
    yield* service.database
      .update(commerceOutbox)
      .set({
        deliveredAt,
        status: "delivered",
        updatedAt: deliveredAt,
      })
      .where(eq(commerceOutbox.recordId, recordId));
  }).pipe(Effect.mapError(toPersistenceFailure("deliver", "unknown")));

const markOutboxFailed = ({
  nextDeadLetterId,
  now,
  reason,
  recordId,
  service,
}: {
  readonly nextDeadLetterId: Effect.Effect<string>;
  readonly now: Effect.Effect<Date>;
  readonly reason: string;
  readonly recordId: string;
  readonly service: PostgresDrizzleServiceShape;
}) =>
  Effect.gen(function* markOutboxFailedGenerator() {
    const failedAt = yield* now;
    const deadLetterId = yield* nextDeadLetterId;
    const failedRows = yield* service.database
      .update(commerceOutbox)
      .set({
        lastError: reason,
        status: "failed",
        updatedAt: failedAt,
      })
      .where(eq(commerceOutbox.recordId, recordId))
      .returning();
    const [failed] = failedRows;

    if (!failed) {
      return;
    }

    yield* service.database.insert(commerceOutboxDeadLetter).values({
      attempts: failed.attempts,
      createdAt: failedAt,
      deadLetterId,
      eventId: failed.eventId,
      reason,
      recordId,
    });
  }).pipe(Effect.mapError(toPersistenceFailure("fail", "unknown")));

/** Creates the PostgreSQL transactional outbox writer and claiming Layer. */
export const createPostgresOutboxLayer = ({
  claimLeaseMs = postgresOutboxDefaultClaimLeaseMs,
  nextClaimId = defaultIdentifier("outbox_claim"),
  nextDeadLetterId = defaultIdentifier("outbox_dead_letter"),
  nextRecordId = defaultIdentifier("outbox"),
  now = defaultNow,
}: PostgresOutboxLayerOptions = {}) =>
  Layer.effect(
    OutboxWriterService,
    PostgresDrizzleService.use((service) =>
      Effect.succeed(
        OutboxWriterService.of({
          enqueue: (message) =>
            enqueueOutboxMessage({
              message,
              nextRecordId,
              now,
              service,
            }),
        })
      )
    )
  ).pipe(
    Layer.merge(
      Layer.effect(
        OutboxClaimerService,
        PostgresDrizzleService.use((service) =>
          Effect.succeed(
            OutboxClaimerService.of({
              claimPending: ({ limit, topic }) =>
                claimPendingOutboxRecords({
                  claimLeaseMs,
                  limit,
                  nextClaimId,
                  now,
                  service,
                  topic,
                }),
              markDelivered: (recordId) =>
                markOutboxDelivered({
                  now,
                  recordId,
                  service,
                }),
              markFailed: ({ reason, recordId }) =>
                markOutboxFailed({
                  nextDeadLetterId,
                  now,
                  reason,
                  recordId,
                  service,
                }),
            })
          )
        )
      )
    )
  );

/** PostgreSQL outbox Layer with production identifier defaults. */
export const PostgresOutboxLayer = createPostgresOutboxLayer();
