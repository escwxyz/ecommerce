import { Effect, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import {
  RegionInvalidIdentifier,
  SalesChannelInvalidIdentifier,
} from "./region-sales-channel.errors";
import {
  RegionIdSchema,
  SalesChannelIdSchema,
} from "./region-sales-channel.schema";
import type { RegionId, SalesChannelId } from "./region-sales-channel.types";

export const REGION_ID_PREFIX = "reg_" as const;
export const SALES_CHANNEL_ID_PREFIX = "sc_" as const;

export const createRegionIdEffect = (
  value: string
): EffectValue<RegionId, RegionInvalidIdentifier> =>
  Schema.decodeUnknownEffect(RegionIdSchema)(value).pipe(
    Effect.mapError(
      () =>
        new RegionInvalidIdentifier({
          expectedPrefix: REGION_ID_PREFIX,
          value,
        })
    )
  );

export const createRegionId = (value: string): RegionId =>
  Schema.decodeUnknownSync(RegionIdSchema)(value);

export const serializeRegionId = (id: RegionId): string => id;

export const createSalesChannelIdEffect = (
  value: string
): EffectValue<SalesChannelId, SalesChannelInvalidIdentifier> =>
  Schema.decodeUnknownEffect(SalesChannelIdSchema)(value).pipe(
    Effect.mapError(
      () =>
        new SalesChannelInvalidIdentifier({
          expectedPrefix: SALES_CHANNEL_ID_PREFIX,
          value,
        })
    )
  );

export const createSalesChannelId = (value: string): SalesChannelId =>
  Schema.decodeUnknownSync(SalesChannelIdSchema)(value);

export const serializeSalesChannelId = (id: SalesChannelId): string => id;
