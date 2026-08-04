import type { RepositoryFailure } from "@ecommerce/core";
/* eslint-disable max-classes-per-file -- pricing expected failures form one schema-backed domain vocabulary */
import { Schema } from "effect";

import {
  CurrencyCodeSchema,
  PriceListIdSchema,
  PriceSetIdSchema,
  PricingTrimmedStringSchema,
} from "./pricing.schema";

export class PricingInvalidIdentifier extends Schema.TaggedErrorClass<PricingInvalidIdentifier>()(
  "PricingInvalidIdentifier",
  {
    expectedPrefix: PricingTrimmedStringSchema,
    value: Schema.String,
  }
) {}

export class PricingCurrencyConflict extends Schema.TaggedErrorClass<PricingCurrencyConflict>()(
  "PricingCurrencyConflict",
  {
    currencyCode: CurrencyCodeSchema,
  }
) {}

export class PricingPriceSetNotFound extends Schema.TaggedErrorClass<PricingPriceSetNotFound>()(
  "PricingPriceSetNotFound",
  {
    priceSetId: PriceSetIdSchema,
  }
) {}

export class PricingPriceListNotFound extends Schema.TaggedErrorClass<PricingPriceListNotFound>()(
  "PricingPriceListNotFound",
  {
    priceListId: PriceListIdSchema,
  }
) {}

export class PricingNoMatchingPrice extends Schema.TaggedErrorClass<PricingNoMatchingPrice>()(
  "PricingNoMatchingPrice",
  {
    currencyCode: CurrencyCodeSchema,
    priceSetId: PriceSetIdSchema,
  }
) {}

export class PricingValidationFailure extends Schema.TaggedErrorClass<PricingValidationFailure>()(
  "PricingValidationFailure",
  {
    message: PricingTrimmedStringSchema,
  }
) {}

export type PricingExpectedError =
  | PricingCurrencyConflict
  | PricingInvalidIdentifier
  | PricingNoMatchingPrice
  | PricingPriceListNotFound
  | PricingPriceSetNotFound
  | PricingValidationFailure
  | RepositoryFailure;
