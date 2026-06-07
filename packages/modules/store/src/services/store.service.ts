import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import { Context, Layer } from "effect";
import { nanoid } from "nanoid";

import type {
  StoreDefaults,
  StoreRepository,
  StoreSettings,
  UpdateStoreSettingsInput,
} from "../domain";
import { STORE_ID_PREFIX, createStoreId } from "../domain";
import { defaultStoreRepository } from "../repositories";

export const STORE_SETTINGS_UPDATED_EVENT = "store.settings.updated" as const;

export interface StoreSettingsUpdatedEventPayload {
  readonly id: string;
  readonly updatedFields: readonly string[];
}

export interface StoreServiceShape {
  getStoreDefaults(): Promise<StoreDefaults>;
  getStoreSettings(): Promise<StoreSettings>;
  updateStoreSettings(input: UpdateStoreSettingsInput): Promise<StoreSettings>;
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

const normalizeCurrencyCodes = (
  currencyCodes: readonly string[]
): readonly string[] => {
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
    throw new Error("Store must support at least one currency.");
  }

  return normalized;
};

const assertDefaultCurrencySupported = (
  defaultCurrencyCode: string,
  supportedCurrencyCodes: readonly string[]
): void => {
  if (!supportedCurrencyCodes.includes(defaultCurrencyCode)) {
    throw new Error(
      `Default currency "${defaultCurrencyCode}" must be included in supported currencies.`
    );
  }
};

const createInitialSettings = ({
  clock,
  idGenerator,
  initialSettings,
}: {
  readonly clock: ClockServiceShape;
  readonly idGenerator: IdGeneratorServiceShape;
  readonly initialSettings?: StoreSettings;
}): StoreSettings => {
  if (initialSettings) {
    return initialSettings;
  }

  const now = clock.now();
  const defaultCurrencyCode = normalizeCurrencyCode("USD");

  return {
    createdAt: now,
    defaultCurrencyCode,
    defaultLocale: "en-US",
    defaultRegionId: null,
    defaultSalesChannelId: null,
    id: createStoreId(idGenerator.nextId()),
    metadata: {},
    name: "Default store",
    supportedCurrencyCodes: defaultSupportedCurrencyCodes,
    timezone: "UTC",
    updatedAt: now,
  };
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
  const loadOrCreateSettings = async (): Promise<StoreSettings> => {
    const existing = await repository.getStoreSettings();

    if (existing) {
      return existing;
    }

    const created = createInitialSettings({
      clock,
      idGenerator,
      initialSettings,
    });

    assertDefaultCurrencySupported(
      created.defaultCurrencyCode,
      created.supportedCurrencyCodes
    );

    return repository.saveStoreSettings(created);
  };

  return {
    getStoreDefaults: async () => pickDefaults(await loadOrCreateSettings()),
    getStoreSettings: loadOrCreateSettings,
    updateStoreSettings: async (input) => {
      const current = await loadOrCreateSettings();
      const supportedCurrencyCodes = normalizeCurrencyCodes(
        input.supportedCurrencyCodes ?? current.supportedCurrencyCodes
      );
      const defaultCurrencyCode = normalizeCurrencyCode(
        input.defaultCurrencyCode ?? current.defaultCurrencyCode
      );

      assertDefaultCurrencySupported(
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

      const saved = await repository.saveStoreSettings(updated);
      const updatedFields = getUpdatedFields(current, saved);

      if (updatedFields.length > 0) {
        await eventPublisher.publish(
          createEventEnvelope({
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
          })
        );
      }

      return saved;
    },
  };
};

export const createStoreServiceLayer = (service: StoreServiceShape) =>
  Layer.succeed(StoreService, service);

export const defaultStoreService = createStoreService({
  repository: defaultStoreRepository,
});
