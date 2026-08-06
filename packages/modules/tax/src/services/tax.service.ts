import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { createCorrelationContext, createEventEnvelope } from "@ecommerce/core";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import { nanoid } from "nanoid";

import type {
  CalculateTaxInput,
  CreateTaxCategoryInput,
  CreateTaxProviderConfigInput,
  CreateTaxRateInput,
  CreateTaxRegionInput,
  TaxCalculationResult,
  TaxCategoryRecord,
  TaxExpectedError,
  TaxProviderConfigRecord,
  TaxRateRecord,
  TaxRegionRecord,
  TaxRepository,
} from "../domain";
import {
  TAX_CALCULATION_ID_PREFIX,
  TAX_CATEGORY_ID_PREFIX,
  TAX_LINE_ID_PREFIX,
  TAX_PROVIDER_CONFIG_ID_PREFIX,
  TAX_RATE_ID_PREFIX,
  TAX_REGION_ID_PREFIX,
  TaxCategoryNotFound,
  TaxProviderConfigNotFound,
  TaxProviderUnavailable,
  TaxRegionNotFound,
  TaxValidationFailure,
  createTaxCalculationIdEffect,
  createTaxCategoryIdEffect,
  createTaxLineIdEffect,
  createTaxProviderConfigIdEffect,
  createTaxRateIdEffect,
  createTaxRegionIdEffect,
} from "../domain";
import { findTaxProvider } from "../providers";
import type { TaxProvider } from "../providers";

export const TAX_CATEGORY_CREATED_EVENT = "tax.category-created" as const;
export const TAX_PROVIDER_CONFIGURED_EVENT = "tax.provider-configured" as const;
export const TAX_REGION_CREATED_EVENT = "tax.region-created" as const;
export const TAX_RATE_CREATED_EVENT = "tax.rate-created" as const;
export const TAX_CALCULATED_EVENT = "tax.calculated" as const;

export interface TaxCategoryCreatedEventPayload {
  readonly code: string;
  readonly id: string;
}

export interface TaxProviderConfiguredEventPayload {
  readonly id: string;
  readonly providerKey: string;
}

export interface TaxRegionCreatedEventPayload {
  readonly code: string;
  readonly id: string;
}

export interface TaxRateCreatedEventPayload {
  readonly id: string;
  readonly percentage: number;
  readonly regionId: string;
}

export interface TaxCalculatedEventPayload {
  readonly id: string;
  readonly lineCount: number;
  readonly providerKey: string;
  readonly regionId: string;
  readonly totalTax: number;
}

export interface TaxServiceShape {
  readonly calculateTax: (
    input: CalculateTaxInput
  ) => EffectValue<TaxCalculationResult, TaxExpectedError>;
  readonly createCategory: (
    input: CreateTaxCategoryInput
  ) => EffectValue<TaxCategoryRecord, TaxExpectedError>;
  readonly createProviderConfig: (
    input: CreateTaxProviderConfigInput
  ) => EffectValue<TaxProviderConfigRecord, TaxExpectedError>;
  readonly createRate: (
    input: CreateTaxRateInput
  ) => EffectValue<TaxRateRecord, TaxExpectedError>;
  readonly createRegion: (
    input: CreateTaxRegionInput
  ) => EffectValue<TaxRegionRecord, TaxExpectedError>;
}

export const TaxService = Context.Service<TaxServiceShape>(
  "@ecommerce/tax/TaxService"
);

export interface CreateTaxServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly eventPublisher?: EventPublisherServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly providers: readonly TaxProvider[];
  readonly repository: TaxRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
});

const createNoopEventPublisher = (): EventPublisherServiceShape => ({
  publish: () => {
    // Tax events are optional until a runtime event bus is composed.
  },
});

const createId = (
  prefix: string,
  idGenerator: IdGeneratorServiceShape
): string => {
  const rawId = idGenerator.nextId();
  return rawId.startsWith(prefix) ? rawId : `${prefix}${rawId}`;
};

const normalizeCode = (value: string): string => value.trim().toUpperCase();
const normalizeText = (value: string): string => value.trim();
const providerCorrelation = (requestId: string) =>
  createCorrelationContext({ requestId });

const publishTaxEvent = (
  eventPublisher: EventPublisherServiceShape,
  event: Parameters<EventPublisherServiceShape["publish"]>[0]
) =>
  Effect.tryPromise({
    catch: () =>
      new TaxValidationFailure({
        message: "Tax event publication failed.",
      }),
    try: async () => {
      await eventPublisher.publish(event);
    },
  });

const getProviderConfig = ({
  region,
  repository,
}: {
  readonly region: TaxRegionRecord;
  readonly repository: TaxRepository;
}) =>
  Effect.gen(function* getTaxProviderConfigEffect() {
    if (region.providerConfigId) {
      return yield* repository.findProviderConfigById(region.providerConfigId);
    }

    return yield* repository.findActiveProviderConfigByKey("manual");
  });

export const createTaxService = ({
  clock = createDefaultClock(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  providers,
  repository,
}: CreateTaxServiceOptions): TaxServiceShape => ({
  calculateTax: (input) =>
    Effect.gen(function* calculateTaxEffect() {
      const region = yield* repository.findRegionById(input.regionId);

      if (!region) {
        return yield* new TaxRegionNotFound({ regionId: input.regionId });
      }

      const providerConfig = yield* getProviderConfig({ region, repository });

      if (!providerConfig || !providerConfig.isActive) {
        return yield* new TaxProviderUnavailable({ providerKey: "manual" });
      }

      const provider = findTaxProvider(providers, providerConfig.providerKey);

      if (!provider) {
        return yield* new TaxProviderUnavailable({
          providerKey: providerConfig.providerKey,
        });
      }

      const currencyCode = normalizeCode(input.currencyCode);
      const rates = yield* repository.findRatesByRegionId(region.id);
      const providerResult = yield* provider.calculateTax(input, {
        correlation: providerCorrelation(`tax:${region.id}`),
        createLineId: () =>
          Effect.runSync(
            createTaxLineIdEffect(createId(TAX_LINE_ID_PREFIX, idGenerator))
          ),
        currencyCode,
        rates,
      });
      const id = yield* createTaxCalculationIdEffect(
        createId(TAX_CALCULATION_ID_PREFIX, idGenerator)
      );
      const result: TaxCalculationResult = {
        ...providerResult,
        currencyCode,
        id,
        providerKey: provider.key,
        regionId: region.id,
      };

      yield* publishTaxEvent(
        eventPublisher,
        createEventEnvelope({
          id: createId("evt_", idGenerator),
          name: TAX_CALCULATED_EVENT,
          payload: {
            id: result.id,
            lineCount: result.lines.length,
            providerKey: result.providerKey,
            regionId: result.regionId,
            totalTax: result.totalTax,
          } satisfies TaxCalculatedEventPayload,
          sourceModule: "tax",
          subject: {
            id: result.regionId,
            type: "tax-region",
          },
        })
      );

      return result;
    }),
  createCategory: (input) =>
    Effect.gen(function* createTaxCategoryEffect() {
      const name = normalizeText(input.name);

      if (!name) {
        return yield* new TaxValidationFailure({
          message: "Tax category name is required.",
        });
      }

      const now = clock.now();
      const category: TaxCategoryRecord = {
        code: normalizeCode(input.code),
        createdAt: now,
        description: input.description?.trim() || null,
        id: yield* createTaxCategoryIdEffect(
          createId(TAX_CATEGORY_ID_PREFIX, idGenerator)
        ),
        metadata: input.metadata ?? {},
        name,
        updatedAt: now,
      };
      const saved = yield* repository.saveCategory(category);

      yield* publishTaxEvent(
        eventPublisher,
        createEventEnvelope({
          id: createId("evt_", idGenerator),
          name: TAX_CATEGORY_CREATED_EVENT,
          payload: {
            code: saved.code,
            id: saved.id,
          } satisfies TaxCategoryCreatedEventPayload,
          sourceModule: "tax",
          subject: {
            id: saved.id,
            type: "tax-category",
          },
        })
      );

      return saved;
    }),
  createProviderConfig: (input) =>
    Effect.gen(function* createTaxProviderConfigEffect() {
      const providerKey = normalizeText(input.providerKey);
      const provider = findTaxProvider(providers, providerKey);

      if (!provider) {
        return yield* new TaxProviderUnavailable({ providerKey });
      }

      if (provider.validateConfig) {
        yield* provider.validateConfig(input.settings ?? {});
      }

      const now = clock.now();
      const providerConfig: TaxProviderConfigRecord = {
        createdAt: now,
        id: yield* createTaxProviderConfigIdEffect(
          createId(TAX_PROVIDER_CONFIG_ID_PREFIX, idGenerator)
        ),
        isActive: input.isActive ?? true,
        metadata: input.metadata ?? {},
        providerKey,
        settings: input.settings ?? {},
        updatedAt: now,
      };
      const saved = yield* repository.saveProviderConfig(providerConfig);

      yield* publishTaxEvent(
        eventPublisher,
        createEventEnvelope({
          id: createId("evt_", idGenerator),
          name: TAX_PROVIDER_CONFIGURED_EVENT,
          payload: {
            id: saved.id,
            providerKey: saved.providerKey,
          } satisfies TaxProviderConfiguredEventPayload,
          sourceModule: "tax",
          subject: {
            id: saved.id,
            type: "tax-provider-config",
          },
        })
      );

      return saved;
    }),
  createRate: (input) =>
    Effect.gen(function* createTaxRateEffect() {
      const region = yield* repository.findRegionById(input.regionId);

      if (!region) {
        return yield* new TaxRegionNotFound({ regionId: input.regionId });
      }

      const categoryId = input.categoryId ?? null;

      if (categoryId && !(yield* repository.findCategoryById(categoryId))) {
        return yield* new TaxCategoryNotFound({ categoryId });
      }

      const now = clock.now();
      const rate: TaxRateRecord = {
        categoryId,
        createdAt: now,
        id: yield* createTaxRateIdEffect(
          createId(TAX_RATE_ID_PREFIX, idGenerator)
        ),
        metadata: input.metadata ?? {},
        name: normalizeText(input.name),
        percentage: input.percentage,
        regionId: region.id,
        updatedAt: now,
      };
      const saved = yield* repository.saveRate(rate);

      yield* publishTaxEvent(
        eventPublisher,
        createEventEnvelope({
          id: createId("evt_", idGenerator),
          name: TAX_RATE_CREATED_EVENT,
          payload: {
            id: saved.id,
            percentage: saved.percentage,
            regionId: saved.regionId,
          } satisfies TaxRateCreatedEventPayload,
          sourceModule: "tax",
          subject: {
            id: saved.id,
            type: "tax-rate",
          },
        })
      );

      return saved;
    }),
  createRegion: (input) =>
    Effect.gen(function* createTaxRegionEffect() {
      const providerConfigId = input.providerConfigId ?? null;

      if (
        providerConfigId &&
        !(yield* repository.findProviderConfigById(providerConfigId))
      ) {
        return yield* new TaxProviderConfigNotFound({ providerConfigId });
      }

      const now = clock.now();
      const region: TaxRegionRecord = {
        code: normalizeCode(input.code),
        countryCode: normalizeCode(input.countryCode),
        createdAt: now,
        id: yield* createTaxRegionIdEffect(
          createId(TAX_REGION_ID_PREFIX, idGenerator)
        ),
        metadata: input.metadata ?? {},
        name: normalizeText(input.name),
        providerConfigId,
        updatedAt: now,
      };
      const saved = yield* repository.saveRegion(region);

      yield* publishTaxEvent(
        eventPublisher,
        createEventEnvelope({
          id: createId("evt_", idGenerator),
          name: TAX_REGION_CREATED_EVENT,
          payload: {
            code: saved.code,
            id: saved.id,
          } satisfies TaxRegionCreatedEventPayload,
          sourceModule: "tax",
          subject: {
            id: saved.id,
            type: "tax-region",
          },
        })
      );

      return saved;
    }),
});

export const createTaxServiceLayer = (service: TaxServiceShape) =>
  Layer.succeed(TaxService, service);

export const createTaxServiceLayerFromRepository = (
  repository: TaxRepository,
  providers: readonly TaxProvider[]
) => createTaxServiceLayer(createTaxService({ providers, repository }));
