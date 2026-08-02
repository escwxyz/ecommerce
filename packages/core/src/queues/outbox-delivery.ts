import { Effect, Result, Schema } from "effect";

import { OutboxClaimerService } from "../persistence/index";
import type {
  OutboxPersistenceFailure,
  OutboxRecord,
} from "../persistence/index";
import { QueuePublisherService } from "../services/index";
import type { CommerceQueueMessage } from "./index";

/** Options for one bounded post-commit outbox delivery cycle. */
export interface OutboxDeliveryBatchOptions {
  readonly limit: number;
  readonly topic: string;
}

/** Typed queue-boundary failure persisted against an outbox claim. */
export class OutboxQueuePublishFailure extends Schema.TaggedErrorClass<OutboxQueuePublishFailure>()(
  "OutboxQueuePublishFailure",
  {
    message: Schema.NonEmptyString,
    recordId: Schema.NonEmptyString,
    topic: Schema.NonEmptyString,
  }
) {}

/** Observable delivery result for one claimed outbox record. */
export type OutboxDeliveryRecordResult =
  | {
      readonly messageId: string;
      readonly recordId: string;
      readonly status: "delivered";
    }
  | {
      readonly failure: OutboxQueuePublishFailure;
      readonly recordId: string;
      readonly status: "failed";
    };

/** Summary returned by one bounded outbox delivery cycle. */
export interface OutboxDeliveryBatchReport {
  readonly claimId: string;
  readonly claimed: number;
  readonly claimedAt: Date;
  readonly delivered: number;
  readonly failed: number;
  readonly results: readonly OutboxDeliveryRecordResult[];
}

/**
 * Maps one durable outbox record to a stable at-least-once queue envelope.
 *
 * The outbox record id is the queue message id and the domain idempotency key
 * is preserved, so replay after a publish/ack interruption produces a message
 * consumers can safely deduplicate.
 */
export const outboxRecordToQueueMessage = (
  record: OutboxRecord
): CommerceQueueMessage => ({
  causationId: record.event.causationId,
  correlationId: record.event.correlationId ?? record.event.id,
  id: record.recordId,
  idempotencyKey: record.idempotencyKey,
  payload: record.event.payload,
  queueName: record.topic,
  subject: record.event.subject,
  traceId: record.event.traceId,
  type: record.event.name,
  workflowRunId: record.event.workflowRunId,
});

const toQueuePublishFailure = (
  record: OutboxRecord
): OutboxQueuePublishFailure =>
  new OutboxQueuePublishFailure({
    message: `Failed to publish outbox record ${record.recordId}.`,
    recordId: record.recordId,
    topic: record.topic,
  });

const deliverOutboxRecord = (
  record: OutboxRecord
): Effect.Effect<
  OutboxDeliveryRecordResult,
  OutboxPersistenceFailure,
  OutboxClaimerService | QueuePublisherService
> =>
  Effect.gen(function* deliverOutboxRecordEffect() {
    const claimer = yield* OutboxClaimerService;
    const publisher = yield* QueuePublisherService;
    const message = outboxRecordToQueueMessage(record);
    const publishResult = yield* Effect.result(
      Effect.tryPromise({
        catch: () => toQueuePublishFailure(record),
        try: () => publisher.publish(message),
      })
    );

    return yield* Result.match(publishResult, {
      onFailure: (failure) =>
        claimer
          .markFailed({
            reason: failure.message,
            recordId: record.recordId,
          })
          .pipe(
            Effect.as({
              failure,
              recordId: record.recordId,
              status: "failed" as const,
            })
          ),
      onSuccess: (published) =>
        claimer.markDelivered(record.recordId).pipe(
          Effect.as({
            messageId: published.messageId,
            recordId: record.recordId,
            status: "delivered" as const,
          })
        ),
    });
  }).pipe(
    Effect.withSpan("commerce.outbox.deliver", {
      attributes: {
        "commerce.outbox.record_id": record.recordId,
        "commerce.outbox.topic": record.topic,
      },
    })
  );

/**
 * Claims committed outbox records and delivers them through the configured
 * runtime-neutral queue publisher.
 *
 * Queue rejection is converted into a persisted failed record and reported as
 * data. Claiming or acknowledgement persistence failures remain typed Effect
 * failures so the runtime can retry the delivery cycle.
 */
export const deliverOutboxBatch = ({
  limit,
  topic,
}: OutboxDeliveryBatchOptions): Effect.Effect<
  OutboxDeliveryBatchReport,
  OutboxPersistenceFailure,
  OutboxClaimerService | QueuePublisherService
> =>
  Effect.gen(function* deliverOutboxBatchEffect() {
    const claimer = yield* OutboxClaimerService;
    const claim = yield* claimer.claimPending({ limit, topic });
    const results = yield* Effect.all(
      claim.records.map((record) => deliverOutboxRecord(record))
    );
    let delivered = 0;
    let failed = 0;

    for (const result of results) {
      if (result.status === "delivered") {
        delivered += 1;
      } else {
        failed += 1;
      }
    }

    return {
      claimId: claim.claimId,
      claimed: claim.records.length,
      claimedAt: claim.claimedAt,
      delivered,
      failed,
      results,
    };
  }).pipe(
    Effect.withSpan("commerce.outbox.deliver_batch", {
      attributes: {
        "commerce.outbox.topic": topic,
      },
    })
  );
