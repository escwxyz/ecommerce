import type { AuthSession } from "@ecommerce/auth";
import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { implement, ORPCError } from "@orpc/server";

import { fulfillmentContractRouter } from "../contracts";
import type {
  CancelFulfillmentInput,
  CreateFulfillmentInput,
  CreateFulfillmentSetInput,
  CreateServiceZoneInput,
  CreateShippingOptionInput,
  CreateShippingProfileInput,
  Fulfillment,
  FulfillmentDetail,
  FulfillmentProviderRecord,
  FulfillmentSet,
  ServiceZone,
  ShipmentRecord,
  ShippingOption,
  ShippingProfile,
} from "../domain";
import {
  createFulfillmentId,
  createShippingOptionId,
  serializeFulfillmentId,
  serializeFulfillmentProviderRecordId,
  serializeFulfillmentSetId,
  serializeServiceZoneId,
  serializeShipmentRecordId,
  serializeShippingOptionId,
  serializeShippingProfileId,
} from "../domain";
import { fulfillmentPermissions } from "../permissions";
import {
  createFulfillmentService,
  defaultFulfillmentService,
} from "../services";
import type { CreateFulfillmentServiceOptions } from "../services";

export interface FulfillmentModuleContext {
  readonly auth: unknown;
  readonly authorization: {
    evaluatePermission(input: {
      readonly permission: CommercePermissionDescriptor;
      readonly session: AuthSession;
    }): FulfillmentAuthorizationDecision;
  };
  readonly session: AuthSession;
}

type FulfillmentAuthorizationDecision =
  | {
      readonly allowed: true;
    }
  | {
      readonly allowed: false;
      readonly reason:
        | "missing-authenticated-actor"
        | "missing-permission"
        | "unsupported-permission";
    };

const assertPermission = (
  session: FulfillmentModuleContext["session"],
  permission: CommercePermissionDescriptor,
  authorization: FulfillmentModuleContext["authorization"]
): void => {
  const decision = authorization.evaluatePermission({ permission, session });

  if (decision.allowed) {
    return;
  }

  if (decision.reason === "missing-authenticated-actor") {
    throw new ORPCError("UNAUTHORIZED");
  }

  throw new ORPCError("FORBIDDEN");
};

const serializeProviderRecord = (record: FulfillmentProviderRecord) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  id: serializeFulfillmentProviderRecordId(record.id),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeSet = (record: FulfillmentSet) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  id: serializeFulfillmentSetId(record.id),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeProfile = (record: ShippingProfile) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  fulfillmentSetId: serializeFulfillmentSetId(record.fulfillmentSetId),
  id: serializeShippingProfileId(record.id),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeServiceZone = (record: ServiceZone) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  fulfillmentSetId: serializeFulfillmentSetId(record.fulfillmentSetId),
  id: serializeServiceZoneId(record.id),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeShippingOption = (record: ShippingOption) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  fulfillmentSetId: serializeFulfillmentSetId(record.fulfillmentSetId),
  id: serializeShippingOptionId(record.id),
  profileId: serializeShippingProfileId(record.profileId),
  serviceZoneId: serializeServiceZoneId(record.serviceZoneId),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeFulfillment = (record: Fulfillment) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  id: serializeFulfillmentId(record.id),
  shippingOptionId: serializeShippingOptionId(record.shippingOptionId),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeShipment = (record: ShipmentRecord) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  fulfillmentId: serializeFulfillmentId(record.fulfillmentId),
  id: serializeShipmentRecordId(record.id),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeDetail = (detail: FulfillmentDetail) => ({
  ...serializeFulfillment(detail.fulfillment),
  shipments: detail.shipments.map(serializeShipment),
});

export interface CreateFulfillmentRouteFragmentOptions extends CreateFulfillmentServiceOptions {
  readonly key?: string;
}

export const createFulfillmentRouteFragment = ({
  key = "module:fulfillment",
  ...options
}: CreateFulfillmentRouteFragmentOptions = {}) => {
  const service =
    options.repository ||
    options.clock ||
    options.idGenerator ||
    options.providerRegistry
      ? createFulfillmentService(options)
      : defaultFulfillmentService;
  const baseImplementation = implement(
    fulfillmentContractRouter
  ).$context<FulfillmentModuleContext>();
  const protectedImplementation = baseImplementation.use(
    ({ context, next }) => {
      if (!context.session?.user) {
        throw new ORPCError("UNAUTHORIZED");
      }

      return next({
        context: {
          auth: context.auth,
          authorization: context.authorization,
          session: context.session,
        },
      });
    }
  );

  const router = protectedImplementation.router({
    fulfillmentCancel: protectedImplementation.fulfillmentCancel.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          fulfillmentPermissions.write,
          context.authorization
        );

        return serializeFulfillment(
          await service.cancelFulfillment(input as CancelFulfillmentInput)
        );
      }
    ),
    fulfillmentCreate: protectedImplementation.fulfillmentCreate.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          fulfillmentPermissions.write,
          context.authorization
        );

        return serializeDetail(
          await service.createFulfillment(input as CreateFulfillmentInput)
        );
      }
    ),
    fulfillmentGet: protectedImplementation.fulfillmentGet.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          fulfillmentPermissions.read,
          context.authorization
        );

        const detail = await service.getFulfillmentDetail(
          createFulfillmentId(input.id)
        );
        return detail ? serializeDetail(detail) : null;
      }
    ),
    fulfillmentList: protectedImplementation.fulfillmentList.handler(
      async ({ context }) => {
        assertPermission(
          context.session,
          fulfillmentPermissions.read,
          context.authorization
        );

        const fulfillments = await service.listFulfillments();
        return fulfillments.map(serializeFulfillment);
      }
    ),
    fulfillmentProviderRegister:
      protectedImplementation.fulfillmentProviderRegister.handler(
        async ({ context, input }) => {
          assertPermission(
            context.session,
            fulfillmentPermissions.write,
            context.authorization
          );

          return serializeProviderRecord(
            await service.registerProvider(input.providerKey)
          );
        }
      ),
    fulfillmentServiceZoneCreate:
      protectedImplementation.fulfillmentServiceZoneCreate.handler(
        async ({ context, input }) => {
          assertPermission(
            context.session,
            fulfillmentPermissions.write,
            context.authorization
          );

          return serializeServiceZone(
            await service.createServiceZone(input as CreateServiceZoneInput)
          );
        }
      ),
    fulfillmentSetCreate: protectedImplementation.fulfillmentSetCreate.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          fulfillmentPermissions.write,
          context.authorization
        );

        return serializeSet(
          await service.createFulfillmentSet(input as CreateFulfillmentSetInput)
        );
      }
    ),
    fulfillmentShippingOptionCreate:
      protectedImplementation.fulfillmentShippingOptionCreate.handler(
        async ({ context, input }) => {
          assertPermission(
            context.session,
            fulfillmentPermissions.write,
            context.authorization
          );

          return serializeShippingOption(
            await service.createShippingOption(
              input as CreateShippingOptionInput
            )
          );
        }
      ),
    fulfillmentShippingOptionList:
      protectedImplementation.fulfillmentShippingOptionList.handler(
        async ({ context, input }) => {
          assertPermission(
            context.session,
            fulfillmentPermissions.read,
            context.authorization
          );

          const shippingOptions = await service.listShippingOptions(input);
          return shippingOptions.map(serializeShippingOption);
        }
      ),
    fulfillmentShippingOptionRate:
      protectedImplementation.fulfillmentShippingOptionRate.handler(
        async ({ context, input }) => {
          assertPermission(
            context.session,
            fulfillmentPermissions.read,
            context.authorization
          );

          const rate = await service.rateShippingOption(
            createShippingOptionId(input.id)
          );

          return {
            ...rate,
            shippingOptionId: serializeShippingOptionId(rate.shippingOptionId),
          };
        }
      ),
    fulfillmentShippingProfileCreate:
      protectedImplementation.fulfillmentShippingProfileCreate.handler(
        async ({ context, input }) => {
          assertPermission(
            context.session,
            fulfillmentPermissions.write,
            context.authorization
          );

          return serializeProfile(
            await service.createShippingProfile(
              input as CreateShippingProfileInput
            )
          );
        }
      ),
    fulfillmentTrackShipment:
      protectedImplementation.fulfillmentTrackShipment.handler(
        async ({ context, input }) => {
          assertPermission(
            context.session,
            fulfillmentPermissions.write,
            context.authorization
          );

          const shipment = await service.trackShipment(input);
          return shipment ? serializeShipment(shipment) : null;
        }
      ),
  });

  return {
    key,
    router,
  };
};

export const fulfillmentApiFragment = createFulfillmentRouteFragment();
