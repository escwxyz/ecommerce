import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import { Context, Layer } from "effect";
import { nanoid } from "nanoid";

import type {
  CalculateTaxInput,
  CreateTaxCategoryInput,
  CreateTaxProviderConfigInput,
  CreateTaxRateInput,
  CreateTaxRegionInput,
  TaxCalculationResult,
  TaxCategoryRecord,
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
  createTaxCalculationId,
  createTaxCategoryId,
  createTaxLineId,
  createTaxProviderConfigId,
  createTaxRateId,
  createTaxRegionId,
} from "../domain";
import { defaultTaxProviders, findTaxProvider } from "../providers";
import type { TaxProvider } from "../providers";
import { defaultTaxRepository } from "../repositories";

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
  calculateTax(input: CalculateTaxInput): Promise<TaxCalculationResult>;
  createCategory(input: CreateTaxCategoryInput): Promise<TaxCategoryRecord>;
  createProviderConfig(
    input: CreateTaxProviderConfigInput
  ): Promise<TaxProviderConfigRecord>;
  createRate(input: CreateTaxRateInput): Promise<TaxRateRecord>;
  createRegion(input: CreateTaxRegionInput): Promise<TaxRegionRecord>;
}

export const TaxService = Context.Service<TaxServiceShape>(
  "@ecommerce/tax/TaxService"
);

export interface CreateTaxServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly eventPublisher?: EventPublisherServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly providers?: readonly TaxProvider[];
  readonly repository?: TaxRepository;
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

const createId = (prefix: string, idGenerator: IdGeneratorServiceShape) => {
  const rawId = idGenerator.nextId();
  return rawId.startsWith(prefix) ? rawId : `${prefix}${rawId}`;
};

const normalizeCode = (value: string): string => value.trim().toUpperCase();
const normalizeText = (value: string): string => value.trim();

const getProviderConfig = ({
  region,
  repository,
}: {
  readonly region: TaxRegionRecord;
  readonly repository: TaxRepository;
}): Promise<TaxProviderConfigRecord | null> => {
  if (region.providerConfigId) {
    return repository.findProviderConfigById(region.providerConfigId);
  }

  return repository.findActiveProviderConfigByKey("manual");
};

export const createTaxService = ({
  clock = createDefaultClock(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  providers = defaultTaxProviders,
  repository = defaultTaxRepository,
}: CreateTaxServiceOptions = {}): TaxServiceShape => ({
  calculateTax: async (input) => {
    const region = await repository.findRegionById(
      createTaxRegionId(input.regionId)
    );

    if (!region) {
      throw new Error(`Tax region "${input.regionId}" was not found.`);
    }

    const providerConfig = await getProviderConfig({ region, repository });

    if (!providerConfig || !providerConfig.isActive) {
      throw new Error(
        `No active tax provider is configured for "${region.id}".`
      );
    }

    const provider = findTaxProvider(providers, providerConfig.providerKey);

    if (!provider) {
      throw new Error(
        `Tax provider "${providerConfig.providerKey}" is not available.`
      );
    }

    const currencyCode = input.currencyCode.trim().toUpperCase();
    const providerResult = await provider.calculateTax(input, {
      createLineId: () =>
        createTaxLineId(createId(TAX_LINE_ID_PREFIX, idGenerator)),
      currencyCode,
      rates: await repository.findRatesByRegionId(region.id),
    });
    const result: TaxCalculationResult = {
      ...providerResult,
      currencyCode,
      id: createTaxCalculationId(
        createId(TAX_CALCULATION_ID_PREFIX, idGenerator)
      ),
      providerKey: provider.key,
      regionId: region.id,
    };

    await eventPublisher.publish(
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
  },
  createCategory: async (input) => {
    const name = normalizeText(input.name);

    if (!name) {
      throw new Error("Tax category name is required.");
    }

    const now = clock.now();
    const category: TaxCategoryRecord = {
      code: normalizeCode(input.code),
      createdAt: now,
      description: input.description?.trim() || null,
      id: createTaxCategoryId(createId(TAX_CATEGORY_ID_PREFIX, idGenerator)),
      metadata: input.metadata ?? {},
      name,
      updatedAt: now,
    };
    const saved = await repository.saveCategory(category);

    await eventPublisher.publish(
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
  },
  createProviderConfig: async (input) => {
    const providerKey = normalizeText(input.providerKey);
    const provider = findTaxProvider(providers, providerKey);

    if (!provider) {
      throw new Error(`Tax provider "${providerKey}" is not available.`);
    }

    await provider.validateConfig?.(input.settings ?? {});

    const now = clock.now();
    const providerConfig: TaxProviderConfigRecord = {
      createdAt: now,
      id: createTaxProviderConfigId(
        createId(TAX_PROVIDER_CONFIG_ID_PREFIX, idGenerator)
      ),
      isActive: input.isActive ?? true,
      metadata: input.metadata ?? {},
      providerKey,
      settings: input.settings ?? {},
      updatedAt: now,
    };
    const saved = await repository.saveProviderConfig(providerConfig);

    await eventPublisher.publish(
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
  },
  createRate: async (input) => {
    const regionId = createTaxRegionId(input.regionId);
    const region = await repository.findRegionById(regionId);

    if (!region) {
      throw new Error(`Tax region "${input.regionId}" was not found.`);
    }

    const categoryId = input.categoryId
      ? createTaxCategoryId(input.categoryId)
      : null;

    if (categoryId && !(await repository.findCategoryById(categoryId))) {
      throw new Error(`Tax category "${input.categoryId}" was not found.`);
    }

    const now = clock.now();
    const rate: TaxRateRecord = {
      categoryId,
      createdAt: now,
      id: createTaxRateId(createId(TAX_RATE_ID_PREFIX, idGenerator)),
      metadata: input.metadata ?? {},
      name: normalizeText(input.name),
      percentage: input.percentage,
      regionId,
      updatedAt: now,
    };
    const saved = await repository.saveRate(rate);

    await eventPublisher.publish(
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
  },
  createRegion: async (input) => {
    const providerConfigId = input.providerConfigId
      ? createTaxProviderConfigId(input.providerConfigId)
      : null;

    if (
      providerConfigId &&
      !(await repository.findProviderConfigById(providerConfigId))
    ) {
      throw new Error(
        `Tax provider config "${input.providerConfigId}" was not found.`
      );
    }

    const now = clock.now();
    const region: TaxRegionRecord = {
      code: normalizeCode(input.code),
      countryCode: normalizeCode(input.countryCode),
      createdAt: now,
      id: createTaxRegionId(createId(TAX_REGION_ID_PREFIX, idGenerator)),
      metadata: input.metadata ?? {},
      name: normalizeText(input.name),
      providerConfigId,
      updatedAt: now,
    };
    const saved = await repository.saveRegion(region);

    await eventPublisher.publish(
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
  },
});

export const createTaxServiceLayer = (service: TaxServiceShape) =>
  Layer.succeed(TaxService, service);

export const defaultTaxService = createTaxService({
  repository: defaultTaxRepository,
});
