import {
  EffectHttpAuthMiddleware,
  EffectHttpExecutionMiddleware,
  EffectHttpForbidden,
  EffectHttpRequestContextMiddleware,
} from "@ecommerce/api/effect-http-middleware";
import { createApiSuccessSchema } from "@ecommerce/api/http-api-schemas";
import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import {
  AttachPaymentMethodInputSchema,
  AuthorizePaymentSessionInputSchema,
  CapturePaymentInputSchema,
  CreatePaymentAccountHolderInputSchema,
  CreatePaymentCollectionInputSchema,
  CreatePaymentSessionInputSchema,
  PaymentAccountHolderApiSchema,
  PaymentAccountHolderNotFound,
  PaymentApiSchema,
  PaymentCaptureApiSchema,
  PaymentCollectionDetailApiSchema,
  PaymentCollectionIdentifierSchema,
  PaymentInvalidIdentifier,
  PaymentListApiSchema,
  PaymentMethodApiSchema,
  PaymentMethodNotFound,
  PaymentNotFound,
  PaymentProviderApiRecordSchema,
  PaymentProviderUnavailable,
  PaymentRefundApiSchema,
  PaymentSessionApiSchema,
  PaymentSessionNotFound,
  PaymentValidationFailure,
  PaymentWebhookActionResultSchema,
  PaymentWebhookInputSchema,
  RefundPaymentInputSchema,
} from "../domain";

const paymentDomainErrors = [
  PaymentAccountHolderNotFound.pipe(HttpApiSchema.status(404)),
  PaymentInvalidIdentifier.pipe(HttpApiSchema.status(400)),
  PaymentMethodNotFound.pipe(HttpApiSchema.status(404)),
  PaymentNotFound.pipe(HttpApiSchema.status(404)),
  PaymentProviderUnavailable.pipe(HttpApiSchema.status(400)),
  PaymentSessionNotFound.pipe(HttpApiSchema.status(404)),
  PaymentValidationFailure.pipe(HttpApiSchema.status(400)),
] as const;

const paymentPersistenceErrors = [
  RepositoryConflict.pipe(HttpApiSchema.status(409)),
  RepositoryDecodeFailure.pipe(HttpApiSchema.status(503)),
  RepositoryUnavailable.pipe(HttpApiSchema.status(503)),
] as const;

/** Declared HTTP error schemas for this module contract surface. */
export const paymentReadErrors = [
  EffectHttpForbidden,
  ...paymentDomainErrors,
  ...paymentPersistenceErrors,
] as const;

/** Declared HTTP error schemas for this module contract surface. */
export const paymentWriteErrors = [
  EffectHttpForbidden,
  ...paymentDomainErrors,
  ...paymentPersistenceErrors,
] as const;

const RegisterPaymentProviderInputSchema = Schema.Struct({
  providerKey: Schema.NonEmptyString,
});

/** Success envelope schema exported for contract-only API consumers. */
export const PaymentProviderRecordSuccessSchema = createApiSuccessSchema(
  PaymentProviderApiRecordSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const PaymentAccountHolderSuccessSchema = createApiSuccessSchema(
  PaymentAccountHolderApiSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const PaymentMethodSuccessSchema = createApiSuccessSchema(
  PaymentMethodApiSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const PaymentCollectionDetailSuccessSchema = createApiSuccessSchema(
  PaymentCollectionDetailApiSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const PaymentCollectionListSuccessSchema =
  createApiSuccessSchema(PaymentListApiSchema);
/** Success envelope schema exported for contract-only API consumers. */
export const PaymentSessionSuccessSchema = createApiSuccessSchema(
  PaymentSessionApiSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const PaymentSuccessSchema = createApiSuccessSchema(PaymentApiSchema);
/** Success envelope schema exported for contract-only API consumers. */
export const PaymentCaptureSuccessSchema = createApiSuccessSchema(
  PaymentCaptureApiSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const PaymentRefundSuccessSchema = createApiSuccessSchema(
  PaymentRefundApiSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const PaymentWebhookActionResultSuccessSchema = createApiSuccessSchema(
  PaymentWebhookActionResultSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const PaymentCollectionDetailNullableSuccessSchema =
  createApiSuccessSchema(Schema.NullOr(PaymentCollectionDetailApiSchema));

const paymentAdminGroupIdentifier = "paymentAdmin";

/** Payment admin Effect HTTP contract for collections, sessions, captures, refunds, providers, and webhooks. */
export const paymentAdminHttpApiGroup = HttpApiGroup.make(
  paymentAdminGroupIdentifier
)
  .add(
    HttpApiEndpoint.post(
      "paymentProviderRegister",
      "/admin/payments/providers",
      {
        error: paymentWriteErrors,
        payload: RegisterPaymentProviderInputSchema,
        success: PaymentProviderRecordSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "paymentAccountHolderCreate",
      "/admin/payments/account-holders",
      {
        error: paymentWriteErrors,
        payload: CreatePaymentAccountHolderInputSchema,
        success: PaymentAccountHolderSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "paymentMethodAttach",
      "/admin/payments/account-holders/methods",
      {
        error: paymentWriteErrors,
        payload: AttachPaymentMethodInputSchema,
        success: PaymentMethodSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "paymentCollectionCreate",
      "/admin/payments/collections",
      {
        error: paymentWriteErrors,
        payload: CreatePaymentCollectionInputSchema,
        success: PaymentCollectionDetailSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post("paymentCollectionGet", "/admin/payments/collection", {
      error: paymentReadErrors,
      payload: PaymentCollectionIdentifierSchema,
      success: PaymentCollectionDetailNullableSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.get(
      "paymentCollectionList",
      "/admin/payments/collections",
      {
        error: paymentReadErrors,
        success: PaymentCollectionListSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post("paymentSessionCreate", "/admin/payments/sessions", {
      error: paymentWriteErrors,
      payload: CreatePaymentSessionInputSchema,
      success: PaymentSessionSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "paymentAuthorizeSession",
      "/admin/payments/sessions/authorize",
      {
        error: paymentWriteErrors,
        payload: AuthorizePaymentSessionInputSchema,
        success: PaymentSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post("paymentCapture", "/admin/payments/captures", {
      error: paymentWriteErrors,
      payload: CapturePaymentInputSchema,
      success: PaymentCaptureSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("paymentRefund", "/admin/payments/refunds", {
      error: paymentWriteErrors,
      payload: RefundPaymentInputSchema,
      success: PaymentRefundSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "paymentWebhookParse",
      "/admin/payments/providers/webhooks/parse",
      {
        error: paymentWriteErrors,
        payload: PaymentWebhookInputSchema,
        success: PaymentWebhookActionResultSuccessSchema,
      }
    )
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);
