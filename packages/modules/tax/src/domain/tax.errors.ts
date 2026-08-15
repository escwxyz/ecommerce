import type {
  RepositoryFailure,
  TransactionalMutationFailure,
} from "@ecommerce/core";
/* eslint-disable max-classes-per-file -- tax expected failures form one schema-backed domain vocabulary */
import { Schema } from "effect";

import {
  TaxCategoryIdSchema,
  TaxProviderConfigIdSchema,
  TaxRegionIdSchema,
  TaxTrimmedStringSchema,
} from "./tax.schema";

export class TaxInvalidIdentifier extends Schema.TaggedErrorClass<TaxInvalidIdentifier>()(
  "TaxInvalidIdentifier",
  {
    expectedPrefix: TaxTrimmedStringSchema,
    value: Schema.String,
  }
) {}

export class TaxRegionNotFound extends Schema.TaggedErrorClass<TaxRegionNotFound>()(
  "TaxRegionNotFound",
  {
    regionId: TaxRegionIdSchema,
  }
) {}

export class TaxCategoryNotFound extends Schema.TaggedErrorClass<TaxCategoryNotFound>()(
  "TaxCategoryNotFound",
  {
    categoryId: TaxCategoryIdSchema,
  }
) {}

export class TaxProviderConfigNotFound extends Schema.TaggedErrorClass<TaxProviderConfigNotFound>()(
  "TaxProviderConfigNotFound",
  {
    providerConfigId: TaxProviderConfigIdSchema,
  }
) {}

export class TaxProviderUnavailable extends Schema.TaggedErrorClass<TaxProviderUnavailable>()(
  "TaxProviderUnavailable",
  {
    providerKey: TaxTrimmedStringSchema,
  }
) {}

export class TaxValidationFailure extends Schema.TaggedErrorClass<TaxValidationFailure>()(
  "TaxValidationFailure",
  {
    message: TaxTrimmedStringSchema,
  }
) {}

export type TaxExpectedError =
  | RepositoryFailure
  | TaxCategoryNotFound
  | TaxInvalidIdentifier
  | TaxProviderConfigNotFound
  | TaxProviderUnavailable
  | TaxRegionNotFound
  | TaxValidationFailure
  | TransactionalMutationFailure;
