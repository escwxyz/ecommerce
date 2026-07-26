import { describe, expect, it } from "bun:test";

import {
  OutboxClaimerService,
  createEventEnvelope,
  deliverOutboxBatch,
  outboxClaimerLayer,
  type CommerceQueueMessage,
} from "@ecommerce/core";
import { Effect, Layer } from "effect";

import { createCloudflareQueuePublisherLayer } from "../queue";

const deliveredAt = new Date("2026-07-26T14:00:00.000Z");

describe("Cloudflare transactional outbox delivery", () => {
  it("preserves stable queue identity when an outbox claim is replayed", async () => {
    const delivered: string[] = [];
    const messages: unknown[] = [];
    const record = {
      attempts: 2,
      createdAt: new Date("2026-07-26T13:59:00.000Z"),
      event: createEventEnvelope({
        correlationId: "request_order_placed",
        emittedAt: new Date("2026-07-26T13:59:00.000Z"),
        id: "event_order_placed",
        name: "order.placed",
        payload: { orderId: "order_1" },
        sourceModule: "order",
        subject: {
          id: "order_1",
          type: "order",
        },
      }),
      idempotencyKey: "order:order_1:placed",
      recordId: "outbox_order_placed",
      status: "claimed",
      topic: "commerce-events",
      transactionId: "transaction_order_placed",
    } as const;
    const claimerLayer = outboxClaimerLayer(
      OutboxClaimerService.of({
        claimPending: () =>
          Effect.succeed({
            claimedAt: deliveredAt,
            claimId: "claim_order_placed",
            records: [record],
          }),
        markDelivered: (recordId) =>
          Effect.sync(() => {
            delivered.push(recordId);
          }),
        markFailed: () => Effect.void,
      })
    );
    const queue: Queue<CommerceQueueMessage> = {
      metrics: async () => ({
        backlogBytes: 0,
        backlogCount: messages.length,
      }),
      send: async (message) => {
        messages.push(message);
        return {
          metadata: {
            metrics: {
              backlogBytes: 0,
              backlogCount: messages.length,
            },
          },
        };
      },
      sendBatch: async (batch) => {
        for (const message of batch) {
          messages.push(message.body);
        }
        return {
          metadata: {
            metrics: {
              backlogBytes: 0,
              backlogCount: messages.length,
            },
          },
        };
      },
    };
    const queueLayer = createCloudflareQueuePublisherLayer({
      clock: {
        now: () => deliveredAt,
      },
      queue,
    });
    const layer = Layer.merge(claimerLayer, queueLayer);
    const delivery = deliverOutboxBatch({
      limit: 1,
      topic: "commerce-events",
    }).pipe(Effect.provide(layer));

    await Effect.runPromise(delivery);
    await Effect.runPromise(delivery);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual(messages[1]);
    expect(messages[0]).toMatchObject({
      id: "outbox_order_placed",
      idempotencyKey: "order:order_1:placed",
      queueName: "commerce-events",
      type: "order.placed",
    });
    expect(delivered).toEqual(["outbox_order_placed", "outbox_order_placed"]);
  });
});
