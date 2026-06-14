import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";

import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import { createD1PaymentRepository } from "../adapters/d1";
import {
  createPaymentAccountHolderId,
  createPaymentCaptureId,
  createPaymentCollectionId,
  createPaymentId,
  createPaymentMethodId,
  createPaymentProviderRecordId,
  createPaymentRefundId,
  createPaymentSessionId,
  paymentMigration,
  type Payment,
  type PaymentAccountHolder,
  type PaymentCapture,
  type PaymentCollection,
  type PaymentDatabase,
  type PaymentMethod,
  type PaymentProviderRecord,
  type PaymentRefund,
  type PaymentRepository,
  type PaymentSession,
} from "../domain";
import { createInMemoryPaymentRepository } from "../repositories";

const now = new Date("2026-01-01T00:00:00.000Z");
const collectionId = createPaymentCollectionId("paycol_contract");
const sessionId = createPaymentSessionId("payses_contract");
const paymentId = createPaymentId("pay_contract");

const createProviderRecord = (): PaymentProviderRecord => ({
  createdAt: now,
  id: createPaymentProviderRecordId("payprov_contract"),
  isEnabled: true,
  providerKey: "fake",
  providerRecordId: "fake",
  updatedAt: now,
});

const createAccountHolder = (): PaymentAccountHolder => ({
  createdAt: now,
  customerId: "cus_contract",
  email: "ada@example.com",
  id: createPaymentAccountHolderId("payacct_contract"),
  metadata: {},
  providerAccountHolderId: "fake_customer",
  providerKey: "fake",
  updatedAt: now,
});

const createMethod = (): PaymentMethod => ({
  accountHolderId: createPaymentAccountHolderId("payacct_contract"),
  createdAt: now,
  displayName: "Visa",
  id: createPaymentMethodId("paymtd_contract"),
  metadata: {},
  providerKey: "fake",
  providerPaymentMethodId: "pm_contract",
  reusable: true,
  type: "card",
  updatedAt: now,
});

const createCollection = (): PaymentCollection => ({
  amount: 1200,
  cartId: "cart_contract",
  createdAt: now,
  currencyCode: "USD",
  id: collectionId,
  metadata: {},
  status: "pending",
  updatedAt: now,
});

const createSession = (): PaymentSession => ({
  amount: 1200,
  collectionId,
  createdAt: now,
  currencyCode: "USD",
  id: sessionId,
  metadata: {},
  providerKey: "fake",
  providerPaymentIntentId: "intent_contract",
  status: "authorized",
  updatedAt: now,
});

const createPaymentRecord = (): Payment => ({
  amount: 1200,
  collectionId,
  createdAt: now,
  currencyCode: "USD",
  id: paymentId,
  metadata: {},
  providerKey: "fake",
  providerPaymentIntentId: "intent_contract",
  sessionId,
  status: "authorized",
  updatedAt: now,
});

const createCapture = (): PaymentCapture => ({
  amount: 1200,
  createdAt: now,
  currencyCode: "USD",
  id: createPaymentCaptureId("paycap_contract"),
  idempotencyKey: "capture_contract",
  paymentId,
  providerCaptureId: "intent_contract",
  status: "succeeded",
});

const createRefund = (): PaymentRefund => ({
  amount: 1200,
  createdAt: now,
  currencyCode: "USD",
  id: createPaymentRefundId("payref_contract"),
  idempotencyKey: "refund_contract",
  paymentId,
  providerRefundId: "refund_contract",
  reason: "customer-request",
  status: "succeeded",
});

interface RepositoryTestContext {
  readonly cleanup?: () => void;
  readonly repository: PaymentRepository;
}

const runPaymentRepositoryContract = (
  name: string,
  createContext: () => Promise<RepositoryTestContext> | RepositoryTestContext
) => {
  describe(name, () => {
    let cleanup: (() => void) | undefined;

    afterEach(() => {
      cleanup?.();
      cleanup = undefined;
    });

    const setup = async () => {
      const context = await createContext();
      cleanup = context.cleanup;
      return context.repository;
    };

    it("saves and reads payment-owned records", async () => {
      const repository = await setup();
      const providerRecord = createProviderRecord();
      const accountHolder = createAccountHolder();
      const method = createMethod();
      const collection = createCollection();
      const session = createSession();
      const payment = createPaymentRecord();
      const capture = createCapture();
      const refund = createRefund();

      await repository.saveProviderRecord(providerRecord);
      await repository.saveAccountHolder(accountHolder);
      await repository.saveMethod(method);
      await repository.saveCollection(collection);
      await repository.saveSession(session);
      await repository.savePayment(payment);
      await repository.saveCapture(capture);
      await repository.saveRefund(refund);

      await expect(
        repository.findAccountHolderById(accountHolder.id)
      ).resolves.toEqual(accountHolder);
      await expect(
        repository.findAccountHolderByProviderId({
          providerAccountHolderId: "fake_customer",
          providerKey: "fake",
        })
      ).resolves.toEqual(accountHolder);
      await expect(repository.findMethodById(method.id)).resolves.toEqual(
        method
      );
      await expect(
        repository.findCollectionById(collection.id)
      ).resolves.toEqual(collection);
      await expect(repository.findSessionById(session.id)).resolves.toEqual(
        session
      );
      await expect(
        repository.findSessionByProviderIntent({
          providerKey: "fake",
          providerPaymentIntentId: "intent_contract",
        })
      ).resolves.toEqual(session);
      await expect(repository.findPaymentById(payment.id)).resolves.toEqual(
        payment
      );
      await expect(
        repository.findPaymentByProviderIntent({
          providerKey: "fake",
          providerPaymentIntentId: "intent_contract",
        })
      ).resolves.toEqual(payment);
      await expect(
        repository.findCaptureByIdempotencyKey("capture_contract")
      ).resolves.toEqual(capture);
      await expect(
        repository.findRefundByIdempotencyKey("refund_contract")
      ).resolves.toEqual(refund);
      await expect(repository.listCollections()).resolves.toEqual([collection]);
      await expect(
        repository.listSessionsForCollection(collection.id)
      ).resolves.toEqual([session]);
      await expect(
        repository.listPaymentsForCollection(collection.id)
      ).resolves.toEqual([payment]);
    });
  });
};

const createFakeD1Binding = (sqlite: Database) => ({
  batch: async (statements: readonly FakeD1PreparedStatement[]) =>
    Promise.all(statements.map((statement) => statement.all())),
  exec: async (query: string) => {
    sqlite.exec(query);
    return { count: 0, duration: 0 };
  },
  prepare: (query: string) => new FakeD1PreparedStatement(sqlite, query),
});

type FakeD1Binding = ConstructorParameters<typeof D1Dialect>[0]["database"];

const createKyselyD1PaymentDatabase = (sqlite: Database) =>
  new Kysely<PaymentDatabase>({
    dialect: new D1Dialect({
      database: createFakeD1Binding(sqlite) as unknown as FakeD1Binding,
    }),
  });

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

const createMigratedD1PaymentContext = async (): Promise<{
  readonly db: Kysely<PaymentDatabase>;
  readonly repository: PaymentRepository;
  readonly sqlite: Database;
}> => {
  const sqlite = new Database(":memory:");
  sqlite.exec("pragma foreign_keys = on");
  const db = createKyselyD1PaymentDatabase(sqlite);
  await paymentMigration.up(db);

  return {
    db,
    repository: createD1PaymentRepository({ db }),
    sqlite,
  };
};

runPaymentRepositoryContract("in-memory payment repository", () => ({
  repository: createInMemoryPaymentRepository(),
}));

runPaymentRepositoryContract("D1 payment repository", async () => {
  const { db, repository, sqlite } = await createMigratedD1PaymentContext();

  return {
    cleanup: () => {
      db.destroy();
      sqlite.close();
    },
    repository,
  };
});
