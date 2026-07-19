import type { RepositoryFailure } from "@ecommerce/core";
/* eslint-disable max-classes-per-file -- store expected failures form one schema-backed domain vocabulary */
import { Schema } from "effect";

import { StoreCurrencyCodeSchema, StoreIdSchema } from "./store.schema";

/** Store identifier failed the module-owned prefix invariant. */
export class StoreInvalidIdentifier extends Schema.TaggedErrorClass<StoreInvalidIdentifier>()(
  "StoreInvalidIdentifier",
  {
    expectedPrefix: Schema.NonEmptyString,
    value: Schema.String,
  }
) {}

/** Store settings normalization removed every supported currency candidate. */
export class StoreCurrencyListEmpty extends Schema.TaggedErrorClass<StoreCurrencyListEmpty>()(
  "StoreCurrencyListEmpty",
  {
    reason: Schema.Literals(["no-supported-currencies"]),
  }
) {}

/** Store default currency is not present in the supported currency list. */
export class StoreDefaultCurrencyUnsupported extends Schema.TaggedErrorClass<StoreDefaultCurrencyUnsupported>()(
  "StoreDefaultCurrencyUnsupported",
  {
    defaultCurrencyCode: StoreCurrencyCodeSchema,
    supportedCurrencyCodes: Schema.Array(StoreCurrencyCodeSchema),
  }
) {}

/** Store update event publication failed after settings were saved. */
export class StoreEventPublishFailure extends Schema.TaggedErrorClass<StoreEventPublishFailure>()(
  "StoreEventPublishFailure",
  {
    eventName: Schema.NonEmptyString,
    reason: Schema.Literals(["publisher-rejected"]),
    storeId: StoreIdSchema,
  }
) {}

export type StoreExpectedError =
  | StoreCurrencyListEmpty
  | StoreDefaultCurrencyUnsupported
  | StoreEventPublishFailure
  | StoreInvalidIdentifier
  | RepositoryFailure;
