import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { Context, Layer } from "effect";
import { nanoid } from "nanoid";

import type {
  CancelFulfillmentInput,
  CreateFulfillmentInput,
  CreateFulfillmentSetInput,
  CreateServiceZoneInput,
  CreateShippingOptionInput,
  CreateShippingProfileInput,
  Fulfillment,
  FulfillmentDetail,
  FulfillmentId,
  FulfillmentProviderRecord,
  FulfillmentRepository,
  FulfillmentSet,
  ServiceZone,
  ShipmentRecord,
  ShippingOption,
  ShippingOptionId,
  ShippingOptionLookupInput,
  ShippingProfile,
  TrackShipmentInput,
} from "../domain";
import {
  FULFILLMENT_ID_PREFIX,
  FULFILLMENT_PROVIDER_RECORD_ID_PREFIX,
  FULFILLMENT_SET_ID_PREFIX,
  SERVICE_ZONE_ID_PREFIX,
  SHIPMENT_RECORD_ID_PREFIX,
  SHIPPING_OPTION_ID_PREFIX,
  SHIPPING_PROFILE_ID_PREFIX,
  createFulfillmentId,
  createFulfillmentProviderRecordId,
  createFulfillmentSetId,
  createServiceZoneId,
  createShipmentRecordId,
  createShippingOptionId,
  createShippingProfileId,
} from "../domain";
import type { FulfillmentProviderRegistry } from "../providers";
import {
  emptyFulfillmentProviderRegistry,
  createFulfillmentProviderRegistry,
} from "../providers";
import { defaultFulfillmentRepository } from "../repositories";

export const FULFILLMENT_SET_CREATED_EVENT = "fulfillment.set-created" as const;
export const SHIPPING_OPTION_CREATED_EVENT =
  "fulfillment.shipping-option-created" as const;
export const FULFILLMENT_CREATED_EVENT = "fulfillment.created" as const;
export const FULFILLMENT_CANCELED_EVENT = "fulfillment.canceled" as const;
export const SHIPMENT_TRACKED_EVENT = "fulfillment.shipment-tracked" as const;

export interface ShippingOptionRate {
  readonly amount: number;
  readonly currencyCode: string;
  readonly providerKey: string;
  readonly shippingOptionId: ShippingOptionId;
}

export interface FulfillmentServiceShape {
  cancelFulfillment(input: CancelFulfillmentInput): Promise<Fulfillment>;
  createFulfillment(input: CreateFulfillmentInput): Promise<FulfillmentDetail>;
  createFulfillmentSet(
    input: CreateFulfillmentSetInput
  ): Promise<FulfillmentSet>;
  createServiceZone(input: CreateServiceZoneInput): Promise<ServiceZone>;
  createShippingOption(
    input: CreateShippingOptionInput
  ): Promise<ShippingOption>;
  createShippingProfile(
    input: CreateShippingProfileInput
  ): Promise<ShippingProfile>;
  getFulfillmentDetail(id: FulfillmentId): Promise<FulfillmentDetail | null>;
  listFulfillments(): Promise<readonly Fulfillment[]>;
  listShippingOptions(
    input?: ShippingOptionLookupInput
  ): Promise<readonly ShippingOption[]>;
  rateShippingOption(
    shippingOptionId: ShippingOptionId
  ): Promise<ShippingOptionRate>;
  registerProvider(providerKey: string): Promise<FulfillmentProviderRecord>;
  trackShipment(input: TrackShipmentInput): Promise<ShipmentRecord | null>;
}

export const FulfillmentService = Context.Service<FulfillmentServiceShape>(
  "@ecommerce/fulfillment/FulfillmentService"
);

export interface CreateFulfillmentServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly providerRegistry?: FulfillmentProviderRegistry;
  readonly repository?: FulfillmentRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
});

const createPrefixedId = (
  idGenerator: IdGeneratorServiceShape,
  prefix: string
): string => {
  const nextId = idGenerator.nextId();
  return nextId.startsWith(prefix) ? nextId : `${prefix}${nextId}`;
};

const requireProvider = (
  registry: FulfillmentProviderRegistry,
  providerKey: string
) => {
  const provider = registry.getProvider(providerKey);

  if (!provider) {
    throw new Error(`Fulfillment provider "${providerKey}" is not registered.`);
  }

  return provider;
};

const requireShippingOption = async (
  repository: FulfillmentRepository,
  shippingOptionId: ShippingOptionId
): Promise<ShippingOption> => {
  const shippingOption =
    await repository.findShippingOptionById(shippingOptionId);

  if (!shippingOption) {
    throw new Error(`Shipping option "${shippingOptionId}" was not found.`);
  }

  return shippingOption;
};

const requireFulfillment = async (
  repository: FulfillmentRepository,
  fulfillmentId: FulfillmentId
): Promise<Fulfillment> => {
  const fulfillment = await repository.findFulfillmentById(fulfillmentId);

  if (!fulfillment) {
    throw new Error(`Fulfillment "${fulfillmentId}" was not found.`);
  }

  return fulfillment;
};

const normalizeCountryCodes = (
  countryCodes: readonly string[] | undefined
): readonly string[] =>
  (countryCodes ?? []).map((countryCode) => countryCode.toUpperCase());

export const createFulfillmentService = ({
  clock = createDefaultClock(),
  idGenerator = createDefaultIdGenerator(),
  providerRegistry = emptyFulfillmentProviderRegistry,
  repository = defaultFulfillmentRepository,
}: CreateFulfillmentServiceOptions = {}): FulfillmentServiceShape => {
  const saveShipmentFromProvider = async ({
    fulfillmentId,
    providerShipment,
  }: {
    readonly fulfillmentId: FulfillmentId;
    readonly providerShipment: NonNullable<
      Awaited<ReturnType<ReturnType<typeof requireProvider>["trackShipment"]>>
    >;
  }): Promise<ShipmentRecord> => {
    const existing =
      await repository.findShipmentByFulfillmentId(fulfillmentId);
    const now = clock.now();
    const shipment: ShipmentRecord = existing
      ? {
          ...existing,
          carrier: providerShipment.carrier,
          labelUrl: providerShipment.labelUrl,
          status: providerShipment.status,
          trackingNumber: providerShipment.trackingNumber,
          trackingUrl: providerShipment.trackingUrl,
          updatedAt: now,
        }
      : {
          carrier: providerShipment.carrier,
          createdAt: now,
          fulfillmentId,
          id: createShipmentRecordId(
            createPrefixedId(idGenerator, SHIPMENT_RECORD_ID_PREFIX)
          ),
          labelUrl: providerShipment.labelUrl,
          metadata: {},
          providerShipmentId: providerShipment.providerShipmentId,
          status: providerShipment.status,
          trackingNumber: providerShipment.trackingNumber,
          trackingUrl: providerShipment.trackingUrl,
          updatedAt: now,
        };

    return repository.saveShipment(shipment);
  };

  return {
    cancelFulfillment: async (input) => {
      const fulfillmentId = createFulfillmentId(input.fulfillmentId);
      const fulfillment = await requireFulfillment(repository, fulfillmentId);

      if (fulfillment.status === "canceled") {
        return fulfillment;
      }

      if (fulfillment.providerFulfillmentId) {
        await requireProvider(
          providerRegistry,
          fulfillment.providerKey
        ).cancelFulfillment({
          providerFulfillmentId: fulfillment.providerFulfillmentId,
          reason: input.reason,
        });
      }

      return repository.saveFulfillment({
        ...fulfillment,
        status: "canceled",
        updatedAt: clock.now(),
      });
    },
    createFulfillment: async (input) => {
      const duplicate = await repository.findFulfillmentByIdempotencyKey(
        input.idempotencyKey
      );

      if (duplicate) {
        return {
          fulfillment: duplicate,
          shipments: await repository.listShipmentsForFulfillment(duplicate.id),
        };
      }

      const shippingOptionId = createShippingOptionId(input.shippingOptionId);
      const shippingOption = await requireShippingOption(
        repository,
        shippingOptionId
      );
      const provider = requireProvider(
        providerRegistry,
        shippingOption.providerKey
      );
      const validation = await provider.validateOption({
        address: input.address,
        items: input.items,
        providerServiceId: shippingOption.providerServiceId,
      });

      if (!validation.valid) {
        throw new Error(
          validation.reason ??
            `Shipping option "${shippingOptionId}" was rejected.`
        );
      }

      const providerFulfillment = await provider.createFulfillment({
        address: input.address,
        idempotencyKey: input.idempotencyKey,
        items: input.items,
        orderId: input.orderId,
        providerServiceId: shippingOption.providerServiceId,
      });
      const now = clock.now();
      const fulfillment: Fulfillment = {
        address: input.address,
        createdAt: now,
        id: createFulfillmentId(
          createPrefixedId(idGenerator, FULFILLMENT_ID_PREFIX)
        ),
        idempotencyKey: input.idempotencyKey,
        items: input.items,
        metadata: input.metadata ?? {},
        orderId: input.orderId,
        providerFulfillmentId: providerFulfillment.providerFulfillmentId,
        providerKey: shippingOption.providerKey,
        shippingOptionId,
        status: providerFulfillment.status,
        updatedAt: now,
      };

      await repository.saveFulfillment(fulfillment);

      const shipments = providerFulfillment.shipment
        ? [
            await saveShipmentFromProvider({
              fulfillmentId: fulfillment.id,
              providerShipment: providerFulfillment.shipment,
            }),
          ]
        : [];

      return { fulfillment, shipments };
    },
    createFulfillmentSet: (input) => {
      const now = clock.now();
      return repository.saveFulfillmentSet({
        createdAt: now,
        id: createFulfillmentSetId(
          createPrefixedId(idGenerator, FULFILLMENT_SET_ID_PREFIX)
        ),
        metadata: input.metadata ?? {},
        name: input.name,
        updatedAt: now,
      });
    },
    createServiceZone: async (input) => {
      const fulfillmentSetId = createFulfillmentSetId(input.fulfillmentSetId);
      const fulfillmentSet =
        await repository.findFulfillmentSetById(fulfillmentSetId);

      if (!fulfillmentSet) {
        throw new Error(`Fulfillment set "${fulfillmentSetId}" was not found.`);
      }

      const now = clock.now();
      return repository.saveServiceZone({
        countryCodes: normalizeCountryCodes(input.countryCodes),
        createdAt: now,
        fulfillmentSetId,
        id: createServiceZoneId(
          createPrefixedId(idGenerator, SERVICE_ZONE_ID_PREFIX)
        ),
        metadata: input.metadata ?? {},
        name: input.name,
        regionIds: input.regionIds ?? [],
        updatedAt: now,
      });
    },
    createShippingOption: async (input) => {
      const fulfillmentSetId = createFulfillmentSetId(input.fulfillmentSetId);
      const profileId = createShippingProfileId(input.profileId);
      const serviceZoneId = createServiceZoneId(input.serviceZoneId);

      if (!(await repository.findFulfillmentSetById(fulfillmentSetId))) {
        throw new Error(`Fulfillment set "${fulfillmentSetId}" was not found.`);
      }

      if (!(await repository.findShippingProfileById(profileId))) {
        throw new Error(`Shipping profile "${profileId}" was not found.`);
      }

      if (!(await repository.findServiceZoneById(serviceZoneId))) {
        throw new Error(`Service zone "${serviceZoneId}" was not found.`);
      }

      requireProvider(providerRegistry, input.providerKey);

      const now = clock.now();
      return repository.saveShippingOption({
        createdAt: now,
        currencyCode: input.currencyCode?.toUpperCase(),
        fulfillmentSetId,
        id: createShippingOptionId(
          createPrefixedId(idGenerator, SHIPPING_OPTION_ID_PREFIX)
        ),
        isEnabled: true,
        metadata: input.metadata ?? {},
        name: input.name,
        priceAmount: input.priceAmount,
        profileId,
        providerKey: input.providerKey,
        providerServiceId: input.providerServiceId,
        serviceZoneId,
        updatedAt: now,
      });
    },
    createShippingProfile: async (input) => {
      const fulfillmentSetId = createFulfillmentSetId(input.fulfillmentSetId);

      if (!(await repository.findFulfillmentSetById(fulfillmentSetId))) {
        throw new Error(`Fulfillment set "${fulfillmentSetId}" was not found.`);
      }

      const now = clock.now();
      return repository.saveShippingProfile({
        createdAt: now,
        fulfillmentSetId,
        id: createShippingProfileId(
          createPrefixedId(idGenerator, SHIPPING_PROFILE_ID_PREFIX)
        ),
        metadata: input.metadata ?? {},
        name: input.name,
        updatedAt: now,
      });
    },
    getFulfillmentDetail: async (id) => {
      const fulfillment = await repository.findFulfillmentById(id);

      if (!fulfillment) {
        return null;
      }

      return {
        fulfillment,
        shipments: await repository.listShipmentsForFulfillment(fulfillment.id),
      };
    },
    listFulfillments: () => repository.listFulfillments(),
    listShippingOptions: (input) => repository.listShippingOptions(input),
    rateShippingOption: async (shippingOptionId) => {
      const shippingOption = await requireShippingOption(
        repository,
        shippingOptionId
      );
      const rate = await requireProvider(
        providerRegistry,
        shippingOption.providerKey
      ).rate({
        providerServiceId: shippingOption.providerServiceId,
      });

      return {
        amount: rate.amount.amount,
        currencyCode: rate.amount.currencyCode,
        providerKey: rate.providerKey,
        shippingOptionId,
      };
    },
    registerProvider: (providerKey) => {
      requireProvider(providerRegistry, providerKey);
      const now = clock.now();
      return repository.saveProviderRecord({
        createdAt: now,
        id: createFulfillmentProviderRecordId(
          createPrefixedId(idGenerator, FULFILLMENT_PROVIDER_RECORD_ID_PREFIX)
        ),
        isEnabled: true,
        providerKey,
        providerRecordId: providerKey,
        updatedAt: now,
      });
    },
    trackShipment: async (input) => {
      const fulfillmentId = createFulfillmentId(input.fulfillmentId);
      const fulfillment = await requireFulfillment(repository, fulfillmentId);

      if (!fulfillment.providerFulfillmentId) {
        return null;
      }

      const providerShipment = await requireProvider(
        providerRegistry,
        fulfillment.providerKey
      ).trackShipment({
        providerFulfillmentId: fulfillment.providerFulfillmentId,
      });

      if (!providerShipment) {
        return null;
      }

      const shipment = await saveShipmentFromProvider({
        fulfillmentId,
        providerShipment,
      });

      if (providerShipment.status === "delivered") {
        await repository.saveFulfillment({
          ...fulfillment,
          status: "delivered",
          updatedAt: clock.now(),
        });
      }

      return shipment;
    },
  };
};

export const defaultFulfillmentService = createFulfillmentService({
  providerRegistry: createFulfillmentProviderRegistry([]),
});

export const FulfillmentServiceLive = Layer.succeed(
  FulfillmentService,
  defaultFulfillmentService
);
