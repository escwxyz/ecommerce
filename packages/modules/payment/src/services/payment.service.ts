import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { Context, Layer } from "effect";
import { nanoid } from "nanoid";

import type {
  AttachPaymentMethodInput,
  AuthorizePaymentSessionInput,
  CapturePaymentInput,
  CreatePaymentAccountHolderInput,
  CreatePaymentCollectionInput,
  CreatePaymentSessionInput,
  Payment,
  PaymentAccountHolder,
  PaymentCapture,
  PaymentCollection,
  PaymentCollectionDetail,
  PaymentCollectionId,
  PaymentMethod,
  PaymentProviderRecord,
  PaymentRefund,
  PaymentRepository,
  PaymentSession,
  PaymentSessionId,
  RefundPaymentInput,
} from "../domain";
import {
  PAYMENT_ACCOUNT_HOLDER_ID_PREFIX,
  PAYMENT_CAPTURE_ID_PREFIX,
  PAYMENT_COLLECTION_ID_PREFIX,
  PAYMENT_ID_PREFIX,
  PAYMENT_METHOD_ID_PREFIX,
  PAYMENT_PROVIDER_RECORD_ID_PREFIX,
  PAYMENT_REFUND_ID_PREFIX,
  PAYMENT_SESSION_ID_PREFIX,
  createPaymentAccountHolderId,
  createPaymentCaptureId,
  createPaymentCollectionId,
  createPaymentId,
  createPaymentMethodId,
  createPaymentProviderRecordId,
  createPaymentRefundId,
  createPaymentSessionId,
} from "../domain";
import type { PaymentProviderRegistry } from "../providers";
import {
  emptyPaymentProviderRegistry,
  createPaymentProviderRegistry,
} from "../providers";
import { defaultPaymentRepository } from "../repositories";
import type {
  PaymentWebhookAction,
  PaymentWebhookActionResult,
} from "../webhooks";
import { mapProviderEventsToPaymentActions } from "../webhooks";

export const PAYMENT_COLLECTION_CREATED_EVENT =
  "payment.collection-created" as const;
export const PAYMENT_SESSION_CREATED_EVENT = "payment.session-created" as const;
export const PAYMENT_AUTHORIZED_EVENT = "payment.authorized" as const;
export const PAYMENT_CAPTURED_EVENT = "payment.captured" as const;
export const PAYMENT_REFUNDED_EVENT = "payment.refunded" as const;
export const PAYMENT_WEBHOOK_APPLIED_EVENT = "payment.webhook-applied" as const;

export interface PaymentServiceShape {
  applyWebhookActions(
    result: PaymentWebhookActionResult
  ): Promise<readonly PaymentWebhookAction[]>;
  attachPaymentMethod(input: AttachPaymentMethodInput): Promise<PaymentMethod>;
  authorizePaymentSession(
    input: AuthorizePaymentSessionInput
  ): Promise<Payment>;
  capturePayment(input: CapturePaymentInput): Promise<PaymentCapture>;
  createAccountHolder(
    input: CreatePaymentAccountHolderInput
  ): Promise<PaymentAccountHolder>;
  createCollection(
    input: CreatePaymentCollectionInput
  ): Promise<PaymentCollection>;
  createSession(input: CreatePaymentSessionInput): Promise<PaymentSession>;
  getCollectionDetail(
    id: PaymentCollectionId
  ): Promise<PaymentCollectionDetail | null>;
  listCollections(): Promise<readonly PaymentCollection[]>;
  parseProviderWebhook(input: {
    readonly headers: Readonly<Record<string, string>>;
    readonly payload: string | Uint8Array;
    readonly providerKey: string;
  }): Promise<PaymentWebhookActionResult>;
  refundPayment(input: RefundPaymentInput): Promise<PaymentRefund>;
  registerProvider(providerKey: string): Promise<PaymentProviderRecord>;
}

export const PaymentService = Context.Service<PaymentServiceShape>(
  "@ecommerce/payment/PaymentService"
);

export interface CreatePaymentServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly providerRegistry?: PaymentProviderRegistry;
  readonly repository?: PaymentRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
});

const createPrefixedId = (
  idGenerator: IdGeneratorServiceShape,
  prefix: string
): string => {
  const nextId = idGenerator.nextId();
  return nextId.startsWith(prefix) ? nextId : `${prefix}${nextId}`;
};

const normalizeCurrencyCode = (currencyCode: string): string =>
  currencyCode.trim().toUpperCase();

const requireProvider = (
  registry: PaymentProviderRegistry,
  providerKey: string
) => {
  const provider = registry.getProvider(providerKey);

  if (!provider) {
    throw new Error(`Payment provider "${providerKey}" is not registered.`);
  }

  return provider;
};

const requireCollection = async (
  repository: PaymentRepository,
  collectionId: PaymentCollectionId
): Promise<PaymentCollection> => {
  const collection = await repository.findCollectionById(collectionId);

  if (!collection) {
    throw new Error(`Payment collection "${collectionId}" was not found.`);
  }

  return collection;
};

const requireSession = async (
  repository: PaymentRepository,
  sessionId: PaymentSessionId
): Promise<PaymentSession> => {
  const session = await repository.findSessionById(sessionId);

  if (!session) {
    throw new Error(`Payment session "${sessionId}" was not found.`);
  }

  return session;
};

const getCollectionStatusForPayment = (
  paymentStatus: Payment["status"]
): PaymentCollection["status"] => {
  if (paymentStatus === "authorized") {
    return "authorized";
  }

  if (paymentStatus === "captured") {
    return "captured";
  }

  if (paymentStatus === "failed") {
    return "failed";
  }

  if (paymentStatus === "canceled") {
    return "canceled";
  }

  return "partially-captured";
};

const getPaymentStatusFromProvider = (
  status: "authorized" | "captured" | "canceled" | "failed" | string
): Payment["status"] => {
  if (status === "captured") {
    return "captured";
  }

  if (status === "canceled") {
    return "canceled";
  }

  if (status === "failed") {
    return "failed";
  }

  return "authorized";
};

const getPaymentStatusFromWebhookAction = (
  actionType: "payment.authorized" | "payment.captured" | "payment.failed"
): Payment["status"] => {
  if (actionType === "payment.captured") {
    return "captured";
  }

  if (actionType === "payment.failed") {
    return "failed";
  }

  return "authorized";
};

const getSessionStatusForPayment = (
  status: Payment["status"]
): PaymentSession["status"] => {
  if (status === "captured") {
    return "captured";
  }

  if (status === "canceled") {
    return "canceled";
  }

  if (status === "failed") {
    return "failed";
  }

  return "authorized";
};

export const createPaymentService = ({
  clock = createDefaultClock(),
  idGenerator = createDefaultIdGenerator(),
  providerRegistry = emptyPaymentProviderRegistry,
  repository = defaultPaymentRepository,
}: CreatePaymentServiceOptions = {}): PaymentServiceShape => {
  const updateCollectionStatus = (
    collection: PaymentCollection,
    status: PaymentCollection["status"]
  ): Promise<PaymentCollection> =>
    repository.saveCollection({
      ...collection,
      status,
      updatedAt: clock.now(),
    });

  const savePaymentFromProviderIntent = async ({
    collection,
    providerKey,
    providerPaymentIntentId,
    session,
    status,
  }: {
    readonly collection: PaymentCollection;
    readonly providerKey: string;
    readonly providerPaymentIntentId: string;
    readonly session: PaymentSession;
    readonly status: Payment["status"];
  }): Promise<Payment> => {
    const existing = await repository.findPaymentByProviderIntent({
      providerKey,
      providerPaymentIntentId,
    });
    const now = clock.now();
    const payment: Payment = existing
      ? {
          ...existing,
          status,
          updatedAt: now,
        }
      : {
          amount: collection.amount,
          collectionId: collection.id,
          createdAt: now,
          currencyCode: collection.currencyCode,
          id: createPaymentId(createPrefixedId(idGenerator, PAYMENT_ID_PREFIX)),
          metadata: {},
          providerKey,
          providerPaymentIntentId,
          sessionId: session.id,
          status,
          updatedAt: now,
        };

    await repository.savePayment(payment);
    await repository.saveSession({
      ...session,
      providerPaymentIntentId,
      status: getSessionStatusForPayment(status),
      updatedAt: now,
    });
    await updateCollectionStatus(
      collection,
      getCollectionStatusForPayment(status)
    );

    return payment;
  };

  return {
    applyWebhookActions: async (result) => {
      for (const action of result.actions) {
        if (
          action.type !== "payment.authorized" &&
          action.type !== "payment.captured" &&
          action.type !== "payment.failed"
        ) {
          continue;
        }

        const session = await repository.findSessionByProviderIntent({
          providerKey: action.providerKey,
          providerPaymentIntentId: action.paymentIntentId,
        });

        if (!session) {
          continue;
        }

        const collection = await requireCollection(
          repository,
          session.collectionId
        );
        await savePaymentFromProviderIntent({
          collection,
          providerKey: action.providerKey,
          providerPaymentIntentId: action.paymentIntentId,
          session,
          status: getPaymentStatusFromWebhookAction(action.type),
        });
      }

      return result.actions;
    },
    attachPaymentMethod: async (input) => {
      const accountHolderId = createPaymentAccountHolderId(
        input.accountHolderId
      );
      const accountHolder =
        await repository.findAccountHolderById(accountHolderId);

      if (!accountHolder) {
        throw new Error(
          `Payment account holder "${accountHolderId}" was not found.`
        );
      }

      const provider = requireProvider(
        providerRegistry,
        accountHolder.providerKey
      );
      const providerMethod = await provider.attachPaymentMethod({
        customerId: accountHolder.providerAccountHolderId,
        providerPaymentMethodId: input.providerPaymentMethodId,
      });
      const now = clock.now();
      const method: PaymentMethod = {
        accountHolderId,
        createdAt: now,
        displayName: providerMethod.displayName,
        id: createPaymentMethodId(
          createPrefixedId(idGenerator, PAYMENT_METHOD_ID_PREFIX)
        ),
        metadata: providerMethod.metadata ?? {},
        providerKey: accountHolder.providerKey,
        providerPaymentMethodId: providerMethod.id,
        reusable: providerMethod.reusable,
        type: providerMethod.type,
        updatedAt: now,
      };

      return repository.saveMethod(method);
    },
    authorizePaymentSession: async (input) => {
      const session = await requireSession(
        repository,
        createPaymentSessionId(input.sessionId)
      );
      const collection = await requireCollection(
        repository,
        session.collectionId
      );
      const provider = requireProvider(providerRegistry, session.providerKey);
      const method = input.paymentMethodId
        ? await repository.findMethodById(
            createPaymentMethodId(input.paymentMethodId)
          )
        : null;
      const intent = await provider.createPaymentIntent({
        amount: {
          amount: session.amount,
          currencyCode: session.currencyCode,
        },
        captureMethod: "manual",
        idempotencyKey: input.idempotencyKey,
        metadata: session.metadata,
        paymentMethodId: method?.providerPaymentMethodId,
      });
      const status = getPaymentStatusFromProvider(intent.status);

      return savePaymentFromProviderIntent({
        collection,
        providerKey: session.providerKey,
        providerPaymentIntentId: intent.id,
        session,
        status,
      });
    },
    capturePayment: async (input) => {
      const existing = await repository.findCaptureByIdempotencyKey(
        input.idempotencyKey
      );

      if (existing) {
        return existing;
      }

      const payment = await repository.findPaymentById(
        createPaymentId(input.paymentId)
      );

      if (!payment) {
        throw new Error(`Payment "${input.paymentId}" was not found.`);
      }

      const provider = requireProvider(providerRegistry, payment.providerKey);
      const amount = input.amount ?? payment.amount;

      if (amount > payment.amount) {
        throw new Error(
          `Capture amount ${amount} exceeds authorized payment amount ${payment.amount}.`
        );
      }

      const providerIntent = await provider.capturePaymentIntent({
        amount: {
          amount,
          currencyCode: payment.currencyCode,
        },
        idempotencyKey: input.idempotencyKey,
        paymentIntentId: payment.providerPaymentIntentId,
      });
      const capture: PaymentCapture = {
        amount,
        createdAt: clock.now(),
        currencyCode: payment.currencyCode,
        id: createPaymentCaptureId(
          createPrefixedId(idGenerator, PAYMENT_CAPTURE_ID_PREFIX)
        ),
        idempotencyKey: input.idempotencyKey,
        paymentId: payment.id,
        providerCaptureId: providerIntent.id,
        status: providerIntent.status === "captured" ? "succeeded" : "pending",
      };

      await repository.savePayment({
        ...payment,
        status: amount < payment.amount ? "partially-captured" : "captured",
        updatedAt: clock.now(),
      });
      await updateCollectionStatus(
        await requireCollection(repository, payment.collectionId),
        amount < payment.amount ? "partially-captured" : "captured"
      );

      return repository.saveCapture(capture);
    },
    createAccountHolder: async (input) => {
      const provider = requireProvider(providerRegistry, input.providerKey);
      const providerCustomer = await provider.createCustomer({
        email: input.email,
        metadata: input.metadata,
        name: input.name,
      });
      const existing = await repository.findAccountHolderByProviderId({
        providerAccountHolderId: providerCustomer.id,
        providerKey: input.providerKey,
      });

      if (existing) {
        return existing;
      }

      const now = clock.now();
      const accountHolder: PaymentAccountHolder = {
        createdAt: now,
        customerId: input.customerId,
        email: input.email,
        id: createPaymentAccountHolderId(
          createPrefixedId(idGenerator, PAYMENT_ACCOUNT_HOLDER_ID_PREFIX)
        ),
        metadata: input.metadata ?? {},
        providerAccountHolderId: providerCustomer.id,
        providerKey: input.providerKey,
        updatedAt: now,
      };

      return repository.saveAccountHolder(accountHolder);
    },
    createCollection: (input) => {
      const now = clock.now();
      const collection: PaymentCollection = {
        amount: input.amount,
        cartId: input.cartId,
        createdAt: now,
        currencyCode: normalizeCurrencyCode(input.currencyCode),
        id: createPaymentCollectionId(
          createPrefixedId(idGenerator, PAYMENT_COLLECTION_ID_PREFIX)
        ),
        metadata: input.metadata ?? {},
        status: "pending",
        updatedAt: now,
      };

      return repository.saveCollection(collection);
    },
    createSession: async (input) => {
      const collection = await requireCollection(
        repository,
        createPaymentCollectionId(input.collectionId)
      );
      const provider = requireProvider(providerRegistry, input.providerKey);
      const accountHolder = input.accountHolderId
        ? await repository.findAccountHolderById(
            createPaymentAccountHolderId(input.accountHolderId)
          )
        : null;
      const checkoutSession =
        input.successUrl && input.cancelUrl
          ? await provider.createCheckoutSession({
              amount: {
                amount: collection.amount,
                currencyCode: collection.currencyCode,
              },
              cancelUrl: input.cancelUrl,
              customerId: accountHolder?.providerAccountHolderId,
              idempotencyKey: input.idempotencyKey,
              metadata: input.metadata,
              mode: "payment",
              successUrl: input.successUrl,
            })
          : null;
      const now = clock.now();
      const session: PaymentSession = {
        amount: collection.amount,
        collectionId: collection.id,
        createdAt: now,
        currencyCode: collection.currencyCode,
        id: createPaymentSessionId(
          createPrefixedId(idGenerator, PAYMENT_SESSION_ID_PREFIX)
        ),
        metadata: input.metadata ?? {},
        providerCheckoutSessionId: checkoutSession?.id,
        providerKey: input.providerKey,
        providerPaymentIntentId: checkoutSession?.paymentIntentId,
        status: "pending",
        updatedAt: now,
      };

      return repository.saveSession(session);
    },
    getCollectionDetail: async (id) => {
      const collection = await repository.findCollectionById(id);

      if (!collection) {
        return null;
      }

      const [payments, sessions] = await Promise.all([
        repository.listPaymentsForCollection(id),
        repository.listSessionsForCollection(id),
      ]);

      return {
        collection,
        payments,
        sessions,
      };
    },
    listCollections: () => repository.listCollections(),
    parseProviderWebhook: async ({ headers, payload, providerKey }) => {
      const provider = requireProvider(providerRegistry, providerKey);
      const result = await provider.parseWebhook({ headers, payload });

      return mapProviderEventsToPaymentActions(result.events);
    },
    refundPayment: async (input) => {
      const existing = await repository.findRefundByIdempotencyKey(
        input.idempotencyKey
      );

      if (existing) {
        return existing;
      }

      const payment = await repository.findPaymentById(
        createPaymentId(input.paymentId)
      );

      if (!payment) {
        throw new Error(`Payment "${input.paymentId}" was not found.`);
      }

      const provider = requireProvider(providerRegistry, payment.providerKey);
      const amount = input.amount ?? payment.amount;

      if (amount > payment.amount) {
        throw new Error(
          `Refund amount ${amount} exceeds payment amount ${payment.amount}.`
        );
      }

      const providerRefund = await provider.refundPayment({
        amount: {
          amount,
          currencyCode: payment.currencyCode,
        },
        idempotencyKey: input.idempotencyKey,
        paymentIntentId: payment.providerPaymentIntentId,
        reason: input.reason,
      });
      const refund: PaymentRefund = {
        amount,
        createdAt: clock.now(),
        currencyCode: payment.currencyCode,
        id: createPaymentRefundId(
          createPrefixedId(idGenerator, PAYMENT_REFUND_ID_PREFIX)
        ),
        idempotencyKey: input.idempotencyKey,
        paymentId: payment.id,
        providerRefundId: providerRefund.id,
        reason: input.reason,
        status: providerRefund.status,
      };

      await updateCollectionStatus(
        await requireCollection(repository, payment.collectionId),
        amount < payment.amount ? "partially-refunded" : "refunded"
      );

      return repository.saveRefund(refund);
    },
    registerProvider: (providerKey) => {
      const provider = requireProvider(providerRegistry, providerKey);
      const now = clock.now();
      const record: PaymentProviderRecord = {
        createdAt: now,
        id: createPaymentProviderRecordId(
          createPrefixedId(idGenerator, PAYMENT_PROVIDER_RECORD_ID_PREFIX)
        ),
        isEnabled: true,
        providerKey,
        providerRecordId: provider.id,
        updatedAt: now,
      };

      return repository.saveProviderRecord(record);
    },
  };
};

export const defaultPaymentService = createPaymentService();

export const createPaymentServiceLayer = (
  options: CreatePaymentServiceOptions
) => Layer.succeed(PaymentService, createPaymentService(options));

export const createPaymentServiceWithProviders = (
  options: Omit<CreatePaymentServiceOptions, "providerRegistry"> & {
    readonly providers: Parameters<typeof createPaymentProviderRegistry>[0];
  }
) =>
  createPaymentService({
    ...options,
    providerRegistry: createPaymentProviderRegistry(options.providers),
  });
