import { describe, expect, it } from "bun:test";

import { Effect, Layer } from "effect";

import { createEventEnvelope } from "../../events/index";
import {
  OutboxClaimerService,
  outboxClaimerLayer,
} from "../../persistence/index";
import { queuePublisherLayer } from "../../services/index";
import { deliverOutboxBatch, type CommerceQueueMessage } from "../index";

const claimedAt = new Date("2026-07-26T12:00:00.000Z");
const createdAt = new Date("2026-07-26T11:59:00.000Z");

const claimedRecord = {
  attempts: 1,
  createdAt,
  event: createEventEnvelope({
    causationId: "command_store_create",
    correlationId: "request_store_create",
    emittedAt: createdAt,
    id: "event_store_created",
    name: "store.created",
    payload: { storeId: "store_1" },
    sourceModule: "store",
    subject: {
      id: "store_1",
      type: "store",
    },
    traceId: "trace_store_create",
    workflowRunId: "workflow_store_create",
  }),
  idempotencyKey: "store:store_1:create",
  recordId: "outbox_store_created",
  status: "claimed",
  topic: "commerce-events",
  transactionId: "transaction_store_create",
} as const;

const createClaimerLayer = ({
  delivered,
  failed,
}: {
  readonly delivered: string[];
  readonly failed: Array<{
    readonly reason: string;
    readonly recordId: string;
  }>;
}) =>
  outboxClaimerLayer(
    OutboxClaimerService.of({
      claimPending: () =>
        Effect.succeed({
          claimedAt,
          claimId: "claim_store_created",
          records: [claimedRecord],
        }),
      markDelivered: (recordId) =>
        Effect.sync(() => {
          delivered.push(recordId);
        }),
      markFailed: (failure) =>
        Effect.sync(() => {
          failed.push(failure);
        }),
    })
  );

describe("transactional outbox queue delivery", () => {
  it("claims committed records, publishes stable queue metadata, then acknowledges delivery", async () => {
    const delivered: string[] = [];
    const failed: Array<{
      readonly reason: string;
      readonly recordId: string;
    }> = [];
    const published: CommerceQueueMessage[] = [];
    const layer = Layer.merge(
      createClaimerLayer({ delivered, failed }),
      queuePublisherLayer({
        publish: async (message) => {
          published.push(message);
          return {
            messageId: message.id,
            queuedAt: claimedAt,
          };
        },
      })
    );
    const report = await Effect.runPromise(
      deliverOutboxBatch({
        limit: 10,
        topic: "commerce-events",
      }).pipe(Effect.provide(layer))
    );

    expect(report).toMatchObject({
      claimId: "claim_store_created",
      delivered: 1,
      failed: 0,
    });
    expect(published).toEqual([
      {
        causationId: "command_store_create",
        correlationId: "request_store_create",
        id: "outbox_store_created",
        idempotencyKey: "store:store_1:create",
        payload: { storeId: "store_1" },
        queueName: "commerce-events",
        subject: {
          id: "store_1",
          type: "store",
        },
        traceId: "trace_store_create",
        type: "store.created",
        workflowRunId: "workflow_store_create",
      },
    ]);
    expect(delivered).toEqual(["outbox_store_created"]);
    expect(failed).toEqual([]);
  });

  it("persists queue rejection without falsely acknowledging the outbox record", async () => {
    const delivered: string[] = [];
    const failed: Array<{
      readonly reason: string;
      readonly recordId: string;
    }> = [];
    const layer = Layer.merge(
      createClaimerLayer({ delivered, failed }),
      queuePublisherLayer({
        publish: async () => {
          throw new Error("queue unavailable");
        },
      })
    );
    const report = await Effect.runPromise(
      deliverOutboxBatch({
        limit: 10,
        topic: "commerce-events",
      }).pipe(Effect.provide(layer))
    );

    expect(report).toMatchObject({
      delivered: 0,
      failed: 1,
      results: [
        {
          failure: {
            _tag: "OutboxQueuePublishFailure",
            recordId: "outbox_store_created",
            topic: "commerce-events",
          },
          recordId: "outbox_store_created",
          status: "failed",
        },
      ],
    });
    expect(delivered).toEqual([]);
    expect(failed).toEqual([
      {
        reason: "Failed to publish outbox record outbox_store_created.",
        recordId: "outbox_store_created",
      },
    ]);
  });
});
