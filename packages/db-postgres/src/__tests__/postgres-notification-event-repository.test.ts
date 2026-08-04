import { afterAll, describe, expect, it } from "bun:test";

import {
  createRepositoryContractHarness,
  type RepositoryContractCase,
} from "@ecommerce/core/testing";
import { NotificationEventRepositoryService } from "@ecommerce/notification-event";
import type {
  EventOutboxRecord,
  NotificationDispatchRecord,
  NotificationEventRepository,
} from "@ecommerce/notification-event";
import { Effect, Exit, Layer, ManagedRuntime, Redacted } from "effect";

import {
  createPostgresClientLayer,
  createPostgresDrizzleLayer,
  createPostgresNotificationEventRepositoryLayer,
  postgresAdapterTarget,
  resetPostgresDevelopmentDatabase,
  resetPostgresNotificationEventTables,
  runPostgresMigrations,
  withPostgresNotificationEventTransaction,
} from "../index";
import {
  createLocalPostgresRepositoryContractHarness,
  localPostgresContractUrlEnv,
} from "../repository-contract-harness";

const livePostgresUrl = process.env[localPostgresContractUrlEnv];
const describeLivePostgres = livePostgresUrl ? describe : describe.skip;
const now = new Date("2026-06-07T12:00:00.000Z");

const createOutboxRecord = (): EventOutboxRecord => ({
  attempts: 0,
  availableAt: now,
  createdAt: now,
  envelope: {
    correlationId: "corr_postgres_notification_1",
    emittedAt: now,
    id: "evt_postgres_notification_1",
    name: "order.placed",
    payload: { orderId: "ord_postgres_notification_1" },
    sourceModule: "order",
    workflowRunId: "wf_postgres_notification_1",
  },
  eventId: "evt_postgres_notification_1",
  id: "evt_postgres_notification_1",
  status: "pending",
  updatedAt: now,
});

const createDispatchRecord = (): NotificationDispatchRecord => ({
  attempts: 1,
  channel: "email",
  correlationId: "corr_postgres_notification_2",
  createdAt: now,
  id: "ndsp_postgres_notification_1",
  idempotencyKey: "notify_postgres_notification_1",
  payload: { orderId: "ord_postgres_notification_1" },
  providerKey: "email",
  recipient: {
    address: "ada@example.com",
    type: "email",
  },
  status: "queued",
  templateId: "ntpl_postgres_notification_1",
  updatedAt: now,
});

const notificationEventRepositoryContractCases: readonly RepositoryContractCase<NotificationEventRepository>[] =
  [
    {
      name: "persists outbox and dead-letter records",
      run: NotificationEventRepositoryService.use((repository) =>
        Effect.gen(function* persistsOutboxAndDeadLetterRecords() {
          const outbox = createOutboxRecord();
          yield* repository.saveOutbox(outbox);
          yield* repository.saveDeadLetter({
            attempts: 3,
            createdAt: new Date("2026-06-07T12:05:00.000Z"),
            eventId: outbox.eventId,
            id: `${outbox.id}:dead-letter`,
            outboxId: outbox.id,
            reason: "subscriber unavailable",
          });

          const loaded = yield* repository.findOutboxById(outbox.id);
          const deadLetters = yield* repository.listDeadLetters;

          expect(loaded).toEqual(outbox);
          expect(deadLetters).toMatchObject([
            {
              attempts: 3,
              eventId: outbox.eventId,
              reason: "subscriber unavailable",
            },
          ]);
        })
      ),
    },
    {
      name: "persists provider, template, and dispatch records",
      run: NotificationEventRepositoryService.use((repository) =>
        Effect.gen(function* persistsProviderTemplateAndDispatchRecords() {
          const dispatch = createDispatchRecord();
          yield* repository.saveProviderRecord({
            createdAt: now,
            id: "nprov_postgres_notification_1",
            isEnabled: true,
            providerKey: "email",
            updatedAt: now,
          });
          yield* repository.saveTemplate({
            channel: "email",
            id: "ntpl_postgres_notification_1",
            name: "Order placed",
            providerKey: "email",
            templateKey: "order.placed",
          });
          yield* repository.saveDispatch(dispatch);

          const template = yield* repository.findTemplateByKey({
            channel: "email",
            templateKey: "order.placed",
          });
          const duplicate = yield* repository.saveDispatch({
            ...dispatch,
            id: "ndsp_postgres_notification_duplicate",
            status: "failed",
          });
          const byIdempotency = yield* repository.findDispatchByIdempotencyKey(
            dispatch.idempotencyKey
          );
          const listed = yield* repository.listDispatches;

          expect(template).toMatchObject({
            id: "ntpl_postgres_notification_1",
            providerKey: "email",
          });
          expect(duplicate).toEqual(dispatch);
          expect(byIdempotency).toEqual(dispatch);
          expect(listed).toEqual([dispatch]);
        })
      ),
    },
  ];

const createLiveDatabaseLayer = () =>
  createPostgresClientLayer({
    applicationName: "@ecommerce/db-postgres:notification-event-repository",
    maxConnections: 2,
    url: Redacted.make(livePostgresUrl ?? "postgres://missing"),
  }).pipe((clientLayer) =>
    Layer.merge(
      clientLayer,
      createPostgresDrizzleLayer().pipe(Layer.provide(clientLayer))
    )
  );

describe("PostgreSQL notification-event repository Layer", () => {
  it("constructs a repository Layer without opening a connection", () => {
    const harness = createRepositoryContractHarness({
      adapter: postgresAdapterTarget,
      layer: createPostgresNotificationEventRepositoryLayer().pipe(
        Layer.provide(createLiveDatabaseLayer())
      ),
      repositoryName: "NotificationEventRepository",
    });

    expect(harness.adapter).toBe(postgresAdapterTarget);
    expect(harness.repositoryName).toBe("NotificationEventRepository");
    expect(
      Effect.isEffect(harness.runAll(notificationEventRepositoryContractCases))
    ).toBe(true);
  });

  it("skips the live contract harness when no PostgreSQL URL is configured", () => {
    const originalUrl = process.env[localPostgresContractUrlEnv];

    delete process.env[localPostgresContractUrlEnv];

    const result = createLocalPostgresRepositoryContractHarness({
      repositoryLayer: createPostgresNotificationEventRepositoryLayer(),
      repositoryName: "NotificationEventRepository",
      reset: resetPostgresNotificationEventTables,
    });

    if (originalUrl) {
      process.env[localPostgresContractUrlEnv] = originalUrl;
    }

    expect(result).toEqual({
      _tag: "skipped",
      reason: "missing-postgres-url",
    });
  });
});

describeLivePostgres("PostgreSQL notification-event repository Layer", () => {
  const liveDatabaseLayer = createLiveDatabaseLayer();
  const liveRepositoryLayer =
    createPostgresNotificationEventRepositoryLayer().pipe(
      Layer.provide(liveDatabaseLayer)
    );
  const liveRuntime = ManagedRuntime.make(
    Layer.merge(liveDatabaseLayer, liveRepositoryLayer)
  );
  const liveHarness = createLocalPostgresRepositoryContractHarness({
    databaseUrl: livePostgresUrl,
    repositoryLayer: createPostgresNotificationEventRepositoryLayer(),
    repositoryName: "NotificationEventRepository",
    reset: resetPostgresNotificationEventTables,
  });

  afterAll(async () => {
    await liveRuntime.dispose();
  });

  it("runs the notification-event repository contract against local PostgreSQL", async () => {
    expect(liveHarness._tag).toBe("available");

    if (liveHarness._tag === "available") {
      await Effect.runPromise(
        liveHarness.harness.runAll(notificationEventRepositoryContractCases)
      );
    }
  });

  it("rolls back notification-event writes inside PostgreSQL transactions", async () => {
    await liveRuntime.runPromise(
      resetPostgresDevelopmentDatabase({
        allowDestructive: true,
      }).pipe(
        Effect.andThen(runPostgresMigrations()),
        Effect.provide(liveDatabaseLayer)
      )
    );

    const outbox = createOutboxRecord();
    const rollbackExit = await liveRuntime.runPromiseExit(
      withPostgresNotificationEventTransaction(
        NotificationEventRepositoryService.use((repository) =>
          repository
            .saveOutbox(outbox)
            .pipe(Effect.andThen(Effect.fail("force-rollback")))
        )
      )
    );
    const loaded = await liveRuntime.runPromise(
      NotificationEventRepositoryService.use((repository) =>
        repository.findOutboxById(outbox.id)
      )
    );

    expect(Exit.isFailure(rollbackExit)).toBe(true);
    expect(loaded).toBeNull();
  });
});
