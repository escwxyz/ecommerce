import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import {
  ClockService,
  EventPublisherService,
  IdGeneratorService,
  createEventEnvelope,
} from "@ecommerce/core";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
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
  FulfillmentExpectedError,
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
  FulfillmentNotFound,
  FulfillmentProviderUnavailable,
  FulfillmentRepositoryService,
  FulfillmentSetNotFound,
  FulfillmentValidationFailure,
  SERVICE_ZONE_ID_PREFIX,
  SHIPMENT_RECORD_ID_PREFIX,
  SHIPPING_OPTION_ID_PREFIX,
  SHIPPING_PROFILE_ID_PREFIX,
  ServiceZoneNotFound,
  ShippingOptionNotFound,
  ShippingProfileNotFound,
  createFulfillmentIdEffect,
  createFulfillmentProviderRecordIdEffect,
  createFulfillmentSetIdEffect,
  createServiceZoneIdEffect,
  createShipmentRecordIdEffect,
  createShippingOptionIdEffect,
  createShippingProfileIdEffect,
} from "../domain";
import type {
  FulfillmentProvider,
  FulfillmentProviderRegistry,
} from "../providers";
import {
  createFulfillmentProviderRegistry,
  emptyFulfillmentProviderRegistry,
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
  readonly cancelFulfillment: (
    input: CancelFulfillmentInput
  ) => EffectValue<Fulfillment, FulfillmentExpectedError>;
  readonly createFulfillment: (
    input: CreateFulfillmentInput
  ) => EffectValue<FulfillmentDetail, FulfillmentExpectedError>;
  readonly createFulfillmentSet: (
    input: CreateFulfillmentSetInput
  ) => EffectValue<FulfillmentSet, FulfillmentExpectedError>;
  readonly createServiceZone: (
    input: CreateServiceZoneInput
  ) => EffectValue<ServiceZone, FulfillmentExpectedError>;
  readonly createShippingOption: (
    input: CreateShippingOptionInput
  ) => EffectValue<ShippingOption, FulfillmentExpectedError>;
  readonly createShippingProfile: (
    input: CreateShippingProfileInput
  ) => EffectValue<ShippingProfile, FulfillmentExpectedError>;
  readonly getFulfillmentDetail: (
    id: FulfillmentId
  ) => EffectValue<FulfillmentDetail | null, FulfillmentExpectedError>;
  readonly listFulfillments: EffectValue<
    readonly Fulfillment[],
    FulfillmentExpectedError
  >;
  readonly listShippingOptions: (
    input?: ShippingOptionLookupInput
  ) => EffectValue<readonly ShippingOption[], FulfillmentExpectedError>;
  readonly rateShippingOption: (
    shippingOptionId: ShippingOptionId
  ) => EffectValue<ShippingOptionRate, FulfillmentExpectedError>;
  readonly registerProvider: (
    providerKey: string
  ) => EffectValue<FulfillmentProviderRecord, FulfillmentExpectedError>;
  readonly trackShipment: (
    input: TrackShipmentInput
  ) => EffectValue<ShipmentRecord | null, FulfillmentExpectedError>;
}

export const FulfillmentService = Context.Service<FulfillmentServiceShape>(
  "@ecommerce/fulfillment/FulfillmentService"
);

export interface CreateFulfillmentServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly eventPublisher?: EventPublisherServiceShape;
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

const createNoopEventPublisher = (): EventPublisherServiceShape => ({
  publish: () => {
    // Fulfillment events are optional until a runtime event bus is composed.
  },
});

const createPrefixedId = (
  idGenerator: IdGeneratorServiceShape,
  prefix: string
): string => {
  const nextId = idGenerator.nextId();
  return nextId.startsWith(prefix) ? nextId : `${prefix}${nextId}`;
};

const publishFulfillmentEvent = (
  eventPublisher: EventPublisherServiceShape,
  event: Parameters<EventPublisherServiceShape["publish"]>[0]
) =>
  Effect.tryPromise({
    catch: () =>
      new FulfillmentValidationFailure({
        message: "Fulfillment event publication failed.",
      }),
    try: async () => {
      await eventPublisher.publish(event);
    },
  });

const getProvider = (
  registry: FulfillmentProviderRegistry,
  providerKey: string
): EffectValue<FulfillmentProvider, FulfillmentProviderUnavailable> => {
  const provider = registry.getProvider(providerKey);
  return provider
    ? Effect.succeed(provider)
    : Effect.fail(new FulfillmentProviderUnavailable({ providerKey }));
};

const normalizeCountryCodes = (
  countryCodes: readonly string[] | undefined
): readonly string[] =>
  (countryCodes ?? []).map((countryCode) => countryCode.toUpperCase());

const normalizeCurrencyCode = (currencyCode: string | undefined) =>
  currencyCode?.toUpperCase();

export const createFulfillmentService = ({
  clock = createDefaultClock(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  providerRegistry = emptyFulfillmentProviderRegistry,
  repository = defaultFulfillmentRepository,
}: CreateFulfillmentServiceOptions = {}): FulfillmentServiceShape => {
  const saveShipmentFromProvider = ({
    fulfillmentId,
    providerShipment,
  }: {
    readonly fulfillmentId: FulfillmentId;
    readonly providerShipment: {
      readonly carrier?: string;
      readonly labelUrl?: string;
      readonly providerShipmentId: string;
      readonly status: ShipmentRecord["status"];
      readonly trackingNumber?: string;
      readonly trackingUrl?: string;
    };
  }) =>
    Effect.gen(function* saveFulfillmentShipmentEffect() {
      const existing =
        yield* repository.findShipmentByFulfillmentId(fulfillmentId);
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
            id: yield* createShipmentRecordIdEffect(
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

      return yield* repository.saveShipment(shipment);
    });

  const requireShippingOption = (shippingOptionId: ShippingOptionId) =>
    Effect.gen(function* requireShippingOptionEffect() {
      const shippingOption =
        yield* repository.findShippingOptionById(shippingOptionId);

      if (!shippingOption) {
        return yield* new ShippingOptionNotFound({ shippingOptionId });
      }

      return shippingOption;
    });

  const requireFulfillment = (fulfillmentId: FulfillmentId) =>
    Effect.gen(function* requireFulfillmentEffect() {
      const fulfillment = yield* repository.findFulfillmentById(fulfillmentId);

      if (!fulfillment) {
        return yield* new FulfillmentNotFound({ fulfillmentId });
      }

      return fulfillment;
    });

  return {
    cancelFulfillment: (input) =>
      Effect.gen(function* cancelFulfillmentEffect() {
        const fulfillment = yield* requireFulfillment(input.fulfillmentId);

        if (fulfillment.status === "canceled") {
          return fulfillment;
        }

        if (fulfillment.providerFulfillmentId) {
          const provider = yield* getProvider(
            providerRegistry,
            fulfillment.providerKey
          );
          yield* provider.cancelFulfillment({
            providerFulfillmentId: fulfillment.providerFulfillmentId,
            reason: input.reason,
          });
        }

        const saved = yield* repository.saveFulfillment({
          ...fulfillment,
          status: "canceled",
          updatedAt: clock.now(),
        });

        yield* publishFulfillmentEvent(
          eventPublisher,
          createEventEnvelope({
            id: createPrefixedId(idGenerator, "evt_"),
            name: FULFILLMENT_CANCELED_EVENT,
            payload: { id: saved.id, reason: input.reason },
            sourceModule: "fulfillment",
            subject: { id: saved.id, type: "fulfillment" },
          })
        );

        return saved;
      }),
    createFulfillment: (input) =>
      Effect.gen(function* createFulfillmentEffect() {
        const duplicate = yield* repository.findFulfillmentByIdempotencyKey(
          input.idempotencyKey
        );

        if (duplicate) {
          const shipments = yield* repository.listShipmentsForFulfillment(
            duplicate.id
          );
          return { fulfillment: duplicate, shipments };
        }

        const shippingOption = yield* requireShippingOption(
          input.shippingOptionId
        );
        const provider = yield* getProvider(
          providerRegistry,
          shippingOption.providerKey
        );
        const validation = yield* provider.validateOption({
          address: input.address,
          items: input.items,
          providerServiceId: shippingOption.providerServiceId,
        });

        if (!validation.valid) {
          return yield* new FulfillmentValidationFailure({
            message:
              validation.reason ??
              `Shipping option "${input.shippingOptionId}" was rejected.`,
          });
        }

        const providerFulfillment = yield* provider.createFulfillment({
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
          id: yield* createFulfillmentIdEffect(
            createPrefixedId(idGenerator, FULFILLMENT_ID_PREFIX)
          ),
          idempotencyKey: input.idempotencyKey,
          items: input.items,
          metadata: input.metadata ?? {},
          orderId: input.orderId,
          providerFulfillmentId: providerFulfillment.providerFulfillmentId,
          providerKey: shippingOption.providerKey,
          shippingOptionId: input.shippingOptionId,
          status: providerFulfillment.status,
          updatedAt: now,
        };
        const saved = yield* repository.saveFulfillment(fulfillment);
        const shipments = providerFulfillment.shipment
          ? [
              yield* saveShipmentFromProvider({
                fulfillmentId: saved.id,
                providerShipment: providerFulfillment.shipment,
              }),
            ]
          : [];

        yield* publishFulfillmentEvent(
          eventPublisher,
          createEventEnvelope({
            id: createPrefixedId(idGenerator, "evt_"),
            name: FULFILLMENT_CREATED_EVENT,
            payload: { id: saved.id, orderId: saved.orderId },
            sourceModule: "fulfillment",
            subject: { id: saved.id, type: "fulfillment" },
          })
        );

        return { fulfillment: saved, shipments };
      }),
    createFulfillmentSet: (input) =>
      Effect.gen(function* createFulfillmentSetEffect() {
        const now = clock.now();
        const saved = yield* repository.saveFulfillmentSet({
          createdAt: now,
          id: yield* createFulfillmentSetIdEffect(
            createPrefixedId(idGenerator, FULFILLMENT_SET_ID_PREFIX)
          ),
          metadata: input.metadata ?? {},
          name: input.name,
          updatedAt: now,
        });

        yield* publishFulfillmentEvent(
          eventPublisher,
          createEventEnvelope({
            id: createPrefixedId(idGenerator, "evt_"),
            name: FULFILLMENT_SET_CREATED_EVENT,
            payload: { id: saved.id, name: saved.name },
            sourceModule: "fulfillment",
            subject: { id: saved.id, type: "fulfillment-set" },
          })
        );

        return saved;
      }),
    createServiceZone: (input) =>
      Effect.gen(function* createServiceZoneEffect() {
        const fulfillmentSet = yield* repository.findFulfillmentSetById(
          input.fulfillmentSetId
        );

        if (!fulfillmentSet) {
          return yield* new FulfillmentSetNotFound({
            fulfillmentSetId: input.fulfillmentSetId,
          });
        }

        const now = clock.now();
        return yield* repository.saveServiceZone({
          countryCodes: normalizeCountryCodes(input.countryCodes),
          createdAt: now,
          fulfillmentSetId: input.fulfillmentSetId,
          id: yield* createServiceZoneIdEffect(
            createPrefixedId(idGenerator, SERVICE_ZONE_ID_PREFIX)
          ),
          metadata: input.metadata ?? {},
          name: input.name,
          regionIds: input.regionIds ?? [],
          updatedAt: now,
        });
      }),
    createShippingOption: (input) =>
      Effect.gen(function* createShippingOptionEffect() {
        const fulfillmentSet = yield* repository.findFulfillmentSetById(
          input.fulfillmentSetId
        );

        if (!fulfillmentSet) {
          return yield* new FulfillmentSetNotFound({
            fulfillmentSetId: input.fulfillmentSetId,
          });
        }

        const shippingProfile = yield* repository.findShippingProfileById(
          input.profileId
        );

        if (!shippingProfile) {
          return yield* new ShippingProfileNotFound({
            profileId: input.profileId,
          });
        }

        if (shippingProfile.fulfillmentSetId !== input.fulfillmentSetId) {
          return yield* new FulfillmentValidationFailure({
            message: `Shipping profile "${input.profileId}" does not belong to fulfillment set "${input.fulfillmentSetId}".`,
          });
        }

        const serviceZone = yield* repository.findServiceZoneById(
          input.serviceZoneId
        );

        if (!serviceZone) {
          return yield* new ServiceZoneNotFound({
            serviceZoneId: input.serviceZoneId,
          });
        }

        if (serviceZone.fulfillmentSetId !== input.fulfillmentSetId) {
          return yield* new FulfillmentValidationFailure({
            message: `Service zone "${input.serviceZoneId}" does not belong to fulfillment set "${input.fulfillmentSetId}".`,
          });
        }

        yield* getProvider(providerRegistry, input.providerKey);
        const now = clock.now();
        const saved = yield* repository.saveShippingOption({
          createdAt: now,
          currencyCode: normalizeCurrencyCode(input.currencyCode),
          fulfillmentSetId: input.fulfillmentSetId,
          id: yield* createShippingOptionIdEffect(
            createPrefixedId(idGenerator, SHIPPING_OPTION_ID_PREFIX)
          ),
          isEnabled: true,
          metadata: input.metadata ?? {},
          name: input.name,
          priceAmount: input.priceAmount,
          profileId: input.profileId,
          providerKey: input.providerKey,
          providerServiceId: input.providerServiceId,
          serviceZoneId: input.serviceZoneId,
          updatedAt: now,
        });

        yield* publishFulfillmentEvent(
          eventPublisher,
          createEventEnvelope({
            id: createPrefixedId(idGenerator, "evt_"),
            name: SHIPPING_OPTION_CREATED_EVENT,
            payload: { id: saved.id, providerKey: saved.providerKey },
            sourceModule: "fulfillment",
            subject: { id: saved.id, type: "shipping-option" },
          })
        );

        return saved;
      }),
    createShippingProfile: (input) =>
      Effect.gen(function* createShippingProfileEffect() {
        const fulfillmentSet = yield* repository.findFulfillmentSetById(
          input.fulfillmentSetId
        );

        if (!fulfillmentSet) {
          return yield* new FulfillmentSetNotFound({
            fulfillmentSetId: input.fulfillmentSetId,
          });
        }

        const now = clock.now();
        return yield* repository.saveShippingProfile({
          createdAt: now,
          fulfillmentSetId: input.fulfillmentSetId,
          id: yield* createShippingProfileIdEffect(
            createPrefixedId(idGenerator, SHIPPING_PROFILE_ID_PREFIX)
          ),
          metadata: input.metadata ?? {},
          name: input.name,
          updatedAt: now,
        });
      }),
    getFulfillmentDetail: (id) =>
      Effect.gen(function* getFulfillmentDetailEffect() {
        const fulfillment = yield* repository.findFulfillmentById(id);

        if (!fulfillment) {
          return null;
        }

        const shipments = yield* repository.listShipmentsForFulfillment(
          fulfillment.id
        );

        return { fulfillment, shipments };
      }),
    listFulfillments: repository.listFulfillments,
    listShippingOptions: (input) => repository.listShippingOptions(input),
    rateShippingOption: (shippingOptionId) =>
      Effect.gen(function* rateShippingOptionEffect() {
        const shippingOption = yield* requireShippingOption(shippingOptionId);
        const provider = yield* getProvider(
          providerRegistry,
          shippingOption.providerKey
        );
        const rate = yield* provider.rate({
          providerServiceId: shippingOption.providerServiceId,
        });

        return {
          amount: rate.amount.amount,
          currencyCode: rate.amount.currencyCode,
          providerKey: rate.providerKey,
          shippingOptionId,
        };
      }),
    registerProvider: (providerKey) =>
      Effect.gen(function* registerFulfillmentProviderEffect() {
        yield* getProvider(providerRegistry, providerKey);
        const now = clock.now();
        return yield* repository.saveProviderRecord({
          createdAt: now,
          id: yield* createFulfillmentProviderRecordIdEffect(
            createPrefixedId(idGenerator, FULFILLMENT_PROVIDER_RECORD_ID_PREFIX)
          ),
          isEnabled: true,
          providerKey,
          providerRecordId: providerKey,
          updatedAt: now,
        });
      }),
    trackShipment: (input) =>
      Effect.gen(function* trackShipmentEffect() {
        const fulfillment = yield* requireFulfillment(input.fulfillmentId);

        if (!fulfillment.providerFulfillmentId) {
          return null;
        }

        const provider = yield* getProvider(
          providerRegistry,
          fulfillment.providerKey
        );
        const providerShipment = yield* provider.trackShipment({
          providerFulfillmentId: fulfillment.providerFulfillmentId,
        });

        if (!providerShipment) {
          return null;
        }

        const shipment = yield* saveShipmentFromProvider({
          fulfillmentId: input.fulfillmentId,
          providerShipment,
        });

        if (providerShipment.status === "delivered") {
          yield* repository.saveFulfillment({
            ...fulfillment,
            status: "delivered",
            updatedAt: clock.now(),
          });
        }

        yield* publishFulfillmentEvent(
          eventPublisher,
          createEventEnvelope({
            id: createPrefixedId(idGenerator, "evt_"),
            name: SHIPMENT_TRACKED_EVENT,
            payload: {
              fulfillmentId: input.fulfillmentId,
              shipmentId: shipment.id,
              status: shipment.status,
            },
            sourceModule: "fulfillment",
            subject: { id: shipment.id, type: "shipment" },
          })
        );

        return shipment;
      }),
  };
};

export const defaultFulfillmentService = createFulfillmentService({
  providerRegistry: createFulfillmentProviderRegistry([]),
});

export const FulfillmentServiceLive = Layer.succeed(
  FulfillmentService,
  defaultFulfillmentService
);

export const createFulfillmentServiceLayer = (
  service: FulfillmentServiceShape = createFulfillmentService()
) => Layer.succeed(FulfillmentService, service);

export const FulfillmentServiceLayer = Layer.effect(
  FulfillmentService,
  Effect.gen(function* createFulfillmentServiceLayerEffect() {
    const clock = yield* ClockService;
    const eventPublisher = yield* EventPublisherService;
    const idGenerator = yield* IdGeneratorService;
    const repository = yield* FulfillmentRepositoryService;

    return createFulfillmentService({
      clock,
      eventPublisher,
      idGenerator,
      repository,
    });
  })
);

/**
 * Temporary Promise facade for legacy checkout orchestration until task 8.6 can
 * consume the Effect service directly.
 */
export const createFulfillmentPromiseServiceFromEffectService = (
  service: FulfillmentServiceShape
) => ({
  cancelFulfillment: (input: CancelFulfillmentInput) =>
    Effect.runPromise(service.cancelFulfillment(input)),
  createFulfillment: (input: CreateFulfillmentInput) =>
    Effect.runPromise(service.createFulfillment(input)),
  createFulfillmentSet: (input: CreateFulfillmentSetInput) =>
    Effect.runPromise(service.createFulfillmentSet(input)),
  createServiceZone: (input: CreateServiceZoneInput) =>
    Effect.runPromise(service.createServiceZone(input)),
  createShippingOption: (input: CreateShippingOptionInput) =>
    Effect.runPromise(service.createShippingOption(input)),
  createShippingProfile: (input: CreateShippingProfileInput) =>
    Effect.runPromise(service.createShippingProfile(input)),
  getFulfillmentDetail: (id: FulfillmentId) =>
    Effect.runPromise(service.getFulfillmentDetail(id)),
  listFulfillments: () => Effect.runPromise(service.listFulfillments),
  listShippingOptions: (input?: ShippingOptionLookupInput) =>
    Effect.runPromise(service.listShippingOptions(input)),
  rateShippingOption: (shippingOptionId: ShippingOptionId) =>
    Effect.runPromise(service.rateShippingOption(shippingOptionId)),
  registerProvider: (providerKey: string) =>
    Effect.runPromise(service.registerProvider(providerKey)),
  trackShipment: (input: TrackShipmentInput) =>
    Effect.runPromise(service.trackShipment(input)),
});
