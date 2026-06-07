import { describe, expect, it } from "bun:test";

import { defineQueueMessage } from "./index";
import type { CommerceQueuePublisher } from "./index";

describe("commerce queue contracts", () => {
  it("publishes messages with stable identity, correlation, and retry metadata", async () => {
    const published: unknown[] = [];
    const publisher: CommerceQueuePublisher = {
      publish: async (message) => {
        published.push(message);
        return {
          messageId: message.id,
          queuedAt: new Date("2026-06-06T00:00:00.000Z"),
        };
      },
    };

    const message = defineQueueMessage({
      causationId: "evt_checkout_started",
      correlationId: "corr_queue_1",
      id: "msg_checkout_1",
      idempotencyKey: "checkout:cart_1",
      payload: {
        cartId: "cart_1",
      },
      queueName: "commerce-work",
      subject: {
        id: "cart_1",
        type: "cart",
      },
      type: "checkout.reserve-inventory",
      workflowRunId: "run_checkout_1",
    });

    const result = await publisher.publish(message, {
      delaySeconds: 5,
    });

    expect(result).toEqual({
      messageId: "msg_checkout_1",
      queuedAt: new Date("2026-06-06T00:00:00.000Z"),
    });
    expect(published).toEqual([message]);
  });
});
