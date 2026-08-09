import type {
  RepositoryFailure,
  TransactionalMutationFailure,
} from "@ecommerce/core";
/* eslint-disable max-classes-per-file -- promotion expected failures form one schema-backed module vocabulary */
import { Schema } from "effect";

import {
  CampaignIdSchema,
  PromotionIdSchema,
  PromotionTrimmedStringSchema,
  PromotionUsageLimitScopeSchema,
} from "./promotion.schema";

export class PromotionInvalidIdentifier extends Schema.TaggedErrorClass<PromotionInvalidIdentifier>()(
  "PromotionInvalidIdentifier",
  {
    expectedPrefix: PromotionTrimmedStringSchema,
    value: Schema.String,
  }
) {}

export class PromotionCampaignNotFound extends Schema.TaggedErrorClass<PromotionCampaignNotFound>()(
  "PromotionCampaignNotFound",
  {
    campaignId: CampaignIdSchema,
  }
) {}

export class PromotionNotFound extends Schema.TaggedErrorClass<PromotionNotFound>()(
  "PromotionNotFound",
  {
    promotionId: PromotionIdSchema,
  }
) {}

export class PromotionUnsupportedUsageLimitScope extends Schema.TaggedErrorClass<PromotionUnsupportedUsageLimitScope>()(
  "PromotionUnsupportedUsageLimitScope",
  {
    scope: PromotionUsageLimitScopeSchema,
  }
) {}

export class PromotionValidationFailure extends Schema.TaggedErrorClass<PromotionValidationFailure>()(
  "PromotionValidationFailure",
  {
    message: PromotionTrimmedStringSchema,
  }
) {}

export type PromotionExpectedError =
  | PromotionCampaignNotFound
  | PromotionInvalidIdentifier
  | PromotionNotFound
  | PromotionUnsupportedUsageLimitScope
  | PromotionValidationFailure
  | RepositoryFailure
  | TransactionalMutationFailure;
