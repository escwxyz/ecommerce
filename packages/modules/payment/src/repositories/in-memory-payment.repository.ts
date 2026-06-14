import type {
  Payment,
  PaymentAccountHolder,
  PaymentAccountHolderId,
  PaymentCapture,
  PaymentCollection,
  PaymentCollectionId,
  PaymentId,
  PaymentMethod,
  PaymentMethodId,
  PaymentProviderRecord,
  PaymentRefund,
  PaymentRepository,
  PaymentSession,
  PaymentSessionId,
} from "../domain";

export interface ResettablePaymentRepository extends PaymentRepository {
  clear(): void;
}

const sortByCreatedAtDesc = <Record extends { readonly createdAt: Date }>(
  records: Iterable<Record>
): Record[] => {
  const sorted: Record[] = [];

  for (const record of records) {
    const timestamp = record.createdAt.getTime();
    let insertAt = 0;

    while (insertAt < sorted.length) {
      const current = sorted[insertAt];

      if (!current || current.createdAt.getTime() < timestamp) {
        break;
      }

      insertAt += 1;
    }

    sorted.splice(insertAt, 0, record);
  }

  return sorted;
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

  clear(): void {
    this.#accountHolders.clear();
    this.#captures.clear();
    this.#collections.clear();
    this.#methods.clear();
    this.#payments.clear();
    this.#providerRecords.clear();
    this.#refunds.clear();
    this.#sessions.clear();
  }

  findAccountHolderById(
    id: PaymentAccountHolderId
  ): Promise<PaymentAccountHolder | null> {
    return Promise.resolve(this.#accountHolders.get(id) ?? null);
  }

  findAccountHolderByProviderId({
    providerAccountHolderId,
    providerKey,
  }: {
    readonly providerAccountHolderId: string;
    readonly providerKey: string;
  }): Promise<PaymentAccountHolder | null> {
    for (const accountHolder of this.#accountHolders.values()) {
      if (
        accountHolder.providerKey === providerKey &&
        accountHolder.providerAccountHolderId === providerAccountHolderId
      ) {
        return Promise.resolve(accountHolder);
      }
    }

    return Promise.resolve(null);
  }

  findCaptureByIdempotencyKey(
    idempotencyKey: string
  ): Promise<PaymentCapture | null> {
    for (const capture of this.#captures.values()) {
      if (capture.idempotencyKey === idempotencyKey) {
        return Promise.resolve(capture);
      }
    }

    return Promise.resolve(null);
  }

  findCollectionById(
    id: PaymentCollectionId
  ): Promise<PaymentCollection | null> {
    return Promise.resolve(this.#collections.get(id) ?? null);
  }

  findMethodById(id: PaymentMethodId): Promise<PaymentMethod | null> {
    return Promise.resolve(this.#methods.get(id) ?? null);
  }

  findPaymentById(id: PaymentId): Promise<Payment | null> {
    return Promise.resolve(this.#payments.get(id) ?? null);
  }

  findPaymentByProviderIntent({
    providerKey,
    providerPaymentIntentId,
  }: {
    readonly providerKey: string;
    readonly providerPaymentIntentId: string;
  }): Promise<Payment | null> {
    for (const payment of this.#payments.values()) {
      if (
        payment.providerKey === providerKey &&
        payment.providerPaymentIntentId === providerPaymentIntentId
      ) {
        return Promise.resolve(payment);
      }
    }

    return Promise.resolve(null);
  }

  findRefundByIdempotencyKey(
    idempotencyKey: string
  ): Promise<PaymentRefund | null> {
    for (const refund of this.#refunds.values()) {
      if (refund.idempotencyKey === idempotencyKey) {
        return Promise.resolve(refund);
      }
    }

    return Promise.resolve(null);
  }

  findSessionById(id: PaymentSessionId): Promise<PaymentSession | null> {
    return Promise.resolve(this.#sessions.get(id) ?? null);
  }

  findSessionByProviderIntent({
    providerKey,
    providerPaymentIntentId,
  }: {
    readonly providerKey: string;
    readonly providerPaymentIntentId: string;
  }): Promise<PaymentSession | null> {
    for (const session of this.#sessions.values()) {
      if (
        session.providerKey === providerKey &&
        session.providerPaymentIntentId === providerPaymentIntentId
      ) {
        return Promise.resolve(session);
      }
    }

    return Promise.resolve(null);
  }

  listCollections(): Promise<readonly PaymentCollection[]> {
    return Promise.resolve(sortByCreatedAtDesc(this.#collections.values()));
  }

  listPaymentsForCollection(
    collectionId: PaymentCollectionId
  ): Promise<readonly Payment[]> {
    const payments = [...this.#payments.values()].filter(
      (payment) => payment.collectionId === collectionId
    );

    return Promise.resolve(sortByCreatedAtDesc(payments));
  }

  listSessionsForCollection(
    collectionId: PaymentCollectionId
  ): Promise<readonly PaymentSession[]> {
    const sessions = [...this.#sessions.values()].filter(
      (session) => session.collectionId === collectionId
    );

    return Promise.resolve(sortByCreatedAtDesc(sessions));
  }

  saveAccountHolder(
    accountHolder: PaymentAccountHolder
  ): Promise<PaymentAccountHolder> {
    this.#accountHolders.set(accountHolder.id, accountHolder);
    return Promise.resolve(accountHolder);
  }

  saveCapture(capture: PaymentCapture): Promise<PaymentCapture> {
    this.#captures.set(capture.id, capture);
    return Promise.resolve(capture);
  }

  saveCollection(collection: PaymentCollection): Promise<PaymentCollection> {
    this.#collections.set(collection.id, collection);
    return Promise.resolve(collection);
  }

  saveMethod(method: PaymentMethod): Promise<PaymentMethod> {
    this.#methods.set(method.id, method);
    return Promise.resolve(method);
  }

  savePayment(payment: Payment): Promise<Payment> {
    this.#payments.set(payment.id, payment);
    return Promise.resolve(payment);
  }

  saveProviderRecord(
    providerRecord: PaymentProviderRecord
  ): Promise<PaymentProviderRecord> {
    this.#providerRecords.set(providerRecord.id, providerRecord);
    return Promise.resolve(providerRecord);
  }

  saveRefund(refund: PaymentRefund): Promise<PaymentRefund> {
    this.#refunds.set(refund.id, refund);
    return Promise.resolve(refund);
  }

  saveSession(session: PaymentSession): Promise<PaymentSession> {
    this.#sessions.set(session.id, session);
    return Promise.resolve(session);
  }
}

export const defaultPaymentRepository = new InMemoryPaymentRepository();

export const createInMemoryPaymentRepository = (): PaymentRepository =>
  new InMemoryPaymentRepository();

export const createResettableInMemoryPaymentRepository =
  (): ResettablePaymentRepository => new InMemoryPaymentRepository();
