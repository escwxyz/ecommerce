import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import {
  ClockService,
  IdGeneratorService,
  correlationContextFromHeaders,
  createCorrelationContext,
} from "@ecommerce/core";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
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
  PaymentExpectedError,
  PaymentMethod,
  PaymentProviderRecord,
  PaymentRefund,
  PaymentRepository,
  PaymentSession,
  PaymentSessionId,
  PaymentWebhookAction,
  PaymentWebhookActionResult,
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
  PaymentAccountHolderNotFound,
  PaymentNotFound,
  PaymentProviderUnavailable,
  PaymentRepositoryService,
  PaymentSessionNotFound,
  PaymentValidationFailure,
  createPaymentAccountHolderIdEffect,
  createPaymentCaptureIdEffect,
  createPaymentCollectionIdEffect,
  createPaymentIdEffect,
  createPaymentMethodIdEffect,
  createPaymentProviderRecordIdEffect,
  createPaymentRefundIdEffect,
  createPaymentSessionIdEffect,
} from "../domain";
import type { PaymentProviderRegistry } from "../providers";
import {
  createPaymentProviderRegistry,
  emptyPaymentProviderRegistry,
} from "../providers";
import { defaultPaymentRepository } from "../repositories";
import { mapProviderEventsToPaymentActions } from "../webhooks";

export const PAYMENT_COLLECTION_CREATED_EVENT =
  "payment.collection-created" as const;
export const PAYMENT_SESSION_CREATED_EVENT = "payment.session-created" as const;
export const PAYMENT_AUTHORIZED_EVENT = "payment.authorized" as const;
export const PAYMENT_CAPTURED_EVENT = "payment.captured" as const;
export const PAYMENT_REFUNDED_EVENT = "payment.refunded" as const;
export const PAYMENT_WEBHOOK_APPLIED_EVENT = "payment.webhook-applied" as const;

export interface PaymentServiceShape {
  readonly applyWebhookActions: (
    result: PaymentWebhookActionResult
  ) => EffectValue<readonly PaymentWebhookAction[], PaymentExpectedError>;
  readonly attachPaymentMethod: (
    input: AttachPaymentMethodInput
  ) => EffectValue<PaymentMethod, PaymentExpectedError>;
  readonly authorizePaymentSession: (
    input: AuthorizePaymentSessionInput
  ) => EffectValue<Payment, PaymentExpectedError>;
  readonly capturePayment: (
    input: CapturePaymentInput
  ) => EffectValue<PaymentCapture, PaymentExpectedError>;
  readonly createAccountHolder: (
    input: CreatePaymentAccountHolderInput
  ) => EffectValue<PaymentAccountHolder, PaymentExpectedError>;
  readonly createCollection: (
    input: CreatePaymentCollectionInput
  ) => EffectValue<PaymentCollection, PaymentExpectedError>;
  readonly createSession: (
    input: CreatePaymentSessionInput
  ) => EffectValue<PaymentSession, PaymentExpectedError>;
  readonly getCollectionDetail: (
    id: PaymentCollectionId
  ) => EffectValue<PaymentCollectionDetail | null, PaymentExpectedError>;
  readonly listCollections: EffectValue<
    readonly PaymentCollection[],
    PaymentExpectedError
  >;
  readonly parseProviderWebhook: (input: {
    readonly headers: Readonly<Record<string, string>>;
    readonly payload: string | Uint8Array;
    readonly providerKey: string;
  }) => EffectValue<PaymentWebhookActionResult, PaymentExpectedError>;
  readonly refundPayment: (
    input: RefundPaymentInput
  ) => EffectValue<PaymentRefund, PaymentExpectedError>;
  readonly registerProvider: (
    providerKey: string
  ) => EffectValue<PaymentProviderRecord, PaymentExpectedError>;
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

const mapProviderFailure = (message: string) =>
  new PaymentValidationFailure({ message });

const providerCorrelation = (idempotencyKey: string) =>
  createCorrelationContext({ requestId: idempotencyKey });

const requireProvider = (
  registry: PaymentProviderRegistry,
  providerKey: string
) => {
  const provider = registry.getProvider(providerKey);
  return provider
    ? Effect.succeed(provider)
    : Effect.fail(new PaymentProviderUnavailable({ providerKey }));
};

const requireCollection = (
  repository: PaymentRepository,
  collectionId: PaymentCollectionId
) =>
  Effect.gen(function* requirePaymentCollectionEffect() {
    const collection = yield* repository.findCollectionById(collectionId);

    if (!collection) {
      return yield* new PaymentValidationFailure({
        message: `Payment collection "${collectionId}" was not found.`,
      });
    }

    return collection;
  });

const requireSession = (
  repository: PaymentRepository,
  sessionId: PaymentSessionId
) =>
  Effect.gen(function* requirePaymentSessionEffect() {
    const session = yield* repository.findSessionById(sessionId);

    if (!session) {
      return yield* new PaymentSessionNotFound({ sessionId });
    }

    return session;
  });

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
  ) =>
    repository.saveCollection({
      ...collection,
      status,
      updatedAt: clock.now(),
    });

  const savePaymentFromProviderIntent = ({
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
  }) =>
    Effect.gen(function* savePaymentFromProviderIntentEffect() {
      const existing = yield* repository.findPaymentByProviderIntent({
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
            id: yield* createPaymentIdEffect(
              createPrefixedId(idGenerator, PAYMENT_ID_PREFIX)
            ),
            metadata: {},
            providerKey,
            providerPaymentIntentId,
            sessionId: session.id,
            status,
            updatedAt: now,
          };

      yield* repository.savePayment(payment);
      yield* repository.saveSession({
        ...session,
        providerPaymentIntentId,
        status: getSessionStatusForPayment(status),
        updatedAt: now,
      });
      yield* updateCollectionStatus(
        collection,
        getCollectionStatusForPayment(status)
      );

      return payment;
    });

  return {
    applyWebhookActions: (result) =>
      Effect.gen(function* applyWebhookActionsEffect() {
        for (const action of result.actions) {
          if (
            action.type !== "payment.authorized" &&
            action.type !== "payment.captured" &&
            action.type !== "payment.failed"
          ) {
            continue;
          }

          const session = yield* repository.findSessionByProviderIntent({
            providerKey: action.providerKey,
            providerPaymentIntentId: action.paymentIntentId,
          });

          if (!session) {
            continue;
          }

          const collection = yield* requireCollection(
            repository,
            session.collectionId
          );
          yield* savePaymentFromProviderIntent({
            collection,
            providerKey: action.providerKey,
            providerPaymentIntentId: action.paymentIntentId,
            session,
            status: getPaymentStatusFromWebhookAction(action.type),
          });
        }

        return result.actions;
      }),
    attachPaymentMethod: (input) =>
      Effect.gen(function* attachPaymentMethodEffect() {
        const accountHolder = yield* repository.findAccountHolderById(
          input.accountHolderId
        );

        if (!accountHolder) {
          return yield* new PaymentAccountHolderNotFound({
            accountHolderId: input.accountHolderId,
          });
        }

        const provider = yield* requireProvider(
          providerRegistry,
          accountHolder.providerKey
        );
        const providerMethod = yield* provider
          .attachPaymentMethod({
            correlation: providerCorrelation(
              `${accountHolder.id}:attach-payment-method:${input.providerPaymentMethodId}`
            ),
            customerId: accountHolder.providerAccountHolderId,
            providerPaymentMethodId: input.providerPaymentMethodId,
          })
          .pipe(
            Effect.mapError(() =>
              mapProviderFailure("Payment method attachment failed.")
            )
          );
        const now = clock.now();
        const method: PaymentMethod = {
          accountHolderId: input.accountHolderId,
          createdAt: now,
          displayName: providerMethod.displayName,
          id: yield* createPaymentMethodIdEffect(
            createPrefixedId(idGenerator, PAYMENT_METHOD_ID_PREFIX)
          ),
          metadata: providerMethod.metadata ?? {},
          providerKey: accountHolder.providerKey,
          providerPaymentMethodId: providerMethod.id,
          reusable: providerMethod.reusable,
          type: providerMethod.type,
          updatedAt: now,
        };

        return yield* repository.saveMethod(method);
      }),
    authorizePaymentSession: (input) =>
      Effect.gen(function* authorizePaymentSessionEffect() {
        const session = yield* requireSession(repository, input.sessionId);
        const collection = yield* requireCollection(
          repository,
          session.collectionId
        );
        const provider = yield* requireProvider(
          providerRegistry,
          session.providerKey
        );
        const method = input.paymentMethodId
          ? yield* repository.findMethodById(input.paymentMethodId)
          : null;
        const intent = yield* provider
          .createPaymentIntent({
            amount: {
              amount: session.amount,
              currencyCode: session.currencyCode,
            },
            captureMethod: "manual",
            correlation: providerCorrelation(input.idempotencyKey),
            idempotencyKey: input.idempotencyKey,
            metadata: session.metadata,
            paymentMethodId: method?.providerPaymentMethodId,
          })
          .pipe(
            Effect.mapError(() =>
              mapProviderFailure("Payment authorization failed.")
            )
          );

        return yield* savePaymentFromProviderIntent({
          collection,
          providerKey: session.providerKey,
          providerPaymentIntentId: intent.id,
          session,
          status: getPaymentStatusFromProvider(intent.status),
        });
      }),
    capturePayment: (input) =>
      Effect.gen(function* capturePaymentEffect() {
        const existing = yield* repository.findCaptureByIdempotencyKey(
          input.idempotencyKey
        );

        if (existing) {
          return existing;
        }

        const payment = yield* repository.findPaymentById(input.paymentId);

        if (!payment) {
          return yield* new PaymentNotFound({ paymentId: input.paymentId });
        }

        const amount = input.amount ?? payment.amount;

        if (amount > payment.amount) {
          return yield* new PaymentValidationFailure({
            message: `Capture amount ${amount} exceeds authorized payment amount ${payment.amount}.`,
          });
        }

        const provider = yield* requireProvider(
          providerRegistry,
          payment.providerKey
        );
        const providerIntent = yield* provider
          .capturePaymentIntent({
            amount: {
              amount,
              currencyCode: payment.currencyCode,
            },
            correlation: providerCorrelation(input.idempotencyKey),
            idempotencyKey: input.idempotencyKey,
            paymentIntentId: payment.providerPaymentIntentId,
          })
          .pipe(
            Effect.mapError(() => mapProviderFailure("Payment capture failed."))
          );
        const capture: PaymentCapture = {
          amount,
          createdAt: clock.now(),
          currencyCode: payment.currencyCode,
          id: yield* createPaymentCaptureIdEffect(
            createPrefixedId(idGenerator, PAYMENT_CAPTURE_ID_PREFIX)
          ),
          idempotencyKey: input.idempotencyKey,
          paymentId: payment.id,
          providerCaptureId: providerIntent.id,
          status:
            providerIntent.status === "captured" ? "succeeded" : "pending",
        };

        yield* repository.savePayment({
          ...payment,
          status: amount < payment.amount ? "partially-captured" : "captured",
          updatedAt: clock.now(),
        });
        yield* updateCollectionStatus(
          yield* requireCollection(repository, payment.collectionId),
          amount < payment.amount ? "partially-captured" : "captured"
        );

        return yield* repository.saveCapture(capture);
      }),
    createAccountHolder: (input) =>
      Effect.gen(function* createAccountHolderEffect() {
        const provider = yield* requireProvider(
          providerRegistry,
          input.providerKey
        );
        const providerCustomer = yield* provider
          .createCustomer({
            correlation: providerCorrelation(
              `account-holder:${input.providerKey}:${
                input.email ?? input.name ?? "anonymous"
              }`
            ),
            email: input.email,
            metadata: input.metadata,
            name: input.name,
          })
          .pipe(
            Effect.mapError(() =>
              mapProviderFailure("Payment account holder creation failed.")
            )
          );
        const existing = yield* repository.findAccountHolderByProviderId({
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
          id: yield* createPaymentAccountHolderIdEffect(
            createPrefixedId(idGenerator, PAYMENT_ACCOUNT_HOLDER_ID_PREFIX)
          ),
          metadata: input.metadata ?? {},
          providerAccountHolderId: providerCustomer.id,
          providerKey: input.providerKey,
          updatedAt: now,
        };

        return yield* repository.saveAccountHolder(accountHolder);
      }),
    createCollection: (input) =>
      Effect.gen(function* createPaymentCollectionEffect() {
        const now = clock.now();
        const collection: PaymentCollection = {
          amount: input.amount,
          cartId: input.cartId,
          createdAt: now,
          currencyCode: normalizeCurrencyCode(input.currencyCode),
          id: yield* createPaymentCollectionIdEffect(
            createPrefixedId(idGenerator, PAYMENT_COLLECTION_ID_PREFIX)
          ),
          metadata: input.metadata ?? {},
          status: "pending",
          updatedAt: now,
        };

        return yield* repository.saveCollection(collection);
      }),
    createSession: (input) =>
      Effect.gen(function* createPaymentSessionEffect() {
        const collection = yield* requireCollection(
          repository,
          input.collectionId
        );
        const provider = yield* requireProvider(
          providerRegistry,
          input.providerKey
        );
        const accountHolder = input.accountHolderId
          ? yield* repository.findAccountHolderById(input.accountHolderId)
          : null;
        const checkoutSession =
          input.successUrl && input.cancelUrl
            ? yield* provider
                .createCheckoutSession({
                  amount: {
                    amount: collection.amount,
                    currencyCode: collection.currencyCode,
                  },
                  cancelUrl: input.cancelUrl,
                  correlation: providerCorrelation(input.idempotencyKey),
                  customerId: accountHolder?.providerAccountHolderId,
                  idempotencyKey: input.idempotencyKey,
                  metadata: input.metadata,
                  mode: "payment",
                  successUrl: input.successUrl,
                })
                .pipe(
                  Effect.mapError(() =>
                    mapProviderFailure(
                      "Payment checkout session creation failed."
                    )
                  )
                )
            : null;
        const now = clock.now();
        const session: PaymentSession = {
          amount: collection.amount,
          collectionId: collection.id,
          createdAt: now,
          currencyCode: collection.currencyCode,
          id: yield* createPaymentSessionIdEffect(
            createPrefixedId(idGenerator, PAYMENT_SESSION_ID_PREFIX)
          ),
          metadata: input.metadata ?? {},
          providerCheckoutSessionId: checkoutSession?.id,
          providerKey: input.providerKey,
          providerPaymentIntentId: checkoutSession?.paymentIntentId,
          status: "pending",
          updatedAt: now,
        };

        return yield* repository.saveSession(session);
      }),
    getCollectionDetail: (id) =>
      Effect.gen(function* getPaymentCollectionDetailEffect() {
        const collection = yield* repository.findCollectionById(id);

        if (!collection) {
          return null;
        }

        const [payments, sessions] = yield* Effect.all([
          repository.listPaymentsForCollection(id),
          repository.listSessionsForCollection(id),
        ]);

        return {
          collection,
          payments,
          sessions,
        };
      }),
    listCollections: repository.listCollections,
    parseProviderWebhook: ({ headers, payload, providerKey }) =>
      Effect.gen(function* parsePaymentProviderWebhookEffect() {
        const provider = yield* requireProvider(providerRegistry, providerKey);
        const result = yield* provider
          .parseWebhook({
            correlation: correlationContextFromHeaders(
              headers,
              `webhook:${providerKey}`
            ),
            headers,
            payload,
          })
          .pipe(
            Effect.mapError(() =>
              mapProviderFailure("Payment webhook parsing failed.")
            )
          );

        return mapProviderEventsToPaymentActions(result.events);
      }),
    refundPayment: (input) =>
      Effect.gen(function* refundPaymentEffect() {
        const existing = yield* repository.findRefundByIdempotencyKey(
          input.idempotencyKey
        );

        if (existing) {
          return existing;
        }

        const payment = yield* repository.findPaymentById(input.paymentId);

        if (!payment) {
          return yield* new PaymentNotFound({ paymentId: input.paymentId });
        }

        const amount = input.amount ?? payment.amount;

        if (amount > payment.amount) {
          return yield* new PaymentValidationFailure({
            message: `Refund amount ${amount} exceeds payment amount ${payment.amount}.`,
          });
        }

        const provider = yield* requireProvider(
          providerRegistry,
          payment.providerKey
        );
        const providerRefund = yield* provider
          .refundPayment({
            amount: {
              amount,
              currencyCode: payment.currencyCode,
            },
            correlation: providerCorrelation(input.idempotencyKey),
            idempotencyKey: input.idempotencyKey,
            paymentIntentId: payment.providerPaymentIntentId,
            reason: input.reason,
          })
          .pipe(
            Effect.mapError(() => mapProviderFailure("Payment refund failed."))
          );
        const refund: PaymentRefund = {
          amount,
          createdAt: clock.now(),
          currencyCode: payment.currencyCode,
          id: yield* createPaymentRefundIdEffect(
            createPrefixedId(idGenerator, PAYMENT_REFUND_ID_PREFIX)
          ),
          idempotencyKey: input.idempotencyKey,
          paymentId: payment.id,
          providerRefundId: providerRefund.id,
          reason: input.reason,
          status: providerRefund.status,
        };

        yield* updateCollectionStatus(
          yield* requireCollection(repository, payment.collectionId),
          amount < payment.amount ? "partially-refunded" : "refunded"
        );

        return yield* repository.saveRefund(refund);
      }),
    registerProvider: (providerKey) =>
      Effect.gen(function* registerPaymentProviderEffect() {
        const provider = yield* requireProvider(providerRegistry, providerKey);
        const now = clock.now();
        const record: PaymentProviderRecord = {
          createdAt: now,
          id: yield* createPaymentProviderRecordIdEffect(
            createPrefixedId(idGenerator, PAYMENT_PROVIDER_RECORD_ID_PREFIX)
          ),
          isEnabled: true,
          providerKey,
          providerRecordId: provider.id,
          updatedAt: now,
        };

        return yield* repository.saveProviderRecord(record);
      }),
  };
};

export const defaultPaymentService = createPaymentService();

export const createPaymentServiceLayer = (
  options: CreatePaymentServiceOptions
) => Layer.succeed(PaymentService, createPaymentService(options));

export const PaymentServiceLayer = Layer.effect(
  PaymentService,
  Effect.gen(function* createPaymentServiceLayerEffect() {
    const clock = yield* ClockService;
    const idGenerator = yield* IdGeneratorService;
    const repository = yield* PaymentRepositoryService;
    return createPaymentService({ clock, idGenerator, repository });
  })
);

export const createPaymentServiceWithProviders = (
  options: Omit<CreatePaymentServiceOptions, "providerRegistry"> & {
    readonly providers: Parameters<typeof createPaymentProviderRegistry>[0];
  }
) =>
  createPaymentService({
    ...options,
    providerRegistry: createPaymentProviderRegistry(options.providers),
  });

/**
 * Temporary Promise facade until checkout consumes PaymentService effects
 * directly.
 */
export const createPaymentPromiseServiceFromEffectService = (
  service: PaymentServiceShape
) => ({
  authorizePaymentSession: (input: AuthorizePaymentSessionInput) =>
    Effect.runPromise(service.authorizePaymentSession(input)),
  capturePayment: (input: CapturePaymentInput) =>
    Effect.runPromise(service.capturePayment(input)),
  createCollection: (input: CreatePaymentCollectionInput) =>
    Effect.runPromise(service.createCollection(input)),
  createSession: (input: CreatePaymentSessionInput) =>
    Effect.runPromise(service.createSession(input)),
});
