import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import { Context, Layer } from "effect";
import { nanoid } from "nanoid";

import type {
  CreateRegionInput,
  RegionId,
  RegionProviderAvailability,
  RegionRecord,
  RegionRepository,
  RegionValidationResult,
  ValidateRegionInput,
} from "../domain";
import { REGION_ID_PREFIX, createRegionId } from "../domain";
import { defaultRegionSalesChannelRepository } from "../repositories";

export const REGION_CREATED_EVENT = "region.created" as const;

export interface RegionCreatedEventPayload {
  readonly id: string;
  readonly countryCodes: readonly string[];
  readonly currencyCode: string;
}

export interface RegionServiceShape {
  createRegion(input: CreateRegionInput): Promise<RegionRecord>;
  getRegionById(id: RegionId): Promise<RegionRecord | null>;
  listRegions(): Promise<readonly RegionRecord[]>;
  validateRegionConstraints(
    input: ValidateRegionInput
  ): Promise<RegionValidationResult>;
}

export const RegionService = Context.Service<RegionServiceShape>(
  "@ecommerce/region-sales-channel/RegionService"
);

export interface CreateRegionServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly eventPublisher?: EventPublisherServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly repository?: RegionRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => `${REGION_ID_PREFIX}${nanoid()}`,
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

export const createRegionService = ({
  clock = createDefaultClock(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  repository = defaultRegionSalesChannelRepository,
}: CreateRegionServiceOptions = {}): RegionServiceShape => ({
  createRegion: async (input) => {
    const countries = normalizeDistinctValues(
      input.countries,
      normalizeCountryCode
    );
    const currencyCode = normalizeCurrencyCode(input.currencyCode);
    const name = input.name.trim();

    if (!name) {
      throw new Error("Region name is required.");
    }

    if (countries.length === 0) {
      throw new Error("Region must include at least one country.");
    }

    if (!currencyCode) {
      throw new Error("Region currency is required.");
    }

    const now = clock.now();
    const region: RegionRecord = {
      countries,
      createdAt: now,
      currencyCode,
      id: createRegionId(idGenerator.nextId()),
      metadata: input.metadata ?? {},
      name,
      providerAvailability: normalizeProviderAvailability(input),
      updatedAt: now,
    };
    const saved = await repository.saveRegion(region);

    await eventPublisher.publish(
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
    );

    return saved;
  },
  getRegionById: (id) => repository.findRegionById(id),
  listRegions: () => repository.listRegions(),
  validateRegionConstraints: async (input) => {
    const region = await repository.findRegionById(
      createRegionId(input.regionId)
    );
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
  },
});

export const createRegionServiceLayer = (service: RegionServiceShape) =>
  Layer.succeed(RegionService, service);

export const defaultRegionService = createRegionService({
  repository: defaultRegionSalesChannelRepository,
});
