import { Effect, Layer } from "effect";

import type {
  Payment,
  PaymentAccountHolder,
  PaymentAccountHolderId,
  PaymentCapture,
  PaymentCollection,
  PaymentCollectionId,
  PaymentExpectedError,
  PaymentId,
  PaymentMethod,
  PaymentMethodId,
  PaymentProviderRecord,
  PaymentRefund,
  PaymentRepository,
  PaymentSession,
  PaymentSessionId,
} from "../domain";
import { PaymentRepositoryService } from "../domain";

export interface ResettablePaymentRepository extends PaymentRepository {
  readonly clear: Effect.Effect<void>;
}

const sortByCreatedAtDescending = <
  TRecord extends { readonly createdAt: Date },
>(
  records: Iterable<TRecord>
): TRecord[] => {
  const sortedRecords: TRecord[] = [];

  for (const record of records) {
    const recordTimestamp = record.createdAt.getTime();
    let insertAt = 0;

    while (insertAt < sortedRecords.length) {
      const currentRecord = sortedRecords[insertAt];

      if (
        !currentRecord ||
        currentRecord.createdAt.getTime() < recordTimestamp
      ) {
        break;
      }

      insertAt += 1;
    }

    sortedRecords.splice(insertAt, 0, record);
  }

  return sortedRecords;
};

export class InMemoryPaymentRepository implements ResettablePaymentRepository {
  readonly #accountHolders = new Map<string, PaymentAccountHolder>();
  readonly #captures = new Map<string, PaymentCapture>();
  readonly #collections = new Map<string, PaymentCollection>();
  readonly #methods = new Map<string, PaymentMethod>();
  readonly #payments = new Map<string, Payment>();
  readonly #providerRecords = new Map<string, PaymentProviderRecord>();
  readonly #refunds = new Map<string, PaymentRefund>();
  readonly #sessions = new Map<string, PaymentSession>();

  readonly clear = Effect.sync(() => {
    this.#accountHolders.clear();
    this.#captures.clear();
    this.#collections.clear();
    this.#methods.clear();
    this.#payments.clear();
    this.#providerRecords.clear();
    this.#refunds.clear();
    this.#sessions.clear();
  });

  readonly findAccountHolderById = (
    id: PaymentAccountHolderId
  ): Effect.Effect<PaymentAccountHolder | null, PaymentExpectedError> =>
    Effect.sync(() => this.#accountHolders.get(id) ?? null);

  readonly findAccountHolderByProviderId = ({
    providerAccountHolderId,
    providerKey,
  }: {
    readonly providerAccountHolderId: string;
    readonly providerKey: string;
  }): Effect.Effect<PaymentAccountHolder | null, PaymentExpectedError> =>
    Effect.sync(() => {
      for (const accountHolder of this.#accountHolders.values()) {
        if (
          accountHolder.providerKey === providerKey &&
          accountHolder.providerAccountHolderId === providerAccountHolderId
        ) {
          return accountHolder;
        }
      }

      return null;
    });

  readonly findCaptureByIdempotencyKey = (
    idempotencyKey: string
  ): Effect.Effect<PaymentCapture | null, PaymentExpectedError> =>
    Effect.sync(() => {
      for (const capture of this.#captures.values()) {
        if (capture.idempotencyKey === idempotencyKey) {
          return capture;
        }
      }

      return null;
    });

  readonly findCollectionById = (
    id: PaymentCollectionId
  ): Effect.Effect<PaymentCollection | null, PaymentExpectedError> =>
    Effect.sync(() => this.#collections.get(id) ?? null);

  readonly findMethodById = (
    id: PaymentMethodId
  ): Effect.Effect<PaymentMethod | null, PaymentExpectedError> =>
    Effect.sync(() => this.#methods.get(id) ?? null);

  readonly findPaymentById = (
    id: PaymentId
  ): Effect.Effect<Payment | null, PaymentExpectedError> =>
    Effect.sync(() => this.#payments.get(id) ?? null);

  readonly findPaymentByProviderIntent = ({
    providerKey,
    providerPaymentIntentId,
  }: {
    readonly providerKey: string;
    readonly providerPaymentIntentId: string;
  }): Effect.Effect<Payment | null, PaymentExpectedError> =>
    Effect.sync(() => {
      for (const payment of this.#payments.values()) {
        if (
          payment.providerKey === providerKey &&
          payment.providerPaymentIntentId === providerPaymentIntentId
        ) {
          return payment;
        }
      }

      return null;
    });

  readonly findRefundByIdempotencyKey = (
    idempotencyKey: string
  ): Effect.Effect<PaymentRefund | null, PaymentExpectedError> =>
    Effect.sync(() => {
      for (const refund of this.#refunds.values()) {
        if (refund.idempotencyKey === idempotencyKey) {
          return refund;
        }
      }

      return null;
    });

  readonly findSessionById = (
    id: PaymentSessionId
  ): Effect.Effect<PaymentSession | null, PaymentExpectedError> =>
    Effect.sync(() => this.#sessions.get(id) ?? null);

  readonly findSessionByProviderIntent = ({
    providerKey,
    providerPaymentIntentId,
  }: {
    readonly providerKey: string;
    readonly providerPaymentIntentId: string;
  }): Effect.Effect<PaymentSession | null, PaymentExpectedError> =>
    Effect.sync(() => {
      for (const session of this.#sessions.values()) {
        if (
          session.providerKey === providerKey &&
          session.providerPaymentIntentId === providerPaymentIntentId
        ) {
          return session;
        }
      }

      return null;
    });

  readonly listCollections: Effect.Effect<
    readonly PaymentCollection[],
    PaymentExpectedError
  > = Effect.sync(() => sortByCreatedAtDescending(this.#collections.values()));

  readonly listPaymentsForCollection = (
    collectionId: PaymentCollectionId
  ): Effect.Effect<readonly Payment[], PaymentExpectedError> =>
    Effect.sync(() =>
      sortByCreatedAtDescending(
        [...this.#payments.values()].filter(
          (payment) => payment.collectionId === collectionId
        )
      )
    );

  readonly listSessionsForCollection = (
    collectionId: PaymentCollectionId
  ): Effect.Effect<readonly PaymentSession[], PaymentExpectedError> =>
    Effect.sync(() =>
      sortByCreatedAtDescending(
        [...this.#sessions.values()].filter(
          (session) => session.collectionId === collectionId
        )
      )
    );

  readonly saveAccountHolder = (
    accountHolder: PaymentAccountHolder
  ): Effect.Effect<PaymentAccountHolder, PaymentExpectedError> =>
    Effect.sync(() => {
      this.#accountHolders.set(accountHolder.id, accountHolder);
      return accountHolder;
    });

  readonly saveCapture = (
    capture: PaymentCapture
  ): Effect.Effect<PaymentCapture, PaymentExpectedError> =>
    Effect.sync(() => {
      this.#captures.set(capture.id, capture);
      return capture;
    });

  readonly saveCollection = (
    collection: PaymentCollection
  ): Effect.Effect<PaymentCollection, PaymentExpectedError> =>
    Effect.sync(() => {
      this.#collections.set(collection.id, collection);
      return collection;
    });

  readonly saveMethod = (
    method: PaymentMethod
  ): Effect.Effect<PaymentMethod, PaymentExpectedError> =>
    Effect.sync(() => {
      this.#methods.set(method.id, method);
      return method;
    });

  readonly savePayment = (
    payment: Payment
  ): Effect.Effect<Payment, PaymentExpectedError> =>
    Effect.sync(() => {
      this.#payments.set(payment.id, payment);
      return payment;
    });

  readonly saveProviderRecord = (
    providerRecord: PaymentProviderRecord
  ): Effect.Effect<PaymentProviderRecord, PaymentExpectedError> =>
    Effect.sync(() => {
      this.#providerRecords.set(providerRecord.id, providerRecord);
      return providerRecord;
    });

  readonly saveRefund = (
    refund: PaymentRefund
  ): Effect.Effect<PaymentRefund, PaymentExpectedError> =>
    Effect.sync(() => {
      this.#refunds.set(refund.id, refund);
      return refund;
    });

  readonly saveSession = (
    session: PaymentSession
  ): Effect.Effect<PaymentSession, PaymentExpectedError> =>
    Effect.sync(() => {
      this.#sessions.set(session.id, session);
      return session;
    });
}

export const createInMemoryPaymentRepository = (): PaymentRepository =>
  new InMemoryPaymentRepository();

export const createResettableInMemoryPaymentRepository =
  (): ResettablePaymentRepository => new InMemoryPaymentRepository();

export const createInMemoryPaymentRepositoryLayer = (
  repository: PaymentRepository
) => Layer.succeed(PaymentRepositoryService, repository);
