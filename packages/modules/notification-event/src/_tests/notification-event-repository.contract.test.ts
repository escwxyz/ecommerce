import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";

import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import { createD1NotificationEventRepository } from "../adapters/d1";
import {
  type EventOutboxRecord,
  type NotificationDispatchRecord,
  type NotificationEventDatabase,
  notificationEventMigration,
} from "../domain";
import { createInMemoryNotificationEventRepository } from "../repositories";

type FakeD1Binding = ConstructorParameters<typeof D1Dialect>[0]["database"];

class FakeD1PreparedStatement {
  readonly #query: string;
  readonly #sqlite: Database;
  readonly #values: readonly SQLQueryBindings[];

  constructor(
    sqlite: Database,
    query: string,
    values: readonly SQLQueryBindings[] = []
  ) {
    this.#query = query;
    this.#sqlite = sqlite;
    this.#values = values;
  }

  bind(...values: readonly SQLQueryBindings[]): FakeD1PreparedStatement {
    return new FakeD1PreparedStatement(this.#sqlite, this.#query, values);
  }

  all() {
    const normalizedQuery = this.#query.trim().toLowerCase();
    const statement = this.#sqlite.query(this.#query);

    if (
      normalizedQuery.startsWith("select") ||
      normalizedQuery.startsWith("pragma")
    ) {
      return Promise.resolve({
        meta: { changes: 0, last_row_id: 0 },
        results: statement.all(...this.#values),
        success: true,
      });
    }

    const result = statement.run(...this.#values);
    return Promise.resolve({
      meta: {
        changes: result.changes,
        last_row_id: Number(result.lastInsertRowid),
      },
      results: [],
      success: true,
    });
  }
}

const createFakeD1Binding = (sqlite: Database): FakeD1Binding =>
  ({
    batch: async (statements: readonly FakeD1PreparedStatement[]) =>
      Promise.all(statements.map((statement) => statement.all())),
    exec: async (query: string) => {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
    prepare: (query: string) => new FakeD1PreparedStatement(sqlite, query),
  }) as unknown as FakeD1Binding;

const createKyselyD1NotificationEventDatabase = (sqlite: Database) =>
  new Kysely<NotificationEventDatabase>({
    dialect: new D1Dialect({
      database: createFakeD1Binding(sqlite),
    }),
  });

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
  createRepository: () =>
    | ReturnType<typeof createInMemoryNotificationEventRepository>
    | Promise<ReturnType<typeof createInMemoryNotificationEventRepository>>,
  cleanup?: () => void
) => {
  describe(name, () => {
    afterEach(() => {
      cleanup?.();
    });

    it("persists event outbox and dead-letter records", async () => {
      const repository = await createRepository();
      const outbox = createOutboxRecord();

      await repository.saveOutbox(outbox);
      await repository.saveDeadLetter({
        attempts: 3,
        createdAt: new Date("2026-06-07T12:05:00.000Z"),
        eventId: outbox.eventId,
        id: `${outbox.id}:dead-letter`,
        outboxId: outbox.id,
        reason: "subscriber unavailable",
      });

      await expect(repository.findOutboxById(outbox.id)).resolves.toEqual(
        outbox
      );
      await expect(repository.listDeadLetters()).resolves.toMatchObject([
        {
          attempts: 3,
          eventId: "evt_repo_1",
          reason: "subscriber unavailable",
        },
      ]);
    });

    it("persists templates, providers, and dispatch records", async () => {
      const repository = await createRepository();
      const dispatch = createDispatchRecord();

      await repository.saveProviderRecord({
        createdAt: new Date("2026-06-07T12:00:00.000Z"),
        id: "nprov_repo_1",
        isEnabled: true,
        providerKey: "email",
        updatedAt: new Date("2026-06-07T12:00:00.000Z"),
      });
      await repository.saveTemplate({
        channel: "email",
        id: "ntpl_repo_1",
        name: "Order placed",
        providerKey: "email",
        templateKey: "order.placed",
      });
      await repository.saveDispatch(dispatch);

      await expect(
        repository.findTemplateByKey({
          channel: "email",
          templateKey: "order.placed",
        })
      ).resolves.toMatchObject({
        id: "ntpl_repo_1",
        providerKey: "email",
      });
      await expect(
        repository.findDispatchByIdempotencyKey("notify_repo_1")
      ).resolves.toEqual(dispatch);
      await expect(repository.listDispatches()).resolves.toEqual([dispatch]);
    });
  });
};

runNotificationEventRepositoryContract(
  "in-memory notification-event repository",
  () => createInMemoryNotificationEventRepository()
);

describe("D1 notification-event repository", () => {
  let sqlite: Database | undefined;

  runNotificationEventRepositoryContract(
    "repository contract",
    async () => {
      sqlite = new Database(":memory:");
      const db = createKyselyD1NotificationEventDatabase(sqlite);
      await notificationEventMigration.up(db);
      return createD1NotificationEventRepository({ db });
    },
    () => {
      sqlite?.close();
      sqlite = undefined;
    }
  );
});
