import {
  PaymentService,
  PaymentValidationFailure,
  paymentPermissions,
  serializePaymentAccountHolderId,
  serializePaymentCaptureId,
  serializePaymentCollectionId,
  serializePaymentId,
  serializePaymentMethodId,
  serializePaymentProviderRecordId,
  serializePaymentRefundId,
  serializePaymentSessionId,
} from "@ecommerce/payment";
import type {
  Payment,
  PaymentAccountHolder,
  PaymentAccountHolderApiRecord,
  PaymentApiRecord,
  PaymentCapture,
  PaymentCaptureApiRecord,
  PaymentCollection,
  PaymentCollectionApiRecord,
  PaymentCollectionDetail,
  PaymentCollectionDetailApiRecord,
  PaymentMethod,
  PaymentMethodApiRecord,
  PaymentProviderApiRecord,
  PaymentProviderRecord,
  PaymentRefund,
  PaymentRefundApiRecord,
  PaymentSession,
  PaymentSessionApiRecord,
} from "@ecommerce/payment";
import { Effect } from "effect";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import {
  defineAdminHttpApiGroupContribution,
  defineEffectHttpApiModuleContribution,
} from "./effect-http-api";
import {
  CurrentEffectHttpRequestContext,
  withEffectHttpPermission,
} from "./effect-http-middleware";
import type { EffectHttpRequestIdentity } from "./effect-http-middleware";
import { paymentAdminHttpApiGroup } from "./payment-effect-http-contract";

const serializeProviderRecord = (
  record: PaymentProviderRecord
): PaymentProviderApiRecord => ({
  createdAt: record.createdAt.toISOString(),
  id: serializePaymentProviderRecordId(record.id),
  isEnabled: record.isEnabled,
  providerKey: record.providerKey,
  providerRecordId: record.providerRecordId,
  updatedAt: record.updatedAt.toISOString(),
});

const serializeAccountHolder = (
  record: PaymentAccountHolder
): PaymentAccountHolderApiRecord => ({
  createdAt: record.createdAt.toISOString(),
  customerId: record.customerId,
  email: record.email,
  id: serializePaymentAccountHolderId(record.id),
  metadata: record.metadata,
  providerAccountHolderId: record.providerAccountHolderId,
  providerKey: record.providerKey,
  updatedAt: record.updatedAt.toISOString(),
});

const serializeMethod = (record: PaymentMethod): PaymentMethodApiRecord => ({
  accountHolderId: record.accountHolderId
    ? serializePaymentAccountHolderId(record.accountHolderId)
    : undefined,
  createdAt: record.createdAt.toISOString(),
  displayName: record.displayName,
  id: serializePaymentMethodId(record.id),
  metadata: record.metadata,
  providerKey: record.providerKey,
  providerPaymentMethodId: record.providerPaymentMethodId,
  reusable: record.reusable,
  type: record.type,
  updatedAt: record.updatedAt.toISOString(),
});

const serializeCollection = (
  record: PaymentCollection
): PaymentCollectionApiRecord => ({
  amount: record.amount,
  cartId: record.cartId,
  createdAt: record.createdAt.toISOString(),
  currencyCode: record.currencyCode,
  id: serializePaymentCollectionId(record.id),
  metadata: record.metadata,
  status: record.status,
  updatedAt: record.updatedAt.toISOString(),
});

const serializeSession = (record: PaymentSession): PaymentSessionApiRecord => ({
  amount: record.amount,
  collectionId: serializePaymentCollectionId(record.collectionId),
  createdAt: record.createdAt.toISOString(),
  currencyCode: record.currencyCode,
  id: serializePaymentSessionId(record.id),
  metadata: record.metadata,
  providerCheckoutSessionId: record.providerCheckoutSessionId,
  providerKey: record.providerKey,
  providerPaymentIntentId: record.providerPaymentIntentId,
  status: record.status,
  updatedAt: record.updatedAt.toISOString(),
});

const serializePayment = (record: Payment): PaymentApiRecord => ({
  amount: record.amount,
  collectionId: serializePaymentCollectionId(record.collectionId),
  createdAt: record.createdAt.toISOString(),
  currencyCode: record.currencyCode,
  id: serializePaymentId(record.id),
  metadata: record.metadata,
  providerKey: record.providerKey,
  providerPaymentIntentId: record.providerPaymentIntentId,
  sessionId: serializePaymentSessionId(record.sessionId),
  status: record.status,
  updatedAt: record.updatedAt.toISOString(),
});

const serializeCapture = (record: PaymentCapture): PaymentCaptureApiRecord => ({
  amount: record.amount,
  createdAt: record.createdAt.toISOString(),
  currencyCode: record.currencyCode,
  id: serializePaymentCaptureId(record.id),
  idempotencyKey: record.idempotencyKey,
  paymentId: serializePaymentId(record.paymentId),
  providerCaptureId: record.providerCaptureId,
  status: record.status,
});

const serializeRefund = (record: PaymentRefund): PaymentRefundApiRecord => ({
  amount: record.amount,
  createdAt: record.createdAt.toISOString(),
  currencyCode: record.currencyCode,
  id: serializePaymentRefundId(record.id),
  idempotencyKey: record.idempotencyKey,
  paymentId: serializePaymentId(record.paymentId),
  providerRefundId: record.providerRefundId,
  reason: record.reason,
  status: record.status,
});

const serializeDetail = (
  detail: PaymentCollectionDetail
): PaymentCollectionDetailApiRecord => ({
  ...serializeCollection(detail.collection),
  payments: detail.payments.map(serializePayment),
  sessions: detail.sessions.map(serializeSession),
});

const withSuccessEnvelope = <TData>(
  data: TData,
  request: EffectHttpRequestIdentity
) =>
  ({
    data,
    meta: { request },
    success: true,
  }) as const;

const withCurrentRequest = <TData, TError, TRequirements>(
  effect: Effect.Effect<TData, TError, TRequirements>
) =>
  Effect.gen(function* createPaymentApiSuccessEnvelope() {
    const context = yield* CurrentEffectHttpRequestContext;
    const data = yield* effect;
    return withSuccessEnvelope(data, context.identity);
  });

const paymentAdminGroupIdentifier = "paymentAdmin";
const paymentAdminHttpApi = HttpApi.make("PaymentAdminApi").add(
  paymentAdminHttpApiGroup
);

export const paymentAdminHttpApiHandlers = HttpApiBuilder.group(
  paymentAdminHttpApi,
  paymentAdminGroupIdentifier,
  (handlers) =>
    handlers
      .handle("paymentProviderRegister", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PaymentService.use((service) =>
              service
                .registerProvider(payload.providerKey)
                .pipe(Effect.map(serializeProviderRecord))
            )
          ),
          paymentPermissions.write
        )
      )
      .handle("paymentAccountHolderCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PaymentService.use((service) =>
              service
                .createAccountHolder(payload)
                .pipe(Effect.map(serializeAccountHolder))
            )
          ),
          paymentPermissions.write
        )
      )
      .handle("paymentMethodAttach", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PaymentService.use((service) =>
              service
                .attachPaymentMethod(payload)
                .pipe(Effect.map(serializeMethod))
            )
          ),
          paymentPermissions.write
        )
      )
      .handle("paymentCollectionCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PaymentService.use((service) =>
              service.createCollection(payload).pipe(
                Effect.flatMap((collection) =>
                  service.getCollectionDetail(collection.id)
                ),
                Effect.flatMap((detail) =>
                  detail
                    ? Effect.succeed(serializeDetail(detail))
                    : Effect.fail(
                        new PaymentValidationFailure({
                          message: "Payment collection detail was not created.",
                        })
                      )
                )
              )
            )
          ),
          paymentPermissions.write
        )
      )
      .handle("paymentCollectionGet", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PaymentService.use((service) =>
              service
                .getCollectionDetail(payload.id)
                .pipe(
                  Effect.map((detail) =>
                    detail ? serializeDetail(detail) : null
                  )
                )
            )
          ),
          paymentPermissions.read
        )
      )
      .handle("paymentCollectionList", () =>
        withEffectHttpPermission(
          withCurrentRequest(
            PaymentService.use((service) =>
              service.listCollections.pipe(
                Effect.map((collections) =>
                  collections.map(serializeCollection)
                )
              )
            )
          ),
          paymentPermissions.read
        )
      )
      .handle("paymentSessionCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PaymentService.use((service) =>
              service.createSession(payload).pipe(Effect.map(serializeSession))
            )
          ),
          paymentPermissions.write
        )
      )
      .handle("paymentAuthorizeSession", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PaymentService.use((service) =>
              service
                .authorizePaymentSession(payload)
                .pipe(Effect.map(serializePayment))
            )
          ),
          paymentPermissions.write
        )
      )
      .handle("paymentCapture", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PaymentService.use((service) =>
              service.capturePayment(payload).pipe(Effect.map(serializeCapture))
            )
          ),
          paymentPermissions.write
        )
      )
      .handle("paymentRefund", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PaymentService.use((service) =>
              service.refundPayment(payload).pipe(Effect.map(serializeRefund))
            )
          ),
          paymentPermissions.write
        )
      )
      .handle("paymentWebhookParse", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PaymentService.use((service) =>
              service.parseProviderWebhook(payload)
            )
          ),
          paymentPermissions.write
        )
      )
);

export const paymentEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineAdminHttpApiGroupContribution({
        group: paymentAdminHttpApiGroup,
        handlers: paymentAdminHttpApiHandlers,
        key: "module:payment.admin",
        owner: "module",
      }),
    ],
    moduleName: "payment",
  });
