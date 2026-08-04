import type { RepositoryFailure } from "@ecommerce/core";
/* eslint-disable max-classes-per-file -- payment expected failures form one schema-backed domain vocabulary */
import { Schema } from "effect";

import {
  PaymentAccountHolderIdSchema,
  PaymentIdSchema,
  PaymentMethodIdSchema,
  PaymentSessionIdSchema,
  PaymentTrimmedStringSchema,
} from "./payment.schema";

export class PaymentInvalidIdentifier extends Schema.TaggedErrorClass<PaymentInvalidIdentifier>()(
  "PaymentInvalidIdentifier",
  {
    expectedPrefix: PaymentTrimmedStringSchema,
    value: Schema.String,
  }
) {}

export class PaymentAccountHolderNotFound extends Schema.TaggedErrorClass<PaymentAccountHolderNotFound>()(
  "PaymentAccountHolderNotFound",
  {
    accountHolderId: PaymentAccountHolderIdSchema,
  }
) {}

export class PaymentMethodNotFound extends Schema.TaggedErrorClass<PaymentMethodNotFound>()(
  "PaymentMethodNotFound",
  {
    paymentMethodId: PaymentMethodIdSchema,
  }
) {}

export class PaymentNotFound extends Schema.TaggedErrorClass<PaymentNotFound>()(
  "PaymentNotFound",
  {
    paymentId: PaymentIdSchema,
  }
) {}

export class PaymentProviderUnavailable extends Schema.TaggedErrorClass<PaymentProviderUnavailable>()(
  "PaymentProviderUnavailable",
  {
    providerKey: PaymentTrimmedStringSchema,
  }
) {}

export class PaymentSessionNotFound extends Schema.TaggedErrorClass<PaymentSessionNotFound>()(
  "PaymentSessionNotFound",
  {
    sessionId: PaymentSessionIdSchema,
  }
) {}

export class PaymentValidationFailure extends Schema.TaggedErrorClass<PaymentValidationFailure>()(
  "PaymentValidationFailure",
  {
    message: PaymentTrimmedStringSchema,
  }
) {}

export type PaymentExpectedError =
  | PaymentAccountHolderNotFound
  | PaymentInvalidIdentifier
  | PaymentMethodNotFound
  | PaymentNotFound
  | PaymentProviderUnavailable
  | PaymentSessionNotFound
  | PaymentValidationFailure
  | RepositoryFailure;
