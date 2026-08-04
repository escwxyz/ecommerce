import {
  FulfillmentService,
  fulfillmentPermissions,
  serializeFulfillmentId,
  serializeFulfillmentProviderRecordId,
  serializeFulfillmentSetId,
  serializeServiceZoneId,
  serializeShipmentRecordId,
  serializeShippingOptionId,
  serializeShippingProfileId,
} from "@ecommerce/fulfillment";
import type {
  Fulfillment,
  FulfillmentApiRecord,
  FulfillmentDetail,
  FulfillmentDetailApiRecord,
  FulfillmentProviderApiRecord,
  FulfillmentProviderRecord,
  FulfillmentSet,
  FulfillmentSetApiRecord,
  ServiceZone,
  ServiceZoneApiRecord,
  ShipmentRecord,
  ShipmentRecordApiRecord,
  ShippingOption,
  ShippingOptionApiRecord,
  ShippingOptionRateApiRecord,
  ShippingProfile,
  ShippingProfileApiRecord,
} from "@ecommerce/fulfillment";
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
import { fulfillmentAdminHttpApiGroup } from "./fulfillment-effect-http-contract";

const serializeProviderRecord = (
  record: FulfillmentProviderRecord
): FulfillmentProviderApiRecord => ({
  createdAt: record.createdAt.toISOString(),
  id: serializeFulfillmentProviderRecordId(record.id),
  isEnabled: record.isEnabled,
  providerKey: record.providerKey,
  providerRecordId: record.providerRecordId,
  updatedAt: record.updatedAt.toISOString(),
});

const serializeSet = (record: FulfillmentSet): FulfillmentSetApiRecord => ({
  createdAt: record.createdAt.toISOString(),
  id: serializeFulfillmentSetId(record.id),
  metadata: record.metadata,
  name: record.name,
  updatedAt: record.updatedAt.toISOString(),
});

const serializeProfile = (
  record: ShippingProfile
): ShippingProfileApiRecord => ({
  createdAt: record.createdAt.toISOString(),
  fulfillmentSetId: serializeFulfillmentSetId(record.fulfillmentSetId),
  id: serializeShippingProfileId(record.id),
  metadata: record.metadata,
  name: record.name,
  updatedAt: record.updatedAt.toISOString(),
});

const serializeZone = (record: ServiceZone): ServiceZoneApiRecord => ({
  countryCodes: record.countryCodes,
  createdAt: record.createdAt.toISOString(),
  fulfillmentSetId: serializeFulfillmentSetId(record.fulfillmentSetId),
  id: serializeServiceZoneId(record.id),
  metadata: record.metadata,
  name: record.name,
  regionIds: record.regionIds,
  updatedAt: record.updatedAt.toISOString(),
});

const serializeOption = (record: ShippingOption): ShippingOptionApiRecord => ({
  createdAt: record.createdAt.toISOString(),
  currencyCode: record.currencyCode,
  fulfillmentSetId: serializeFulfillmentSetId(record.fulfillmentSetId),
  id: serializeShippingOptionId(record.id),
  isEnabled: record.isEnabled,
  metadata: record.metadata,
  name: record.name,
  priceAmount: record.priceAmount,
  profileId: serializeShippingProfileId(record.profileId),
  providerKey: record.providerKey,
  providerServiceId: record.providerServiceId,
  serviceZoneId: serializeServiceZoneId(record.serviceZoneId),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeFulfillment = (record: Fulfillment): FulfillmentApiRecord => ({
  address: record.address,
  createdAt: record.createdAt.toISOString(),
  id: serializeFulfillmentId(record.id),
  idempotencyKey: record.idempotencyKey,
  items: record.items,
  metadata: record.metadata,
  orderId: record.orderId,
  providerFulfillmentId: record.providerFulfillmentId,
  providerKey: record.providerKey,
  shippingOptionId: serializeShippingOptionId(record.shippingOptionId),
  status: record.status,
  updatedAt: record.updatedAt.toISOString(),
});

const serializeShipment = (
  record: ShipmentRecord
): ShipmentRecordApiRecord => ({
  carrier: record.carrier,
  createdAt: record.createdAt.toISOString(),
  fulfillmentId: serializeFulfillmentId(record.fulfillmentId),
  id: serializeShipmentRecordId(record.id),
  labelUrl: record.labelUrl,
  metadata: record.metadata,
  providerShipmentId: record.providerShipmentId,
  status: record.status,
  trackingNumber: record.trackingNumber,
  trackingUrl: record.trackingUrl,
  updatedAt: record.updatedAt.toISOString(),
});

const serializeDetail = (
  detail: FulfillmentDetail
): FulfillmentDetailApiRecord => ({
  fulfillment: serializeFulfillment(detail.fulfillment),
  shipments: detail.shipments.map(serializeShipment),
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
  Effect.gen(function* createFulfillmentApiSuccessEnvelope() {
    const context = yield* CurrentEffectHttpRequestContext;
    const data = yield* effect;
    return withSuccessEnvelope(data, context.identity);
  });

const fulfillmentAdminGroupIdentifier = "fulfillmentAdmin";
const fulfillmentAdminHttpApi = HttpApi.make("FulfillmentAdminApi").add(
  fulfillmentAdminHttpApiGroup
);

export const fulfillmentAdminHttpApiHandlers = HttpApiBuilder.group(
  fulfillmentAdminHttpApi,
  fulfillmentAdminGroupIdentifier,
  (handlers) =>
    handlers
      .handle("fulfillmentProviderRegister", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            FulfillmentService.use((service) =>
              service
                .registerProvider(payload.providerKey)
                .pipe(Effect.map(serializeProviderRecord))
            )
          ),
          fulfillmentPermissions.write
        )
      )
      .handle("fulfillmentSetCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            FulfillmentService.use((service) =>
              service
                .createFulfillmentSet(payload)
                .pipe(Effect.map(serializeSet))
            )
          ),
          fulfillmentPermissions.write
        )
      )
      .handle("fulfillmentShippingProfileCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            FulfillmentService.use((service) =>
              service
                .createShippingProfile(payload)
                .pipe(Effect.map(serializeProfile))
            )
          ),
          fulfillmentPermissions.write
        )
      )
      .handle("fulfillmentServiceZoneCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            FulfillmentService.use((service) =>
              service.createServiceZone(payload).pipe(Effect.map(serializeZone))
            )
          ),
          fulfillmentPermissions.write
        )
      )
      .handle("fulfillmentShippingOptionCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            FulfillmentService.use((service) =>
              service
                .createShippingOption(payload)
                .pipe(Effect.map(serializeOption))
            )
          ),
          fulfillmentPermissions.write
        )
      )
      .handle("fulfillmentShippingOptionList", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            FulfillmentService.use((service) =>
              service
                .listShippingOptions(payload)
                .pipe(Effect.map((options) => options.map(serializeOption)))
            )
          ),
          fulfillmentPermissions.read
        )
      )
      .handle("fulfillmentShippingOptionRate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            FulfillmentService.use((service) =>
              service.rateShippingOption(payload.shippingOptionId).pipe(
                Effect.map(
                  (rate): ShippingOptionRateApiRecord => ({
                    amount: rate.amount,
                    currencyCode: rate.currencyCode,
                    providerKey: rate.providerKey,
                    shippingOptionId: serializeShippingOptionId(
                      rate.shippingOptionId
                    ),
                  })
                )
              )
            )
          ),
          fulfillmentPermissions.read
        )
      )
      .handle("fulfillmentCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            FulfillmentService.use((service) =>
              service
                .createFulfillment(payload)
                .pipe(Effect.map(serializeDetail))
            )
          ),
          fulfillmentPermissions.write
        )
      )
      .handle("fulfillmentList", () =>
        withEffectHttpPermission(
          withCurrentRequest(
            FulfillmentService.use((service) =>
              service.listFulfillments.pipe(
                Effect.map((fulfillments) =>
                  fulfillments.map(serializeFulfillment)
                )
              )
            )
          ),
          fulfillmentPermissions.read
        )
      )
      .handle("fulfillmentCancel", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            FulfillmentService.use((service) =>
              service
                .cancelFulfillment(payload)
                .pipe(Effect.map(serializeFulfillment))
            )
          ),
          fulfillmentPermissions.write
        )
      )
      .handle("fulfillmentTrackShipment", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            FulfillmentService.use((service) =>
              service
                .trackShipment(payload)
                .pipe(
                  Effect.map((shipment) =>
                    shipment ? serializeShipment(shipment) : null
                  )
                )
            )
          ),
          fulfillmentPermissions.read
        )
      )
);

export const fulfillmentEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineAdminHttpApiGroupContribution({
        group: fulfillmentAdminHttpApiGroup,
        handlers: fulfillmentAdminHttpApiHandlers,
        key: "module:fulfillment.admin",
        owner: "module",
      }),
    ],
    moduleName: "fulfillment",
  });
