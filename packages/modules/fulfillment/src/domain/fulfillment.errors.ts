import type { RepositoryFailure } from "@ecommerce/core";
/* eslint-disable max-classes-per-file -- fulfillment expected failures form one schema-backed domain vocabulary */
import { Schema } from "effect";

import {
  FulfillmentIdSchema,
  FulfillmentSetIdSchema,
  FulfillmentTrimmedStringSchema,
  ServiceZoneIdSchema,
  ShippingOptionIdSchema,
  ShippingProfileIdSchema,
} from "./fulfillment.schema";

export class FulfillmentInvalidIdentifier extends Schema.TaggedErrorClass<FulfillmentInvalidIdentifier>()(
  "FulfillmentInvalidIdentifier",
  {
    expectedPrefix: FulfillmentTrimmedStringSchema,
    value: Schema.String,
  }
) {}

export class FulfillmentSetNotFound extends Schema.TaggedErrorClass<FulfillmentSetNotFound>()(
  "FulfillmentSetNotFound",
  {
    fulfillmentSetId: FulfillmentSetIdSchema,
  }
) {}

export class ShippingProfileNotFound extends Schema.TaggedErrorClass<ShippingProfileNotFound>()(
  "ShippingProfileNotFound",
  {
    profileId: ShippingProfileIdSchema,
  }
) {}

export class ServiceZoneNotFound extends Schema.TaggedErrorClass<ServiceZoneNotFound>()(
  "ServiceZoneNotFound",
  {
    serviceZoneId: ServiceZoneIdSchema,
  }
) {}

export class ShippingOptionNotFound extends Schema.TaggedErrorClass<ShippingOptionNotFound>()(
  "ShippingOptionNotFound",
  {
    shippingOptionId: ShippingOptionIdSchema,
  }
) {}

export class FulfillmentNotFound extends Schema.TaggedErrorClass<FulfillmentNotFound>()(
  "FulfillmentNotFound",
  {
    fulfillmentId: FulfillmentIdSchema,
  }
) {}

export class FulfillmentProviderUnavailable extends Schema.TaggedErrorClass<FulfillmentProviderUnavailable>()(
  "FulfillmentProviderUnavailable",
  {
    providerKey: FulfillmentTrimmedStringSchema,
  }
) {}

export class FulfillmentValidationFailure extends Schema.TaggedErrorClass<FulfillmentValidationFailure>()(
  "FulfillmentValidationFailure",
  {
    message: FulfillmentTrimmedStringSchema,
  }
) {}

export type FulfillmentExpectedError =
  | FulfillmentInvalidIdentifier
  | FulfillmentNotFound
  | FulfillmentProviderUnavailable
  | FulfillmentSetNotFound
  | FulfillmentValidationFailure
  | RepositoryFailure
  | ServiceZoneNotFound
  | ShippingOptionNotFound
  | ShippingProfileNotFound;
