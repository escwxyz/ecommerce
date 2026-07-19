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
  StoreDefaults,
  StoreExpectedError,
  StoreRepository,
  StoreSettings,
  UpdateStoreSettingsInput,
} from "../domain";
import {
  STORE_ID_PREFIX,
  StoreCurrencyListEmpty,
  StoreDefaultCurrencyUnsupported,
  StoreEventPublishFailure,
  StoreRepositoryService,
  createStoreIdEffect,
} from "../domain";
import { defaultStoreRepository } from "../repositories";

export const STORE_SETTINGS_UPDATED_EVENT = "store.settings.updated" as const;

export interface StoreSettingsUpdatedEventPayload {
  readonly id: string;
  readonly updatedFields: readonly string[];
}

export type StoreServiceFailure = StoreExpectedError;

export interface StoreServiceShape {
  readonly getStoreDefaults: EffectValue<StoreDefaults, StoreServiceFailure>;
  readonly getStoreSettings: EffectValue<StoreSettings, StoreServiceFailure>;
  readonly updateStoreSettings: (
    input: UpdateStoreSettingsInput
  ) => EffectValue<StoreSettings, StoreServiceFailure>;
}

export const StoreService = Context.Service<StoreServiceShape>(
  "@ecommerce/store/StoreService"
);

export interface CreateStoreServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly eventPublisher?: EventPublisherServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly initialSettings?: StoreSettings;
  readonly repository?: StoreRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => `${STORE_ID_PREFIX}${nanoid()}`,
});

const createNoopEventPublisher = (): EventPublisherServiceShape => ({
  publish: () => {
    // Optional event publication should not force a runtime dependency.
  },
});

const defaultSupportedCurrencyCodes = ["USD"] as const;

const normalizeCurrencyCode = (currencyCode: string): string =>
  currencyCode.trim().toUpperCase();

const normalizeCurrencyCodesEffect = (
  currencyCodes: readonly string[]
): EffectValue<readonly string[], StoreCurrencyListEmpty> => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const currencyCode of currencyCodes) {
    const normalizedCode = normalizeCurrencyCode(currencyCode);

    if (!normalizedCode || seen.has(normalizedCode)) {
      continue;
    }

    seen.add(normalizedCode);
    normalized.push(normalizedCode);
  }

  if (normalized.length === 0) {
    return Effect.fail(
      new StoreCurrencyListEmpty({
        reason: "no-supported-currencies",
      })
    );
  }

  return Effect.succeed(normalized);
};

const assertDefaultCurrencySupportedEffect = (
  defaultCurrencyCode: string,
  supportedCurrencyCodes: readonly string[]
): EffectValue<void, StoreDefaultCurrencyUnsupported> => {
  if (!supportedCurrencyCodes.includes(defaultCurrencyCode)) {
    return Effect.fail(
      new StoreDefaultCurrencyUnsupported({
        defaultCurrencyCode,
        supportedCurrencyCodes,
      })
    );
  }

  return Effect.void;
};

const createInitialSettingsEffect = ({
  clock,
  idGenerator,
  initialSettings,
}: {
  readonly clock: ClockServiceShape;
  readonly idGenerator: IdGeneratorServiceShape;
  readonly initialSettings?: StoreSettings;
}): EffectValue<StoreSettings, StoreServiceFailure> => {
  if (initialSettings) {
    return Effect.succeed(initialSettings);
  }

  const now = clock.now();
  const defaultCurrencyCode = normalizeCurrencyCode("USD");

  return Effect.map(createStoreIdEffect(idGenerator.nextId()), (id) => ({
    createdAt: now,
    defaultCurrencyCode,
    defaultLocale: "en-US",
    defaultRegionId: null,
    defaultSalesChannelId: null,
    id,
    metadata: {},
    name: "Default store",
    supportedCurrencyCodes: defaultSupportedCurrencyCodes,
    timezone: "UTC",
    updatedAt: now,
  }));
};

const getUpdatedFields = (
  before: StoreSettings,
  after: StoreSettings
): readonly string[] => {
  const fields: string[] = [];

  for (const field of [
    "name",
    "defaultCurrencyCode",
    "supportedCurrencyCodes",
    "defaultRegionId",
    "defaultSalesChannelId",
    "defaultLocale",
    "timezone",
    "metadata",
  ] as const) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      fields.push(field);
    }
  }

  return fields;
};

const toStoreEventPublishFailure = (
  settings: StoreSettings
): StoreEventPublishFailure =>
  new StoreEventPublishFailure({
    eventName: STORE_SETTINGS_UPDATED_EVENT,
    reason: "publisher-rejected",
    storeId: settings.id,
  });

const pickDefaults = (settings: StoreSettings): StoreDefaults => ({
  defaultCurrencyCode: settings.defaultCurrencyCode,
  defaultLocale: settings.defaultLocale,
  defaultRegionId: settings.defaultRegionId,
  defaultSalesChannelId: settings.defaultSalesChannelId,
  supportedCurrencyCodes: settings.supportedCurrencyCodes,
  timezone: settings.timezone,
});

export const createStoreService = ({
  clock = createDefaultClock(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  initialSettings,
  repository = defaultStoreRepository,
}: CreateStoreServiceOptions = {}): StoreServiceShape => {
  const loadOrCreateSettings = Effect.fn("StoreService.loadOrCreateSettings")(
    function* loadOrCreateSettingsEffect() {
      const existing = yield* repository.getStoreSettings;

      if (existing) {
        return existing;
      }

      const created = yield* createInitialSettingsEffect({
        clock,
        idGenerator,
        initialSettings,
      });

      yield* assertDefaultCurrencySupportedEffect(
        created.defaultCurrencyCode,
        created.supportedCurrencyCodes
      );

      return yield* repository.saveStoreSettings(created);
    }
  );

  const updateStoreSettings = Effect.fn("StoreService.updateStoreSettings")(
    function* updateStoreSettingsEffect(input: UpdateStoreSettingsInput) {
      const current = yield* loadOrCreateSettings();
      const supportedCurrencyCodes = yield* normalizeCurrencyCodesEffect(
        input.supportedCurrencyCodes ?? current.supportedCurrencyCodes
      );
      const defaultCurrencyCode = normalizeCurrencyCode(
        input.defaultCurrencyCode ?? current.defaultCurrencyCode
      );

      yield* assertDefaultCurrencySupportedEffect(
        defaultCurrencyCode,
        supportedCurrencyCodes
      );

      const updated: StoreSettings = {
        ...current,
        defaultCurrencyCode,
        defaultLocale: input.defaultLocale?.trim() ?? current.defaultLocale,
        defaultRegionId:
          input.defaultRegionId === undefined
            ? current.defaultRegionId
            : input.defaultRegionId,
        defaultSalesChannelId:
          input.defaultSalesChannelId === undefined
            ? current.defaultSalesChannelId
            : input.defaultSalesChannelId,
        metadata: input.metadata ?? current.metadata,
        name: input.name?.trim() ?? current.name,
        supportedCurrencyCodes,
        timezone: input.timezone?.trim() ?? current.timezone,
        updatedAt: clock.now(),
      };

      const saved = yield* repository.saveStoreSettings(updated);
      const updatedFields = getUpdatedFields(current, saved);

      if (updatedFields.length > 0) {
        const event = createEventEnvelope({
          id: idGenerator.nextId(),
          name: STORE_SETTINGS_UPDATED_EVENT,
          payload: {
            id: saved.id,
            updatedFields,
          } satisfies StoreSettingsUpdatedEventPayload,
          sourceModule: "store",
          subject: {
            id: saved.id,
            type: "store",
          },
        });

        yield* Effect.tryPromise({
          catch: () => toStoreEventPublishFailure(saved),
          try: () => Promise.resolve(eventPublisher.publish(event)),
        });
      }

      return saved;
    }
  );

  return {
    getStoreDefaults: Effect.map(loadOrCreateSettings(), pickDefaults),
    getStoreSettings: loadOrCreateSettings(),
    updateStoreSettings,
  };
};

export const createStoreServiceLayer = (service: StoreServiceShape) =>
  Layer.succeed(StoreService, service);

export const createStoreRepositoryLayer = (repository: StoreRepository) =>
  Layer.succeed(StoreRepositoryService, repository);

export const createStoreServiceFromDependenciesLayer = (
  options: Pick<CreateStoreServiceOptions, "initialSettings"> = {}
) =>
  Layer.effect(
    StoreService,
    Effect.gen(function* createStoreServiceFromDependenciesEffect() {
      const clock = yield* ClockService;
      const eventPublisher = yield* EventPublisherService;
      const idGenerator = yield* IdGeneratorService;
      const repository = yield* StoreRepositoryService;

      return createStoreService({
        clock,
        eventPublisher,
        idGenerator,
        initialSettings: options.initialSettings,
        repository,
      });
    })
  );

export const defaultStoreService = createStoreService({
  repository: defaultStoreRepository,
});
