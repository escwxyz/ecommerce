import {
  CurrentEffectHttpRequestContext,
  withEffectHttpPermission,
} from "@ecommerce/api/effect-http-middleware";
import type { EffectHttpRequestIdentity } from "@ecommerce/api/effect-http-middleware";
import { defineCommerceModuleApiGroupContribution } from "@ecommerce/core";
import { Effect } from "effect";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import { serializeRegionId, serializeSalesChannelId } from "../domain";
import type {
  RegionApiRecord,
  RegionRecord,
  SalesChannelApiRecord,
  SalesChannelRecord,
} from "../domain";
import { regionSalesChannelPermissions } from "../permissions";
import { RegionService, SalesChannelService } from "../services";
import { regionSalesChannelAdminHttpApiGroup } from "./contract";

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

/** Public Effect HTTP handlers supplied by this module contribution. */
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

/** Executable HTTP contribution registered by the owning module definition. */
export const regionSalesChannelEffectHttpApiContribution = {
  groups: [
    defineCommerceModuleApiGroupContribution({
      group: regionSalesChannelAdminHttpApiGroup,
      handlers: regionSalesChannelAdminHttpApiHandlers,
      key: "module:region-sales-channel.admin",
      surface: "admin",
    }),
  ],
  moduleName: "region-sales-channel",
} as const;
