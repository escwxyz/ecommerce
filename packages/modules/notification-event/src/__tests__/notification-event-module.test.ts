import { describe, expect, it } from "bun:test";

import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Cause, Effect, Exit } from "effect";

import {
  NotificationProviderUnavailable,
  NotificationTemplateNotFound,
} from "../domain";
import { notificationEventModule } from "../module";
import { createInMemoryNotificationEventRepository } from "../repositories";
import { createNotificationEventService } from "../services";
import { createFakeNotificationProvider } from "../testing";

describe("notification event module foundation", () => {
  it("publishes shared event envelopes without requiring notification providers", async () => {
    const service = createNotificationEventService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["evt_1"]),
      notificationProviders: [],
      repository: createInMemoryNotificationEventRepository(),
    });

    const published = await Effect.runPromise(
      service.publishEvent({
        correlationId: "corr_1",
        name: "order.placed",
        payload: { orderId: "order_1" },
        sourceModule: "order",
        workflowRunId: "wf_1",
      })
    );

    expect(published.envelope).toMatchObject({
      correlationId: "corr_1",
      id: "evt_1",
      name: "order.placed",
      payload: { orderId: "order_1" },
      sourceModule: "order",
      workflowRunId: "wf_1",
    });
    expect(published.outbox.status).toBe("pending");
  });

  it("reuses a caller-supplied event ID as the durable outbox identity", async () => {
    const repository = createInMemoryNotificationEventRepository();
    const service = createNotificationEventService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["evt_generated"]),
      notificationProviders: [],
      repository,
    });
    const input = {
      correlationId: "corr_replay",
      eventId: "evt_checkout_completed_workflow_1",
      name: "checkout.completed",
      payload: { cartId: "cart_1" },
      sourceModule: "checkout",
      workflowRunId: "workflow_1",
    };

    const first = await Effect.runPromise(service.publishEvent(input));
    const replay = await Effect.runPromise(service.publishEvent(input));
    const pending = await Effect.runPromise(
      repository.listPendingOutbox({
        availableAt: new Date("2026-01-01T00:00:00.000Z"),
        limit: 10,
      })
    );

    expect(first.outbox.id).toBe(input.eventId);
    expect(replay.outbox.id).toBe(input.eventId);
    expect(pending).toMatchObject([{ id: input.eventId }]);
    expect(pending).toHaveLength(1);
  });

  it("moves exhausted event delivery attempts to a dead-letter record", async () => {
    const service = createNotificationEventService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["evt_2"]),
      notificationProviders: [],
      repository: createInMemoryNotificationEventRepository(),
    });
    const published = await Effect.runPromise(
      service.publishEvent({
        correlationId: "corr_2",
        name: "customer.created",
        payload: { customerId: "cust_1" },
        sourceModule: "customer",
      })
    );

    const failed = await Effect.runPromise(
      service.recordEventDeliveryFailure({
        outboxId: published.outbox.id,
        reason: "subscriber unavailable",
        retryPolicy: { maxAttempts: 1 },
      })
    );
    const deadLetters = await Effect.runPromise(service.listDeadLetters);

    expect(failed.status).toBe("dead-lettered");
    expect(deadLetters).toMatchObject([
      {
        attempts: 1,
        eventId: "evt_2",
        reason: "subscriber unavailable",
      },
    ]);
  });

  it("dispatches notifications through a fake provider with retry metadata", async () => {
    const provider = createFakeNotificationProvider("email");
    const service = createNotificationEventService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["ndsp_1"]),
      notificationProviders: [provider],
      repository: createInMemoryNotificationEventRepository(),
    });

    await Effect.runPromise(
      service.upsertNotificationTemplate({
        channel: "email",
        id: "ntpl_1",
        name: "Order placed",
        providerKey: "email",
        subject: "Order received",
        templateKey: "order.placed",
      })
    );

    const dispatch = await Effect.runPromise(
      service.dispatchNotification({
        channel: "email",
        correlationId: "corr_3",
        idempotencyKey: "notify_order_1",
        payload: { orderId: "order_1" },
        recipient: { address: "ada@example.com", type: "email" },
        templateKey: "order.placed",
      })
    );
    const duplicate = await Effect.runPromise(
      service.dispatchNotification({
        channel: "email",
        correlationId: "corr_3",
        idempotencyKey: "notify_order_1",
        payload: { orderId: "order_1" },
        recipient: { address: "ada@example.com", type: "email" },
        templateKey: "order.placed",
      })
    );

    expect(dispatch).toMatchObject({
      attempts: 1,
      id: "ndsp_1",
      providerKey: "email",
      status: "delivered",
    });
    expect(provider.deliveries).toHaveLength(1);
    expect(duplicate).toMatchObject({ id: "ndsp_1" });
  });

  it("returns typed failures for missing templates and providers", async () => {
    const service = createNotificationEventService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["nprov_1"]),
      notificationProviders: [createFakeNotificationProvider("email")],
      repository: createInMemoryNotificationEventRepository(),
    });

    const missingTemplate = await Effect.runPromiseExit(
      service.dispatchNotification({
        channel: "email",
        correlationId: "corr_missing_template",
        idempotencyKey: "notify_missing_template",
        payload: {},
        recipient: { address: "ada@example.com", type: "email" },
        templateKey: "missing",
      })
    );
    const missingProvider = await Effect.runPromiseExit(
      service.registerNotificationProvider("sms")
    );

    expect(extractFailureErrors(missingTemplate)).toContainEqual(
      expect.any(NotificationTemplateNotFound)
    );
    expect(extractFailureErrors(missingProvider)).toContainEqual(
      expect.any(NotificationProviderUnavailable)
    );
  });

  it("declares separable module contributions without legacy API fragments", () => {
    expect(notificationEventModule.key).toBe("notification-event");
    expect(notificationEventModule.contributions?.eventTypes).toContain(
      "notification.dispatch-requested"
    );
    expect(notificationEventModule.contributions?.apiFragments).toEqual([]);
    expect(notificationEventModule.schema?.tables).toEqual([
      "event_outbox",
      "event_dead_letter",
      "notification_template",
      "notification_dispatch",
      "notification_provider",
    ]);
  });
});

const extractFailureErrors = (exit: Exit.Exit<unknown, unknown>) => {
  if (!Exit.isFailure(exit)) {
    return [];
  }

  return exit.cause.reasons
    .filter(Cause.isFailReason)
    .map((reason) => reason.error);
};
