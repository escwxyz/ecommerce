import { describe, expect, it } from "bun:test";

import { COMMERCE_EVENTS_OUTBOX_TOPIC } from "@ecommerce/core";

import { routeCommerceServerQueueBatch } from "../queue-routing";

const createQueueMessage = (body: unknown): Message<unknown> =>
  ({
    ack: () => undefined,
    body,
    retry: () => undefined,
  }) as Message<unknown>;

describe("commerce server queue routing", () => {
  it("routes each queue message independently and treats null or primitive bodies as commerce messages", async () => {
    const routedCommerceBodies: unknown[] = [];
    const routedNotificationBodies: unknown[] = [];
    const notificationBody = {
      id: "notification_dispatch_1",
      kind: "dispatch" as const,
    };
    const commerceBody = {
      correlationId: "correlation_1",
      id: "outbox_1",
      idempotencyKey: "event_1",
      payload: {},
      queueName: COMMERCE_EVENTS_OUTBOX_TOPIC,
      type: "store.settings-updated",
    };
    const batch = {
      messages: [
        createQueueMessage(notificationBody),
        createQueueMessage(null),
        createQueueMessage("primitive"),
        createQueueMessage(commerceBody),
      ],
    } as MessageBatch<unknown>;

    await routeCommerceServerQueueBatch(batch, {
      processCommerceEventQueue: async (commerceBatch) => {
        routedCommerceBodies.push(
          ...commerceBatch.messages.map((message) => message.body)
        );
      },
      processNotificationEventQueue: async (notificationBatch) => {
        routedNotificationBodies.push(
          ...notificationBatch.messages.map((message) => message.body)
        );
      },
    });

    expect(routedNotificationBodies).toEqual([notificationBody]);
    expect(routedCommerceBodies).toEqual([null, "primitive", commerceBody]);
  });
});
