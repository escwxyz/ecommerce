import {
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  PaymentRepositoryService,
  createPaymentAccountHolderIdEffect,
  createPaymentCaptureIdEffect,
  createPaymentCollectionIdEffect,
  createPaymentIdEffect,
  createPaymentMethodIdEffect,
  createPaymentProviderRecordIdEffect,
  createPaymentRefundIdEffect,
  createPaymentSessionIdEffect,
} from "@ecommerce/payment";
import type {
  Payment,
  PaymentAccountHolder,
  PaymentCapture,
  PaymentCollection,
  PaymentMethod,
  PaymentProviderRecord,
  PaymentRefund,
  PaymentRepository,
  PaymentSession,
} from "@ecommerce/payment";
import { and, desc, eq } from "drizzle-orm";
import { Effect, Layer, Option } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import type { SqlError } from "effect/unstable/sql/SqlError";

import {
  CurrentPostgresTransactionService,
  PostgresDrizzleService,
} from "../../postgres-drizzle";
import type {
  PostgresDrizzleDatabase,
  PostgresDrizzleService as PostgresDrizzleServiceShape,
  PostgresDrizzleTransaction,
} from "../../postgres-drizzle";
import {
  postgresPayment,
  postgresPaymentAccountHolder,
  postgresPaymentCapture,
  postgresPaymentCollection,
  postgresPaymentMethod,
  postgresPaymentProvider,
  postgresPaymentRefund,
  postgresPaymentSession,
} from "./schema";

type PaymentPostgresExecutor =
  | PostgresDrizzleDatabase
  | PostgresDrizzleTransaction;

const paymentRepositoryName = "PaymentRepository";

const toRepositoryUnavailable =
  (operation: "read" | "write") => (): RepositoryUnavailable =>
    new RepositoryUnavailable({
      adapter: "effect-postgres",
      operation,
      repository: paymentRepositoryName,
    });

const toRepositoryDecodeFailure = (
  entity: string,
  operation: "read" | "write"
): RepositoryDecodeFailure =>
  new RepositoryDecodeFailure({
    entity,
    operation,
    repository: paymentRepositoryName,
  });

const getPaymentExecutor = (
  service: PostgresDrizzleServiceShape
): EffectValue<PaymentPostgresExecutor> =>
  Effect.map(
    Effect.serviceOption(CurrentPostgresTransactionService),
    Option.getOrElse(() => service.database)
  );

const toProviderRecord = (row: typeof postgresPaymentProvider.$inferSelect) =>
  Effect.gen(function* decodePaymentProviderRowEffect() {
    return {
      createdAt: row.createdAt,
      id: yield* createPaymentProviderRecordIdEffect(row.id),
      isEnabled: row.isEnabled === "true",
      providerKey: row.providerKey,
      providerRecordId: row.providerRecordId,
      updatedAt: row.updatedAt,
    } satisfies PaymentProviderRecord;
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("payment-provider", "read"))
  );

const toAccountHolder = (
  row: typeof postgresPaymentAccountHolder.$inferSelect
) =>
  Effect.gen(function* decodePaymentAccountHolderRowEffect() {
    return {
      createdAt: row.createdAt,
      customerId: row.customerId,
      email: row.email ?? undefined,
      id: yield* createPaymentAccountHolderIdEffect(row.id),
      metadata: row.metadataJson,
      providerAccountHolderId: row.providerAccountHolderId,
      providerKey: row.providerKey,
      updatedAt: row.updatedAt,
    } satisfies PaymentAccountHolder;
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("payment-account-holder", "read")
    )
  );

const toMethod = (row: typeof postgresPaymentMethod.$inferSelect) =>
  Effect.gen(function* decodePaymentMethodRowEffect() {
    return {
      accountHolderId: row.accountHolderId
        ? yield* createPaymentAccountHolderIdEffect(row.accountHolderId)
        : undefined,
      createdAt: row.createdAt,
      displayName: row.displayName ?? undefined,
      id: yield* createPaymentMethodIdEffect(row.id),
      metadata: row.metadataJson,
      providerKey: row.providerKey,
      providerPaymentMethodId: row.providerPaymentMethodId,
      reusable: row.reusable === "true",
      type: row.type,
      updatedAt: row.updatedAt,
    } satisfies PaymentMethod;
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("payment-method", "read"))
  );

const toCollection = (row: typeof postgresPaymentCollection.$inferSelect) =>
  Effect.gen(function* decodePaymentCollectionRowEffect() {
    return {
      amount: row.amount,
      cartId: row.cartId ?? undefined,
      createdAt: row.createdAt,
      currencyCode: row.currencyCode,
      id: yield* createPaymentCollectionIdEffect(row.id),
      metadata: row.metadataJson,
      status: row.status as PaymentCollection["status"],
      updatedAt: row.updatedAt,
    } satisfies PaymentCollection;
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("payment-collection", "read")
    )
  );

const toSession = (row: typeof postgresPaymentSession.$inferSelect) =>
  Effect.gen(function* decodePaymentSessionRowEffect() {
    return {
      amount: row.amount,
      collectionId: yield* createPaymentCollectionIdEffect(row.collectionId),
      createdAt: row.createdAt,
      currencyCode: row.currencyCode,
      id: yield* createPaymentSessionIdEffect(row.id),
      metadata: row.metadataJson,
      providerCheckoutSessionId: row.providerCheckoutSessionId ?? undefined,
      providerKey: row.providerKey,
      providerPaymentIntentId: row.providerPaymentIntentId ?? undefined,
      status: row.status as PaymentSession["status"],
      updatedAt: row.updatedAt,
    } satisfies PaymentSession;
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("payment-session", "read"))
  );

const toPayment = (row: typeof postgresPayment.$inferSelect) =>
  Effect.gen(function* decodePaymentRowEffect() {
    return {
      amount: row.amount,
      collectionId: yield* createPaymentCollectionIdEffect(row.collectionId),
      createdAt: row.createdAt,
      currencyCode: row.currencyCode,
      id: yield* createPaymentIdEffect(row.id),
      metadata: row.metadataJson,
      providerKey: row.providerKey,
      providerPaymentIntentId: row.providerPaymentIntentId,
      sessionId: yield* createPaymentSessionIdEffect(row.sessionId),
      status: row.status as Payment["status"],
      updatedAt: row.updatedAt,
    } satisfies Payment;
  }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("payment", "read")));

const toCapture = (row: typeof postgresPaymentCapture.$inferSelect) =>
  Effect.gen(function* decodePaymentCaptureRowEffect() {
    return {
      amount: row.amount,
      createdAt: row.createdAt,
      currencyCode: row.currencyCode,
      id: yield* createPaymentCaptureIdEffect(row.id),
      idempotencyKey: row.idempotencyKey,
      paymentId: yield* createPaymentIdEffect(row.paymentId),
      providerCaptureId: row.providerCaptureId ?? undefined,
      status: row.status as PaymentCapture["status"],
    } satisfies PaymentCapture;
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("payment-capture", "read"))
  );

const toRefund = (row: typeof postgresPaymentRefund.$inferSelect) =>
  Effect.gen(function* decodePaymentRefundRowEffect() {
    return {
      amount: row.amount,
      createdAt: row.createdAt,
      currencyCode: row.currencyCode,
      id: yield* createPaymentRefundIdEffect(row.id),
      idempotencyKey: row.idempotencyKey,
      paymentId: yield* createPaymentIdEffect(row.paymentId),
      providerRefundId: row.providerRefundId,
      reason: row.reason ?? undefined,
      status: row.status as PaymentRefund["status"],
    } satisfies PaymentRefund;
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("payment-refund", "read"))
  );

const ensureRow = <TRow>(
  rows: readonly TRow[],
  entity: string
): EffectValue<TRow, RepositoryDecodeFailure> => {
  const [row] = rows;
  return row
    ? Effect.succeed(row)
    : Effect.fail(toRepositoryDecodeFailure(entity, "write"));
};

/** Creates the PostgreSQL-backed payment repository contract implementation. */
export const createPostgresPaymentRepository = (
  service: PostgresDrizzleServiceShape
): PaymentRepository => {
  const readRows = <TRow>(
    operation: (
      executor: PaymentPostgresExecutor
    ) => EffectValue<TRow[], unknown>
  ) =>
    Effect.gen(function* readPaymentRowsEffect() {
      const executor = yield* getPaymentExecutor(service);
      return yield* operation(executor).pipe(
        Effect.mapError(toRepositoryUnavailable("read"))
      );
    });

  const writeRows = <TRow>(
    operation: (
      executor: PaymentPostgresExecutor
    ) => EffectValue<TRow[], unknown>
  ) =>
    Effect.gen(function* writePaymentRowsEffect() {
      const executor = yield* getPaymentExecutor(service);
      return yield* operation(executor).pipe(
        Effect.mapError(toRepositoryUnavailable("write"))
      );
    });

  return {
    findAccountHolderById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPaymentAccountHolder)
          .where(eq(postgresPaymentAccountHolder.id, id))
      ).pipe(
        Effect.flatMap(([row]) =>
          row ? toAccountHolder(row) : Effect.succeed(null)
        )
      ),
    findAccountHolderByProviderId: ({ providerAccountHolderId, providerKey }) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPaymentAccountHolder)
          .where(
            and(
              eq(postgresPaymentAccountHolder.providerKey, providerKey),
              eq(
                postgresPaymentAccountHolder.providerAccountHolderId,
                providerAccountHolderId
              )
            )
          )
      ).pipe(
        Effect.flatMap(([row]) =>
          row ? toAccountHolder(row) : Effect.succeed(null)
        )
      ),
    findCaptureByIdempotencyKey: (idempotencyKey) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPaymentCapture)
          .where(eq(postgresPaymentCapture.idempotencyKey, idempotencyKey))
      ).pipe(
        Effect.flatMap(([row]) => (row ? toCapture(row) : Effect.succeed(null)))
      ),
    findCollectionById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPaymentCollection)
          .where(eq(postgresPaymentCollection.id, id))
      ).pipe(
        Effect.flatMap(([row]) =>
          row ? toCollection(row) : Effect.succeed(null)
        )
      ),
    findMethodById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPaymentMethod)
          .where(eq(postgresPaymentMethod.id, id))
      ).pipe(
        Effect.flatMap(([row]) => (row ? toMethod(row) : Effect.succeed(null)))
      ),
    findPaymentById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPayment)
          .where(eq(postgresPayment.id, id))
      ).pipe(
        Effect.flatMap(([row]) => (row ? toPayment(row) : Effect.succeed(null)))
      ),
    findPaymentByProviderIntent: ({ providerKey, providerPaymentIntentId }) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPayment)
          .where(
            and(
              eq(postgresPayment.providerKey, providerKey),
              eq(
                postgresPayment.providerPaymentIntentId,
                providerPaymentIntentId
              )
            )
          )
      ).pipe(
        Effect.flatMap(([row]) => (row ? toPayment(row) : Effect.succeed(null)))
      ),
    findRefundByIdempotencyKey: (idempotencyKey) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPaymentRefund)
          .where(eq(postgresPaymentRefund.idempotencyKey, idempotencyKey))
      ).pipe(
        Effect.flatMap(([row]) => (row ? toRefund(row) : Effect.succeed(null)))
      ),
    findSessionById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPaymentSession)
          .where(eq(postgresPaymentSession.id, id))
      ).pipe(
        Effect.flatMap(([row]) => (row ? toSession(row) : Effect.succeed(null)))
      ),
    findSessionByProviderIntent: ({ providerKey, providerPaymentIntentId }) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPaymentSession)
          .where(
            and(
              eq(postgresPaymentSession.providerKey, providerKey),
              eq(
                postgresPaymentSession.providerPaymentIntentId,
                providerPaymentIntentId
              )
            )
          )
      ).pipe(
        Effect.flatMap(([row]) => (row ? toSession(row) : Effect.succeed(null)))
      ),
    listCollections: readRows((executor) =>
      executor
        .select()
        .from(postgresPaymentCollection)
        .orderBy(desc(postgresPaymentCollection.createdAt))
    ).pipe(
      Effect.flatMap((rows) => Effect.all(rows.map((row) => toCollection(row))))
    ),
    listPaymentsForCollection: (collectionId) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPayment)
          .where(eq(postgresPayment.collectionId, collectionId))
          .orderBy(desc(postgresPayment.createdAt))
      ).pipe(
        Effect.flatMap((rows) => Effect.all(rows.map((row) => toPayment(row))))
      ),
    listSessionsForCollection: (collectionId) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPaymentSession)
          .where(eq(postgresPaymentSession.collectionId, collectionId))
          .orderBy(desc(postgresPaymentSession.createdAt))
      ).pipe(
        Effect.flatMap((rows) => Effect.all(rows.map((row) => toSession(row))))
      ),
    saveAccountHolder: (accountHolder) =>
      writeRows((executor) =>
        executor
          .insert(postgresPaymentAccountHolder)
          .values({
            createdAt: accountHolder.createdAt,
            customerId: accountHolder.customerId,
            email: accountHolder.email ?? null,
            id: accountHolder.id,
            metadataJson: accountHolder.metadata,
            providerAccountHolderId: accountHolder.providerAccountHolderId,
            providerKey: accountHolder.providerKey,
            updatedAt: accountHolder.updatedAt,
          })
          .onConflictDoUpdate({
            set: {
              email: accountHolder.email ?? null,
              metadataJson: accountHolder.metadata,
              updatedAt: accountHolder.updatedAt,
            },
            target: postgresPaymentAccountHolder.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "payment-account-holder")),
        Effect.flatMap(toAccountHolder)
      ),
    saveCapture: (capture) =>
      writeRows((executor) =>
        executor
          .insert(postgresPaymentCapture)
          .values({
            amount: capture.amount,
            createdAt: capture.createdAt,
            currencyCode: capture.currencyCode,
            id: capture.id,
            idempotencyKey: capture.idempotencyKey,
            paymentId: capture.paymentId,
            providerCaptureId: capture.providerCaptureId ?? null,
            status: capture.status,
          })
          .onConflictDoUpdate({
            set: { status: capture.status },
            target: postgresPaymentCapture.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "payment-capture")),
        Effect.flatMap(toCapture)
      ),
    saveCollection: (collection) =>
      writeRows((executor) =>
        executor
          .insert(postgresPaymentCollection)
          .values({
            amount: collection.amount,
            cartId: collection.cartId ?? null,
            createdAt: collection.createdAt,
            currencyCode: collection.currencyCode,
            id: collection.id,
            metadataJson: collection.metadata,
            status: collection.status,
            updatedAt: collection.updatedAt,
          })
          .onConflictDoUpdate({
            set: {
              metadataJson: collection.metadata,
              status: collection.status,
              updatedAt: collection.updatedAt,
            },
            target: postgresPaymentCollection.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "payment-collection")),
        Effect.flatMap(toCollection)
      ),
    saveMethod: (method) =>
      writeRows((executor) =>
        executor
          .insert(postgresPaymentMethod)
          .values({
            accountHolderId: method.accountHolderId ?? null,
            createdAt: method.createdAt,
            displayName: method.displayName ?? null,
            id: method.id,
            metadataJson: method.metadata,
            providerKey: method.providerKey,
            providerPaymentMethodId: method.providerPaymentMethodId,
            reusable: method.reusable ? "true" : "false",
            type: method.type,
            updatedAt: method.updatedAt,
          })
          .onConflictDoUpdate({
            set: {
              displayName: method.displayName ?? null,
              metadataJson: method.metadata,
              reusable: method.reusable ? "true" : "false",
              updatedAt: method.updatedAt,
            },
            target: postgresPaymentMethod.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "payment-method")),
        Effect.flatMap(toMethod)
      ),
    savePayment: (payment) =>
      writeRows((executor) =>
        executor
          .insert(postgresPayment)
          .values({
            amount: payment.amount,
            collectionId: payment.collectionId,
            createdAt: payment.createdAt,
            currencyCode: payment.currencyCode,
            id: payment.id,
            metadataJson: payment.metadata,
            providerKey: payment.providerKey,
            providerPaymentIntentId: payment.providerPaymentIntentId,
            sessionId: payment.sessionId,
            status: payment.status,
            updatedAt: payment.updatedAt,
          })
          .onConflictDoUpdate({
            set: {
              metadataJson: payment.metadata,
              status: payment.status,
              updatedAt: payment.updatedAt,
            },
            target: postgresPayment.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "payment")),
        Effect.flatMap(toPayment)
      ),
    saveProviderRecord: (providerRecord) =>
      writeRows((executor) =>
        executor
          .insert(postgresPaymentProvider)
          .values({
            createdAt: providerRecord.createdAt,
            id: providerRecord.id,
            isEnabled: providerRecord.isEnabled ? "true" : "false",
            providerKey: providerRecord.providerKey,
            providerRecordId: providerRecord.providerRecordId,
            updatedAt: providerRecord.updatedAt,
          })
          .onConflictDoUpdate({
            set: {
              isEnabled: providerRecord.isEnabled ? "true" : "false",
              updatedAt: providerRecord.updatedAt,
            },
            target: postgresPaymentProvider.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "payment-provider")),
        Effect.flatMap(toProviderRecord)
      ),
    saveRefund: (refund) =>
      writeRows((executor) =>
        executor
          .insert(postgresPaymentRefund)
          .values({
            amount: refund.amount,
            createdAt: refund.createdAt,
            currencyCode: refund.currencyCode,
            id: refund.id,
            idempotencyKey: refund.idempotencyKey,
            paymentId: refund.paymentId,
            providerRefundId: refund.providerRefundId,
            reason: refund.reason ?? null,
            status: refund.status,
          })
          .onConflictDoUpdate({
            set: { status: refund.status },
            target: postgresPaymentRefund.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "payment-refund")),
        Effect.flatMap(toRefund)
      ),
    saveSession: (session) =>
      writeRows((executor) =>
        executor
          .insert(postgresPaymentSession)
          .values({
            amount: session.amount,
            collectionId: session.collectionId,
            createdAt: session.createdAt,
            currencyCode: session.currencyCode,
            id: session.id,
            metadataJson: session.metadata,
            providerCheckoutSessionId:
              session.providerCheckoutSessionId ?? null,
            providerKey: session.providerKey,
            providerPaymentIntentId: session.providerPaymentIntentId ?? null,
            status: session.status,
            updatedAt: session.updatedAt,
          })
          .onConflictDoUpdate({
            set: {
              metadataJson: session.metadata,
              providerCheckoutSessionId:
                session.providerCheckoutSessionId ?? null,
              providerPaymentIntentId: session.providerPaymentIntentId ?? null,
              status: session.status,
              updatedAt: session.updatedAt,
            },
            target: postgresPaymentSession.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "payment-session")),
        Effect.flatMap(toSession)
      ),
  };
};

export const PostgresPaymentRepositoryLayer = Layer.effect(
  PaymentRepositoryService,
  PostgresDrizzleService.pipe(Effect.map(createPostgresPaymentRepository))
);

export const createPostgresPaymentRepositoryLayer = (
  service: PostgresDrizzleServiceShape
) =>
  Layer.succeed(
    PaymentRepositoryService,
    createPostgresPaymentRepository(service)
  );

export const withPostgresPaymentTransaction = <TValue, TError, TRequirements>(
  effect: EffectValue<TValue, TError, TRequirements>
): EffectValue<
  TValue,
  SqlError | TError,
  TRequirements | PostgresDrizzleServiceShape
> =>
  PostgresDrizzleService.use((service) =>
    service.withTransaction(() => effect)
  );
