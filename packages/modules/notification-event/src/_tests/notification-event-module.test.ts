import { describe, expect, it } from "bun:test";

import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { call } from "@orpc/server";

import { notificationEventContractRouter } from "../contracts";
import { notificationEventModule } from "../module";
import { createInMemoryNotificationEventRepository } from "../repositories";
import { createNotificationEventRouteFragment } from "../router";
import {
  createFakeNotificationProvider,
  createNotificationEventService,
} from "../services";

describe("notification event module foundation", () => {
  it("publishes shared event envelopes without requiring notification providers", async () => {
    const service = createNotificationEventService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["evt_1"]),
      repository: createInMemoryNotificationEventRepository(),
    });

    const published = await service.publishEvent({
      correlationId: "corr_1",
      name: "order.placed",
      payload: { orderId: "order_1" },
      sourceModule: "order",
      workflowRunId: "wf_1",
    });

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

  it("moves exhausted event delivery attempts to a dead-letter record", async () => {
    const service = createNotificationEventService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["evt_2"]),
      repository: createInMemoryNotificationEventRepository(),
    });
    const published = await service.publishEvent({
      correlationId: "corr_2",
      name: "customer.created",
      payload: { customerId: "cust_1" },
      sourceModule: "customer",
    });

    const failed = await service.recordEventDeliveryFailure({
      outboxId: published.outbox.id,
      reason: "subscriber unavailable",
      retryPolicy: { maxAttempts: 1 },
    });

    expect(failed.status).toBe("dead-lettered");
    await expect(service.listDeadLetters()).resolves.toMatchObject([
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

    await service.upsertNotificationTemplate({
      channel: "email",
      id: "ntpl_1",
      name: "Order placed",
      providerKey: "email",
      subject: "Order received",
      templateKey: "order.placed",
    });

    const dispatch = await service.dispatchNotification({
      channel: "email",
      correlationId: "corr_3",
      idempotencyKey: "notify_order_1",
      payload: { orderId: "order_1" },
      recipient: { address: "ada@example.com", type: "email" },
      templateKey: "order.placed",
    });

    expect(dispatch).toMatchObject({
      attempts: 1,
      id: "ndsp_1",
      providerKey: "email",
      status: "delivered",
    });
    expect(provider.deliveries).toHaveLength(1);
    await expect(
      service.dispatchNotification({
        channel: "email",
        correlationId: "corr_3",
        idempotencyKey: "notify_order_1",
        payload: { orderId: "order_1" },
        recipient: { address: "ada@example.com", type: "email" },
        templateKey: "order.placed",
      })
    ).resolves.toMatchObject({ id: "ndsp_1" });
  });

  it("declares separable module contributions and route metadata", async () => {
    expect(notificationEventModule.key).toBe("notification-event");
    expect(notificationEventModule.contributions?.eventTypes).toContain(
      "notification.dispatch-requested"
    );
    expect(notificationEventModule.schema?.tables).toEqual([
      "event_outbox",
      "event_dead_letter",
      "notification_template",
      "notification_dispatch",
      "notification_provider",
    ]);
    expect(
      notificationEventContractRouter.eventPublish["~orpc"].route.operationId
    ).toBe("eventPublish");

    const fragment = createNotificationEventRouteFragment({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["evt_route"]),
      repository: createInMemoryNotificationEventRepository(),
    });

    await expect(
      call(
        fragment.router.eventPublish,
        {
          correlationId: "corr_route",
          name: "store.updated",
          payload: {},
          sourceModule: "store",
        },
        {
          context: {
            auth: {},
            authorization: { evaluatePermission: () => ({ allowed: true }) },
            session: { user: { id: "user_1" } },
          },
        }
      )
    ).resolves.toMatchObject({
      envelope: { id: "evt_route", name: "store.updated" },
    });
  });
});
