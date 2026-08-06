import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import type {
  EventOutboxRecord,
  NotificationDispatchRecord,
  NotificationEventRepository,
} from "../domain";
import { createInMemoryNotificationEventRepository } from "../repositories";

const createOutboxRecord = (): EventOutboxRecord => {
  const now = new Date("2026-06-07T12:00:00.000Z");

  return {
    attempts: 0,
    availableAt: now,
    createdAt: now,
    envelope: {
      correlationId: "corr_repo_1",
      emittedAt: now,
      id: "evt_repo_1",
      name: "order.placed",
      payload: { orderId: "order_1" },
      sourceModule: "order",
      workflowRunId: "wf_repo_1",
    },
    eventId: "evt_repo_1",
    id: "evt_repo_1",
    status: "pending",
    updatedAt: now,
  };
};

const createDispatchRecord = (): NotificationDispatchRecord => {
  const now = new Date("2026-06-07T12:00:00.000Z");

  return {
    attempts: 1,
    channel: "email",
    correlationId: "corr_repo_2",
    createdAt: now,
    id: "ndsp_repo_1",
    idempotencyKey: "notify_repo_1",
    payload: { orderId: "order_1" },
    providerKey: "email",
    recipient: {
      address: "ada@example.com",
      type: "email",
    },
    status: "queued",
    templateId: "ntpl_repo_1",
    updatedAt: now,
  };
};

const runNotificationEventRepositoryContract = (
  name: string,
  createRepository: () => NotificationEventRepository
) => {
  describe(name, () => {
    it("persists event outbox and dead-letter records", async () => {
      const repository = createRepository();
      const outbox = createOutboxRecord();

      await Effect.runPromise(repository.saveOutbox(outbox));
      await Effect.runPromise(
        repository.saveDeadLetter({
          attempts: 3,
          createdAt: new Date("2026-06-07T12:05:00.000Z"),
          eventId: outbox.eventId,
          id: `${outbox.id}:dead-letter`,
          outboxId: outbox.id,
          reason: "subscriber unavailable",
        })
      );

      await expect(
        Effect.runPromise(repository.findOutboxById(outbox.id))
      ).resolves.toEqual(outbox);
      await expect(
        Effect.runPromise(repository.listDeadLetters)
      ).resolves.toMatchObject([
        {
          attempts: 3,
          eventId: "evt_repo_1",
          reason: "subscriber unavailable",
        },
      ]);
    });

    it("lists pending outbox records due for delivery", async () => {
      const repository = createRepository();
      const now = new Date("2026-06-07T12:00:00.000Z");
      const pending = createOutboxRecord();
      const retrying = {
        ...createOutboxRecord(),
        eventId: "evt_repo_2",
        id: "evt_repo_2",
        status: "retrying" as const,
      };
      const future = {
        ...createOutboxRecord(),
        availableAt: new Date("2026-06-07T12:05:00.000Z"),
        eventId: "evt_repo_3",
        id: "evt_repo_3",
      };
      const dispatched = {
        ...createOutboxRecord(),
        eventId: "evt_repo_4",
        id: "evt_repo_4",
        status: "dispatched" as const,
      };

      await Effect.runPromise(repository.saveOutbox(future));
      await Effect.runPromise(repository.saveOutbox(dispatched));
      await Effect.runPromise(repository.saveOutbox(retrying));
      await Effect.runPromise(repository.saveOutbox(pending));

      await expect(
        Effect.runPromise(
          repository.listPendingOutbox({ availableAt: now, limit: 10 })
        )
      ).resolves.toMatchObject([
        { id: "evt_repo_1", status: "pending" },
        { id: "evt_repo_2", status: "retrying" },
      ]);
    });

    it("persists templates, providers, and dispatch records", async () => {
      const repository = createRepository();
      const dispatch = createDispatchRecord();

      await Effect.runPromise(
        repository.saveProviderRecord({
          createdAt: new Date("2026-06-07T12:00:00.000Z"),
          id: "nprov_repo_1",
          isEnabled: true,
          providerKey: "email",
          updatedAt: new Date("2026-06-07T12:00:00.000Z"),
        })
      );
      await Effect.runPromise(
        repository.saveTemplate({
          channel: "email",
          id: "ntpl_repo_1",
          name: "Order placed",
          providerKey: "email",
          templateKey: "order.placed",
        })
      );
      await Effect.runPromise(repository.saveDispatch(dispatch));

      await expect(
        Effect.runPromise(
          repository.findTemplateByKey({
            channel: "email",
            templateKey: "order.placed",
          })
        )
      ).resolves.toMatchObject({
        id: "ntpl_repo_1",
        providerKey: "email",
      });
      await expect(
        Effect.runPromise(
          repository.findDispatchByIdempotencyKey("notify_repo_1")
        )
      ).resolves.toEqual(dispatch);
      await expect(
        Effect.runPromise(repository.listDispatches)
      ).resolves.toEqual([dispatch]);
    });
  });
};

runNotificationEventRepositoryContract(
  "in-memory notification-event repository",
  () => createInMemoryNotificationEventRepository()
);
