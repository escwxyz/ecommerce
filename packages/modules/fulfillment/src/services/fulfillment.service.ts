import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
  OutboxWriterServiceShape,
  TransactionBoundaryServiceShape,
  CurrentTransactionService,
} from "@ecommerce/core";
import {
  COMMERCE_EVENTS_OUTBOX_TOPIC,
  createCorrelationContext,
  createEventEnvelope,
  executeTransactionalMutation,
} from "@ecommerce/core";
import type { CommerceEventEnvelope } from "@ecommerce/core/events";
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
import { DEFAULT_FULFILLMENT_PROVIDER_CANCELLATION_TIMEOUT_MS } from "../providers";

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
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly outboxWriter: OutboxWriterServiceShape;
  readonly providerCancellationTimeoutMs?: number;
  readonly providerRegistry: FulfillmentProviderRegistry;
  readonly repository: FulfillmentRepository;
  readonly transactionBoundary: TransactionBoundaryServiceShape;
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

const providerCorrelation = (requestId: string) =>
  createCorrelationContext({ requestId });

const providerCancellationIdempotencyKey = (
  fulfillmentId: FulfillmentId
): string => `fulfillment.cancel:${fulfillmentId}`;

const cancellationCommandsMetadataKey = "fulfillmentCancellationCommands";

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const providerCancellationTimeoutFailure = (timeoutMs: number) =>
  new FulfillmentValidationFailure({
    message: `Fulfillment provider cancellation timed out after ${timeoutMs}ms.`,
  });

const withProviderCancellationTimeout = (
  effect: EffectValue<void, FulfillmentExpectedError>,
  timeoutMs: number
) =>
  effect.pipe(
    Effect.timeoutOrElse({
      duration: `${timeoutMs} millis`,
      orElse: () => Effect.fail(providerCancellationTimeoutFailure(timeoutMs)),
    })
  );

const withCancellationCommandMetadata = ({
  clock,
  fulfillment,
  idempotencyKey,
  reason,
}: {
  readonly clock: ClockServiceShape;
  readonly fulfillment: Fulfillment;
  readonly idempotencyKey: string;
  readonly reason?: string;
}): Fulfillment => {
  const existingCommands =
    fulfillment.metadata[cancellationCommandsMetadataKey];
  const commands = isObjectRecord(existingCommands) ? existingCommands : {};
  const now = clock.now();

  return {
    ...fulfillment,
    metadata: {
      ...fulfillment.metadata,
      [cancellationCommandsMetadataKey]: {
        ...commands,
        [idempotencyKey]: {
          idempotencyKey,
          reason,
          requestedAt: now.toISOString(),
          status: "provider-cancellation-requested",
        },
      },
    },
    updatedAt: now,
  };
};

const publishFulfillmentEvent = (
  outboxWriter: OutboxWriterServiceShape,
  event: CommerceEventEnvelope,
  idempotencyKey: string
) =>
  outboxWriter.enqueue({
    event,
    idempotencyKey: `${event.name}:${idempotencyKey}`,
    topic: COMMERCE_EVENTS_OUTBOX_TOPIC,
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
  idGenerator = createDefaultIdGenerator(),
  outboxWriter,
  providerCancellationTimeoutMs = DEFAULT_FULFILLMENT_PROVIDER_CANCELLATION_TIMEOUT_MS,
  providerRegistry,
  repository,
  transactionBoundary,
}: CreateFulfillmentServiceOptions): FulfillmentServiceShape => {
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

  const service = {
    cancelFulfillment: (input: CancelFulfillmentInput) =>
      Effect.gen(function* cancelFulfillmentEffect() {
        const fulfillment = yield* requireFulfillment(input.fulfillmentId);

        if (fulfillment.status === "canceled") {
          return fulfillment;
        }

        const saved = yield* repository.saveFulfillment({
          ...fulfillment,
          status: "canceled",
          updatedAt: clock.now(),
        });

        yield* publishFulfillmentEvent(
          outboxWriter,
          createEventEnvelope({
            id: createPrefixedId(idGenerator, "evt_"),
            name: FULFILLMENT_CANCELED_EVENT,
            payload: { id: saved.id, reason: input.reason },
            sourceModule: "fulfillment",
            subject: { id: saved.id, type: "fulfillment" },
          }),
          `${FULFILLMENT_CANCELED_EVENT}:${saved.id}`
        );

        return saved;
      }),
    createFulfillment: (input: CreateFulfillmentInput) =>
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
          correlation: providerCorrelation(input.idempotencyKey),
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
          correlation: providerCorrelation(input.idempotencyKey),
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
          outboxWriter,
          createEventEnvelope({
            id: createPrefixedId(idGenerator, "evt_"),
            name: FULFILLMENT_CREATED_EVENT,
            payload: { id: saved.id, orderId: saved.orderId },
            sourceModule: "fulfillment",
            subject: { id: saved.id, type: "fulfillment" },
          }),
          input.idempotencyKey
        );

        return { fulfillment: saved, shipments };
      }),
    createFulfillmentSet: (input: CreateFulfillmentSetInput) =>
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
          outboxWriter,
          createEventEnvelope({
            id: createPrefixedId(idGenerator, "evt_"),
            name: FULFILLMENT_SET_CREATED_EVENT,
            payload: { id: saved.id, name: saved.name },
            sourceModule: "fulfillment",
            subject: { id: saved.id, type: "fulfillment-set" },
          }),
          `${FULFILLMENT_SET_CREATED_EVENT}:${saved.id}`
        );

        return saved;
      }),
    createServiceZone: (input: CreateServiceZoneInput) =>
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
    createShippingOption: (input: CreateShippingOptionInput) =>
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
          outboxWriter,
          createEventEnvelope({
            id: createPrefixedId(idGenerator, "evt_"),
            name: SHIPPING_OPTION_CREATED_EVENT,
            payload: { id: saved.id, providerKey: saved.providerKey },
            sourceModule: "fulfillment",
            subject: { id: saved.id, type: "shipping-option" },
          }),
          `${SHIPPING_OPTION_CREATED_EVENT}:${saved.id}`
        );

        return saved;
      }),
    createShippingProfile: (input: CreateShippingProfileInput) =>
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
    getFulfillmentDetail: (id: FulfillmentId) =>
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
    listShippingOptions: (input?: ShippingOptionLookupInput) =>
      repository.listShippingOptions(input),
    rateShippingOption: (shippingOptionId: ShippingOptionId) =>
      Effect.gen(function* rateShippingOptionEffect() {
        const shippingOption = yield* requireShippingOption(shippingOptionId);
        const provider = yield* getProvider(
          providerRegistry,
          shippingOption.providerKey
        );
        const rate = yield* provider.rate({
          correlation: providerCorrelation(shippingOptionId),
          providerServiceId: shippingOption.providerServiceId,
        });

        return {
          amount: rate.amount.amount,
          currencyCode: rate.amount.currencyCode,
          providerKey: rate.providerKey,
          shippingOptionId,
        };
      }),
    registerProvider: (providerKey: string) =>
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
    trackShipment: (input: TrackShipmentInput) =>
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
          correlation: providerCorrelation(input.fulfillmentId),
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
          outboxWriter,
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
          }),
          `${SHIPMENT_TRACKED_EVENT}:${shipment.id}:${shipment.status}`
        );

        return shipment;
      }),
  };

  const transactionalFulfillmentMutation = <A, E>(
    operation: string,
    effect: EffectValue<A, E, CurrentTransactionService>
  ) =>
    executeTransactionalMutation<A, E, never>({
      effect,
      moduleName: "fulfillment",
      operation,
      outboxMessages: () => [],
      outboxWriter,
      transactionBoundary,
    });

  return {
    ...service,
    cancelFulfillment: (input) =>
      Effect.gen(function* cancelFulfillmentOperation() {
        const fulfillment = yield* requireFulfillment(input.fulfillmentId);

        if (fulfillment.status === "canceled") {
          return fulfillment;
        }

        if (fulfillment.providerFulfillmentId) {
          const provider = yield* getProvider(
            providerRegistry,
            fulfillment.providerKey
          );
          const idempotencyKey = providerCancellationIdempotencyKey(
            fulfillment.id
          );

          yield* transactionalFulfillmentMutation(
            "requestFulfillmentCancellation",
            repository.saveFulfillment(
              withCancellationCommandMetadata({
                clock,
                fulfillment,
                idempotencyKey,
                reason: input.reason,
              })
            )
          );

          // External side effects cannot participate in the local SQL transaction.
          // The durable command marker plus stable key make retry/reconciliation safe
          // if final status/event persistence fails to commit.
          yield* withProviderCancellationTimeout(
            provider.cancelFulfillment({
              correlation: providerCorrelation(idempotencyKey),
              idempotencyKey,
              providerFulfillmentId: fulfillment.providerFulfillmentId,
              reason: input.reason,
            }),
            providerCancellationTimeoutMs
          );
        }

        return yield* transactionalFulfillmentMutation(
          "cancelFulfillment",
          service.cancelFulfillment(input)
        );
      }),
    createFulfillment: (input) =>
      transactionalFulfillmentMutation(
        "createFulfillment",
        service.createFulfillment(input)
      ),
    createFulfillmentSet: (input) =>
      transactionalFulfillmentMutation(
        "createFulfillmentSet",
        service.createFulfillmentSet(input)
      ),
    createServiceZone: (input) =>
      transactionalFulfillmentMutation(
        "createServiceZone",
        service.createServiceZone(input)
      ),
    createShippingOption: (input) =>
      transactionalFulfillmentMutation(
        "createShippingOption",
        service.createShippingOption(input)
      ),
    createShippingProfile: (input) =>
      transactionalFulfillmentMutation(
        "createShippingProfile",
        service.createShippingProfile(input)
      ),
    registerProvider: (providerKey) =>
      transactionalFulfillmentMutation(
        "registerProvider",
        service.registerProvider(providerKey)
      ),
    trackShipment: (input) =>
      transactionalFulfillmentMutation(
        "trackShipment",
        service.trackShipment(input)
      ),
  };
};

export const createFulfillmentServiceLayer = (
  service: FulfillmentServiceShape
) => Layer.succeed(FulfillmentService, service);
