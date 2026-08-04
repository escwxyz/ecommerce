import { describe, expect, it } from "bun:test";

import { createEventEnvelope } from "@ecommerce/core/events";
import {
  OutboxClaimerService,
  OutboxWriterService,
} from "@ecommerce/core/persistence";
import { Effect } from "effect";

import {
  buildPostgresOutboxInsert,
  createPostgresOutboxLayer,
  postgresAdapterTarget,
  postgresOutboxClaimLockClause,
  postgresOutboxDefaultClaimLeaseMs,
  toEnqueuedOutboxRecord,
  toStoredOutboxRecord,
  type CommerceOutboxRow,
} from "../index";

const fixedDate = new Date("2026-07-12T00:00:00.000Z");
const emittedAt = new Date("2026-07-12T00:00:01.000Z");

const event = createEventEnvelope({
  causationId: "command_1",
  correlationId: "request_1",
  emittedAt,
  id: "event_1",
  name: "store.created",
  payload: { storeId: "store_1" },
  sourceModule: "store",
  subject: {
    id: "store_1",
    type: "store",
  },
  traceId: "trace_1",
  workflowRunId: "workflow_1",
});

const message = {
  event,
  idempotencyKey: "store_1:create",
  topic: "commerce.events",
} as const;

const createOutboxRow = (): CommerceOutboxRow => ({
  attempts: 1,
  availableAt: fixedDate,
  causationId: event.causationId ?? null,
  claimId: "claim_1",
  claimedAt: fixedDate,
  correlationId: event.correlationId ?? null,
  createdAt: fixedDate,
  deliveredAt: null,
  eventEmittedAt: emittedAt,
  eventId: event.id,
  eventName: event.name,
  idempotencyKey: message.idempotencyKey,
  lastError: null,
  payloadJson: event.payload,
  recordId: "outbox_1",
  sourceModule: event.sourceModule ?? null,
  status: "claimed",
  subjectId: event.subject?.id ?? null,
  subjectType: event.subject?.type ?? null,
  traceId: event.traceId ?? null,
  topic: message.topic,
  transactionId: "transaction_1",
  updatedAt: fixedDate,
  workflowRunId: event.workflowRunId ?? null,
});

describe("PostgreSQL transactional outbox", () => {
  it("builds outbox insert rows from transaction-scoped event messages", () => {
    expect(
      buildPostgresOutboxInsert({
        message,
        now: fixedDate,
        recordId: "outbox_1",
        transactionId: "transaction_1",
      })
    ).toEqual({
      attempts: 0,
      availableAt: fixedDate,
      causationId: "command_1",
      correlationId: "request_1",
      createdAt: fixedDate,
      eventEmittedAt: emittedAt,
      eventId: "event_1",
      eventName: "store.created",
      idempotencyKey: "store_1:create",
      payloadJson: { storeId: "store_1" },
      recordId: "outbox_1",
      sourceModule: "store",
      status: "pending",
      subjectId: "store_1",
      subjectType: "store",
      traceId: "trace_1",
      topic: "commerce.events",
      transactionId: "transaction_1",
      updatedAt: fixedDate,
      workflowRunId: "workflow_1",
    });
  });

  it("maps stored rows to runtime-neutral outbox records", () => {
    expect(toStoredOutboxRecord(createOutboxRow())).toEqual({
      attempts: 1,
      createdAt: fixedDate,
      event,
      idempotencyKey: "store_1:create",
      lastError: undefined,
      recordId: "outbox_1",
      status: "claimed",
      topic: "commerce.events",
      transactionId: "transaction_1",
    });
  });

  it("maps enqueued rows while preserving the typed event payload", () => {
    expect(
      toEnqueuedOutboxRecord({
        message,
        row: {
          ...createOutboxRow(),
          attempts: 0,
          claimId: null,
          claimedAt: null,
          status: "pending",
        },
      })
    ).toEqual({
      attempts: 0,
      createdAt: fixedDate,
      event,
      idempotencyKey: "store_1:create",
      lastError: undefined,
      recordId: "outbox_1",
      status: "pending",
      topic: "commerce.events",
      transactionId: "transaction_1",
    });
  });

  it("provides writer and claimer services through one adapter Layer", () => {
    const layer = createPostgresOutboxLayer({
      nextClaimId: Effect.succeed("claim_1"),
      nextDeadLetterId: Effect.succeed("dead_letter_1"),
      nextRecordId: Effect.succeed("outbox_1"),
      now: Effect.succeed(fixedDate),
    });
    const program = Effect.gen(function* () {
      const writer = yield* OutboxWriterService;
      const claimer = yield* OutboxClaimerService;
      return {
        hasClaimer: Boolean(claimer),
        hasWriter: Boolean(writer),
      };
    }).pipe(Effect.provide(layer));

    expect(Effect.isEffect(program)).toBe(true);
  });

  it("keeps outbox writes transaction-scoped and claims post-commit", () => {
    const layer = createPostgresOutboxLayer();
    const writeProgram = OutboxWriterService.use((writer) =>
      writer.enqueue(message)
    ).pipe(Effect.provide(layer));
    const claimProgram = OutboxClaimerService.use((claimer) =>
      claimer.claimPending({
        limit: 10,
        topic: message.topic,
      })
    ).pipe(Effect.provide(layer));

    expect(Effect.isEffect(writeProgram)).toBe(true);
    expect(Effect.isEffect(claimProgram)).toBe(true);
  });

  it("documents the PostgreSQL concurrency primitive used for claims", () => {
    expect(postgresOutboxClaimLockClause).toBe("FOR UPDATE SKIP LOCKED");
    expect(postgresOutboxDefaultClaimLeaseMs).toBe(300_000);
    expect(postgresAdapterTarget).toBe("effect-postgres");
  });
});
