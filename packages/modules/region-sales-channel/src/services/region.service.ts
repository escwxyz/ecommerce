import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import {
  ClockService,
  EventPublisherService,
  IdGeneratorService,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import { nanoid } from "nanoid";

import type {
  CreateRegionInput,
  RegionId,
  RegionProviderAvailability,
  RegionRecord,
  RegionRepository,
  RegionSalesChannelExpectedError,
  RegionValidationResult,
  ValidateRegionInput,
} from "../domain";
import {
  REGION_ID_PREFIX,
  RegionRepositoryService,
  RegionSalesChannelEventPublishFailure,
  RegionValidationFailure,
  createRegionIdEffect,
} from "../domain";

export const REGION_CREATED_EVENT = "region.created" as const;

export interface RegionCreatedEventPayload {
  readonly id: string;
  readonly countryCodes: readonly string[];
  readonly currencyCode: string;
}

export type RegionServiceFailure = RegionSalesChannelExpectedError;

export interface RegionServiceShape {
  readonly createRegion: (
    input: CreateRegionInput
  ) => EffectValue<RegionRecord, RegionServiceFailure>;
  readonly getRegionById: (
    id: RegionId
  ) => EffectValue<RegionRecord | null, RegionServiceFailure>;
  readonly listRegions: EffectValue<
    readonly RegionRecord[],
    RegionServiceFailure
  >;
  readonly validateRegionConstraints: (
    input: ValidateRegionInput
  ) => EffectValue<RegionValidationResult, RegionServiceFailure>;
}

export const RegionService = Context.Service<RegionServiceShape>(
  "@ecommerce/region-sales-channel/RegionService"
);

export interface CreateRegionServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly eventPublisher?: EventPublisherServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly repository: RegionRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
});

const createNoopEventPublisher = (): EventPublisherServiceShape => ({
  publish: () => {
    // Region events are optional until a runtime event bus is composed.
  },
});

const normalizeCurrencyCode = (currencyCode: string): string =>
  currencyCode.trim().toUpperCase();

const normalizeCountryCode = (countryCode: string): string =>
  countryCode.trim().toUpperCase();

const normalizeDistinctValues = (
  values: readonly string[],
  normalize: (value: string) => string
): string[] => {
  const seen = new Set<string>();
  const normalizedValues: string[] = [];

  for (const value of values) {
    const normalizedValue = normalize(value);

    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    normalizedValues.push(normalizedValue);
  }

  return normalizedValues;
};

const normalizeProviderAvailability = (
  input: CreateRegionInput
): RegionProviderAvailability => ({
  fulfillmentOptionIds: normalizeDistinctValues(
    input.fulfillmentOptionIds ?? [],
    (value) => value.trim()
  ),
  paymentProviderIds: normalizeDistinctValues(
    input.paymentProviderIds ?? [],
    (value) => value.trim()
  ),
  taxProviderId: input.taxProviderId?.trim() || null,
});

const createPrefixedId = (
  idGenerator: IdGeneratorServiceShape,
  prefix: string
): string => {
  const nextId = idGenerator.nextId();
  return nextId.startsWith(prefix) ? nextId : `${prefix}${nextId}`;
};

const toEventPublishFailure = ({
  entityId,
  eventName,
}: {
  readonly entityId: string;
  readonly eventName: string;
}): RegionSalesChannelEventPublishFailure =>
  new RegionSalesChannelEventPublishFailure({
    entityId,
    eventName,
    reason: "event-publish-failed",
  });

export const createRegionService = ({
  clock = createDefaultClock(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  repository,
}: CreateRegionServiceOptions): RegionServiceShape => ({
  createRegion: (input) =>
    Effect.gen(function* createRegionEffect() {
      const countries = normalizeDistinctValues(
        input.countries,
        normalizeCountryCode
      );
      const currencyCode = normalizeCurrencyCode(input.currencyCode);
      const name = input.name.trim();

      if (!name) {
        return yield* new RegionValidationFailure({
          message: "Region name is required.",
        });
      }

      if (countries.length === 0) {
        return yield* new RegionValidationFailure({
          message: "Region must include at least one country.",
        });
      }

      if (!currencyCode) {
        return yield* new RegionValidationFailure({
          message: "Region currency is required.",
        });
      }

      const now = clock.now();
      const id = yield* createRegionIdEffect(
        createPrefixedId(idGenerator, REGION_ID_PREFIX)
      );
      const region: RegionRecord = {
        countries,
        createdAt: now,
        currencyCode,
        id,
        metadata: input.metadata ?? {},
        name,
        providerAvailability: normalizeProviderAvailability(input),
        updatedAt: now,
      };
      const saved = yield* repository.saveRegion(region);

      yield* Effect.tryPromise({
        catch: () =>
          toEventPublishFailure({
            entityId: saved.id,
            eventName: REGION_CREATED_EVENT,
          }),
        try: () =>
          Promise.resolve(
            eventPublisher.publish(
              createEventEnvelope({
                id: idGenerator.nextId(),
                name: REGION_CREATED_EVENT,
                payload: {
                  countryCodes: saved.countries,
                  currencyCode: saved.currencyCode,
                  id: saved.id,
                } satisfies RegionCreatedEventPayload,
                sourceModule: "region",
                subject: {
                  id: saved.id,
                  type: "region",
                },
              })
            )
          ),
      });

      return saved;
    }),
  getRegionById: (id) => repository.findRegionById(id),
  listRegions: repository.listRegions,
  validateRegionConstraints: (input) =>
    Effect.gen(function* validateRegionConstraintsEffect() {
      const region = yield* repository.findRegionById(input.regionId);
      const reasons: string[] = [];

      if (!region) {
        return {
          allowed: false,
          reasons: ["region-not-found"],
        };
      }

      if (
        input.currencyCode &&
        region.currencyCode !== normalizeCurrencyCode(input.currencyCode)
      ) {
        reasons.push("currency-not-allowed");
      }

      if (
        input.countryCode &&
        !region.countries.includes(normalizeCountryCode(input.countryCode))
      ) {
        reasons.push("country-not-allowed");
      }

      if (
        input.paymentProviderId &&
        !region.providerAvailability.paymentProviderIds.includes(
          input.paymentProviderId
        )
      ) {
        reasons.push("payment-provider-not-available");
      }

      if (
        input.fulfillmentOptionId &&
        !region.providerAvailability.fulfillmentOptionIds.includes(
          input.fulfillmentOptionId
        )
      ) {
        reasons.push("fulfillment-option-not-available");
      }

      return {
        allowed: reasons.length === 0,
        reasons,
      };
    }),
});

export const createRegionRepositoryLayer = (repository: RegionRepository) =>
  Layer.succeed(RegionRepositoryService, repository);

export const createRegionServiceFromDependenciesLayer = () =>
  Layer.effect(
    RegionService,
    Effect.gen(function* regionServiceLayerEffect() {
      const clock = yield* ClockService;
      const eventPublisher = yield* EventPublisherService;
      const idGenerator = yield* IdGeneratorService;
      const repository = yield* RegionRepositoryService;

      return createRegionService({
        clock,
        eventPublisher,
        idGenerator,
        repository,
      });
    })
  );

export const createRegionServiceLayer = (service: RegionServiceShape) =>
  Layer.succeed(RegionService, service);
