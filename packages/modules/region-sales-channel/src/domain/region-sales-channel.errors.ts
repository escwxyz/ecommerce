import type { RepositoryFailure } from "@ecommerce/core";
/* eslint-disable max-classes-per-file -- region/sales-channel failures form one schema-backed domain vocabulary */
import { Schema } from "effect";

import {
  RegionIdSchema,
  RegionSalesChannelTrimmedStringSchema,
  SalesChannelIdSchema,
} from "./region-sales-channel.schema";

export class RegionInvalidIdentifier extends Schema.TaggedErrorClass<RegionInvalidIdentifier>()(
  "RegionInvalidIdentifier",
  {
    expectedPrefix: RegionSalesChannelTrimmedStringSchema,
    value: Schema.String,
  }
) {}

export class SalesChannelInvalidIdentifier extends Schema.TaggedErrorClass<SalesChannelInvalidIdentifier>()(
  "SalesChannelInvalidIdentifier",
  {
    expectedPrefix: RegionSalesChannelTrimmedStringSchema,
    value: Schema.String,
  }
) {}

export class RegionNotFound extends Schema.TaggedErrorClass<RegionNotFound>()(
  "RegionNotFound",
  {
    regionId: RegionIdSchema,
  }
) {}

export class SalesChannelNotFound extends Schema.TaggedErrorClass<SalesChannelNotFound>()(
  "SalesChannelNotFound",
  {
    salesChannelId: SalesChannelIdSchema,
  }
) {}

export class RegionValidationFailure extends Schema.TaggedErrorClass<RegionValidationFailure>()(
  "RegionValidationFailure",
  {
    message: RegionSalesChannelTrimmedStringSchema,
  }
) {}

export class SalesChannelValidationFailure extends Schema.TaggedErrorClass<SalesChannelValidationFailure>()(
  "SalesChannelValidationFailure",
  {
    message: RegionSalesChannelTrimmedStringSchema,
  }
) {}

export class RegionSalesChannelEventPublishFailure extends Schema.TaggedErrorClass<RegionSalesChannelEventPublishFailure>()(
  "RegionSalesChannelEventPublishFailure",
  {
    entityId: RegionSalesChannelTrimmedStringSchema,
    eventName: RegionSalesChannelTrimmedStringSchema,
    reason: RegionSalesChannelTrimmedStringSchema,
  }
) {}

export type RegionSalesChannelExpectedError =
  | RegionInvalidIdentifier
  | RegionNotFound
  | RegionSalesChannelEventPublishFailure
  | RegionValidationFailure
  | SalesChannelInvalidIdentifier
  | SalesChannelNotFound
  | SalesChannelValidationFailure
  | RepositoryFailure;
