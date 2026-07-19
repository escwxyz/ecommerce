import {
  RegionService,
  SalesChannelService,
  regionSalesChannelPermissions,
  serializeRegionId,
  serializeSalesChannelId,
} from "@ecommerce/region-sales-channel";
import type {
  RegionApiRecord,
  RegionRecord,
  SalesChannelApiRecord,
  SalesChannelRecord,
} from "@ecommerce/region-sales-channel";
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
import { regionSalesChannelAdminHttpApiGroup } from "./region-sales-channel-effect-http-contract";

const serializeRegion = (region: RegionRecord): RegionApiRecord => ({
  countries: region.countries,
  createdAt: region.createdAt.toISOString(),
  currencyCode: region.currencyCode,
  id: serializeRegionId(region.id),
  metadata: region.metadata,
  name: region.name,
  providerAvailability: region.providerAvailability,
  updatedAt: region.updatedAt.toISOString(),
});

const serializeSalesChannel = (
  channel: SalesChannelRecord
): SalesChannelApiRecord => ({
  createdAt: channel.createdAt.toISOString(),
  description: channel.description,
  id: serializeSalesChannelId(channel.id),
  metadata: channel.metadata,
  name: channel.name,
  productIds: channel.productIds,
  status: channel.status,
  updatedAt: channel.updatedAt.toISOString(),
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
  Effect.gen(function* createRegionSalesChannelApiSuccessEnvelope() {
    const context = yield* CurrentEffectHttpRequestContext;
    const data = yield* effect;
    return withSuccessEnvelope(data, context.identity);
  });

const regionSalesChannelAdminGroupIdentifier = "regionSalesChannelAdmin";
const regionSalesChannelAdminHttpApi = HttpApi.make(
  "RegionSalesChannelAdminApi"
).add(regionSalesChannelAdminHttpApiGroup);

export const regionSalesChannelAdminHttpApiHandlers = HttpApiBuilder.group(
  regionSalesChannelAdminHttpApi,
  regionSalesChannelAdminGroupIdentifier,
  (handlers) =>
    handlers
      .handle("regionCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            RegionService.use((service) =>
              service.createRegion(payload).pipe(Effect.map(serializeRegion))
            )
          ),
          regionSalesChannelPermissions.regionWrite
        )
      )
      .handle("regionGet", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            RegionService.use((service) =>
              service
                .getRegionById(payload.id)
                .pipe(
                  Effect.map((region) =>
                    region ? serializeRegion(region) : null
                  )
                )
            )
          ),
          regionSalesChannelPermissions.regionRead
        )
      )
      .handle("regionList", () =>
        withEffectHttpPermission(
          withCurrentRequest(
            RegionService.use((service) =>
              service.listRegions.pipe(
                Effect.map((regions) => regions.map(serializeRegion))
              )
            )
          ),
          regionSalesChannelPermissions.regionRead
        )
      )
      .handle("regionValidate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            RegionService.use((service) =>
              service.validateRegionConstraints(payload)
            )
          ),
          regionSalesChannelPermissions.regionRead
        )
      )
      .handle("salesChannelCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            SalesChannelService.use((service) =>
              service
                .createSalesChannel(payload)
                .pipe(Effect.map(serializeSalesChannel))
            )
          ),
          regionSalesChannelPermissions.salesChannelWrite
        )
      )
      .handle("salesChannelGet", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            SalesChannelService.use((service) =>
              service
                .getSalesChannelById(payload.id)
                .pipe(
                  Effect.map((channel) =>
                    channel ? serializeSalesChannel(channel) : null
                  )
                )
            )
          ),
          regionSalesChannelPermissions.salesChannelRead
        )
      )
      .handle("salesChannelList", () =>
        withEffectHttpPermission(
          withCurrentRequest(
            SalesChannelService.use((service) =>
              service.listSalesChannels.pipe(
                Effect.map((channels) => channels.map(serializeSalesChannel))
              )
            )
          ),
          regionSalesChannelPermissions.salesChannelRead
        )
      )
      .handle("salesChannelProductPublish", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            SalesChannelService.use((service) =>
              service
                .publishProductToSalesChannel(payload)
                .pipe(Effect.map(serializeSalesChannel))
            )
          ),
          regionSalesChannelPermissions.salesChannelWrite
        )
      )
      .handle("salesChannelPublishabilityCheck", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            SalesChannelService.use((service) =>
              service.checkProductPublishability(payload)
            )
          ),
          regionSalesChannelPermissions.salesChannelRead
        )
      )
);

export const regionSalesChannelEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineAdminHttpApiGroupContribution({
        group: regionSalesChannelAdminHttpApiGroup,
        handlers: regionSalesChannelAdminHttpApiHandlers,
        key: "module:region-sales-channel.admin",
        owner: "module",
      }),
    ],
    moduleName: "region-sales-channel",
  });
