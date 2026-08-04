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
  CalculatedPrice,
  CalculatePriceInput,
  CreateCurrencyInput,
  CreateMoneyAmountInput,
  CreatePriceListInput,
  CreatePricePreferenceInput,
  CreatePriceRuleInput,
  CreatePriceSetInput,
  CurrencyRecord,
  MoneyAmountRecord,
  PriceListRecord,
  PricePreferenceRecord,
  PriceRuleRecord,
  PriceSetRecord,
  PricingExpectedError,
  PricingRepository,
} from "../domain";
import {
  CURRENCY_ID_PREFIX,
  MONEY_AMOUNT_ID_PREFIX,
  PRICE_LIST_ID_PREFIX,
  PRICE_PREFERENCE_ID_PREFIX,
  PRICE_RULE_ID_PREFIX,
  PRICE_SET_ID_PREFIX,
  PricingCurrencyConflict,
  PricingNoMatchingPrice,
  PricingPriceListNotFound,
  PricingPriceSetNotFound,
  PricingRepositoryService,
  PricingValidationFailure,
  createCurrencyIdEffect,
  createMoneyAmountIdEffect,
  createPriceListIdEffect,
  createPricePreferenceIdEffect,
  createPriceRuleIdEffect,
  createPriceSetIdEffect,
} from "../domain";
import { defaultPricingRepository } from "../repositories";

export const PRICE_SET_CREATED_EVENT = "pricing.price-set-created" as const;
export const PRICE_CALCULATED_EVENT = "pricing.price-calculated" as const;

export interface PriceSetCreatedEventPayload {
  readonly id: string;
  readonly title: string;
}

export interface PriceCalculatedEventPayload {
  readonly amount: number;
  readonly currencyCode: string;
  readonly priceSetId: string;
  readonly quantity: number;
  readonly source: "base" | "price-list";
  readonly subtotal: number;
}

export type PricingServiceFailure = PricingExpectedError;

export interface PricingServiceShape {
  readonly calculatePrice: (
    input: CalculatePriceInput
  ) => EffectValue<CalculatedPrice, PricingServiceFailure>;
  readonly createCurrency: (
    input: CreateCurrencyInput
  ) => EffectValue<CurrencyRecord, PricingServiceFailure>;
  readonly createMoneyAmount: (
    input: CreateMoneyAmountInput
  ) => EffectValue<MoneyAmountRecord, PricingServiceFailure>;
  readonly createPriceList: (
    input: CreatePriceListInput
  ) => EffectValue<PriceListRecord, PricingServiceFailure>;
  readonly createPricePreference: (
    input: CreatePricePreferenceInput
  ) => EffectValue<PricePreferenceRecord, PricingServiceFailure>;
  readonly createPriceRule: (
    input: CreatePriceRuleInput
  ) => EffectValue<PriceRuleRecord, PricingServiceFailure>;
  readonly createPriceSet: (
    input: CreatePriceSetInput
  ) => EffectValue<PriceSetRecord, PricingServiceFailure>;
  readonly listCurrencies: EffectValue<
    readonly CurrencyRecord[],
    PricingServiceFailure
  >;
}

export const PricingService = Context.Service<PricingServiceShape>(
  "@ecommerce/pricing/PricingService"
);

export interface CreatePricingServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly eventPublisher?: EventPublisherServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly repository?: PricingRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
});

const createNoopEventPublisher = (): EventPublisherServiceShape => ({
  publish: () => {
    // Pricing events are optional until a runtime event bus is composed.
  },
});

const normalizeCurrencyCode = (currencyCode: string): string =>
  currencyCode.trim().toUpperCase();

const normalizeText = (value: string): string => value.trim();

const createId = (prefix: string, idGenerator: IdGeneratorServiceShape) => {
  const rawId = idGenerator.nextId();
  return rawId.startsWith(prefix) ? rawId : `${prefix}${rawId}`;
};

const publishEvent = (
  eventPublisher: EventPublisherServiceShape,
  envelope: Parameters<EventPublisherServiceShape["publish"]>[0]
) =>
  Effect.tryPromise({
    catch: () =>
      new PricingValidationFailure({
        message: "Pricing event publication failed.",
      }),
    try: () => Promise.resolve(eventPublisher.publish(envelope)),
  }).pipe(Effect.asVoid);

const getPriceListIsActive = (
  priceList: PriceListRecord,
  now: Date
): boolean => {
  if (priceList.status !== "active") {
    return false;
  }

  if (priceList.startsAt && priceList.startsAt.getTime() > now.getTime()) {
    return false;
  }

  if (priceList.endsAt && priceList.endsAt.getTime() < now.getTime()) {
    return false;
  }

  return true;
};

const getRulesMatch = ({
  context,
  rules,
}: {
  readonly context: Readonly<Record<string, string>>;
  readonly rules: Readonly<Record<string, string>>;
}): boolean => {
  for (const [attribute, value] of Object.entries(rules)) {
    if (context[attribute] !== value) {
      return false;
    }
  }

  return true;
};

const getMatchedRuleKeys = (
  rules: Readonly<Record<string, string>>
): string[] =>
  Object.entries(rules).map(([attribute, value]) => `${attribute}:${value}`);

const createCalculatedPrice = ({
  amount,
  input,
  ruleMatches,
  source,
}: {
  readonly amount: MoneyAmountRecord;
  readonly input: CalculatePriceInput;
  readonly ruleMatches: readonly string[];
  readonly source: "base" | "price-list";
}): CalculatedPrice => {
  const quantity = input.quantity ?? 1;

  return {
    amount: amount.amount,
    currencyCode: amount.currencyCode,
    priceSetId: amount.priceSetId,
    quantity,
    subtotal: amount.amount * quantity,
    trace: {
      moneyAmountId: amount.id,
      priceListId: amount.priceListId,
      ruleMatches: [...ruleMatches],
      source,
    },
  };
};

interface MatchedAmountSelection {
  readonly amount: MoneyAmountRecord;
  readonly ruleMatches: readonly string[];
}

const findBestAmount = ({
  input,
  now,
  repository,
}: {
  readonly input: CalculatePriceInput;
  readonly now: Date;
  readonly repository: PricingRepository;
}): EffectValue<MatchedAmountSelection | null, PricingServiceFailure> =>
  Effect.gen(function* findBestAmountEffect() {
    const context = input.context ?? {};
    const amounts = yield* repository.findMoneyAmountsForPriceSet(
      input.priceSetId
    );
    let baseAmount: MatchedAmountSelection | null = null;
    let bestRuleAmount: MatchedAmountSelection | null = null;
    let bestRuleAmountRuleCount = 0;

    for (const amount of amounts) {
      if (amount.currencyCode !== normalizeCurrencyCode(input.currencyCode)) {
        continue;
      }

      if (!amount.priceListId) {
        if (!getRulesMatch({ context, rules: amount.rules })) {
          continue;
        }

        baseAmount ??= {
          amount,
          ruleMatches: getMatchedRuleKeys(amount.rules),
        };
        continue;
      }

      const priceList = yield* repository.findPriceListById(amount.priceListId);
      const priceListRules = yield* repository.findPriceRulesByPriceListId(
        amount.priceListId
      );

      if (!priceList || !getPriceListIsActive(priceList, now)) {
        continue;
      }

      const combinedRules = { ...amount.rules };

      for (const rule of priceListRules) {
        combinedRules[rule.attribute] = rule.value;
      }

      if (!getRulesMatch({ context, rules: combinedRules })) {
        continue;
      }

      const ruleCount = Object.keys(combinedRules).length;

      if (!bestRuleAmount || ruleCount > bestRuleAmountRuleCount) {
        bestRuleAmount = {
          amount,
          ruleMatches: getMatchedRuleKeys(combinedRules),
        };
        bestRuleAmountRuleCount = ruleCount;
      }
    }

    return bestRuleAmount ?? baseAmount;
  });

export const createPricingService = ({
  clock = createDefaultClock(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  repository = defaultPricingRepository,
}: CreatePricingServiceOptions = {}): PricingServiceShape => ({
  calculatePrice: (input) =>
    Effect.gen(function* calculatePriceEffect() {
      const now = clock.now();
      const priceSet = yield* repository.findPriceSetById(input.priceSetId);

      if (!priceSet) {
        return yield* new PricingPriceSetNotFound({
          priceSetId: input.priceSetId,
        });
      }

      const selection = yield* findBestAmount({ input, now, repository });

      if (!selection) {
        return yield* new PricingNoMatchingPrice({
          currencyCode: normalizeCurrencyCode(input.currencyCode),
          priceSetId: input.priceSetId,
        });
      }

      const calculatedPrice = createCalculatedPrice({
        amount: selection.amount,
        input: {
          ...input,
          currencyCode: normalizeCurrencyCode(input.currencyCode),
        },
        ruleMatches: selection.ruleMatches,
        source: selection.amount.priceListId ? "price-list" : "base",
      });

      yield* publishEvent(
        eventPublisher,
        createEventEnvelope({
          id: createId("evt_", idGenerator),
          name: PRICE_CALCULATED_EVENT,
          payload: {
            amount: calculatedPrice.amount,
            currencyCode: calculatedPrice.currencyCode,
            priceSetId: calculatedPrice.priceSetId,
            quantity: calculatedPrice.quantity,
            source: calculatedPrice.trace.source,
            subtotal: calculatedPrice.subtotal,
          } satisfies PriceCalculatedEventPayload,
          sourceModule: "pricing",
          subject: {
            id: calculatedPrice.priceSetId,
            type: "price-set",
          },
        })
      );

      return calculatedPrice;
    }),
  createCurrency: (input) =>
    Effect.gen(function* createCurrencyEffect() {
      const code = normalizeCurrencyCode(input.code);
      const name = normalizeText(input.name);

      if (!code || !name) {
        return yield* new PricingValidationFailure({
          message: "Currency code and name are required.",
        });
      }

      const existing = yield* repository.findCurrencyByCode(code);

      if (existing) {
        return yield* new PricingCurrencyConflict({ currencyCode: code });
      }

      const now = clock.now();
      const currency: CurrencyRecord = {
        code,
        createdAt: now,
        id: yield* createCurrencyIdEffect(
          createId(CURRENCY_ID_PREFIX, idGenerator)
        ),
        name,
        precision: input.precision ?? 2,
        updatedAt: now,
      };

      return yield* repository.saveCurrency(currency);
    }),
  createMoneyAmount: (input) =>
    Effect.gen(function* createMoneyAmountEffect() {
      const currencyCode = normalizeCurrencyCode(input.currencyCode);
      const priceSet = yield* repository.findPriceSetById(input.priceSetId);

      if (!priceSet) {
        return yield* new PricingPriceSetNotFound({
          priceSetId: input.priceSetId,
        });
      }

      if (input.priceListId) {
        const priceList = yield* repository.findPriceListById(
          input.priceListId
        );

        if (!priceList) {
          return yield* new PricingPriceListNotFound({
            priceListId: input.priceListId,
          });
        }
      }

      const now = clock.now();
      const amount: MoneyAmountRecord = {
        amount: input.amount,
        createdAt: now,
        currencyCode,
        id: yield* createMoneyAmountIdEffect(
          createId(MONEY_AMOUNT_ID_PREFIX, idGenerator)
        ),
        priceListId: input.priceListId ?? null,
        priceSetId: input.priceSetId,
        rules: input.rules ?? {},
        updatedAt: now,
      };

      return yield* repository.saveMoneyAmount(amount);
    }),
  createPriceList: (input) =>
    Effect.gen(function* createPriceListEffect() {
      const title = normalizeText(input.title);

      if (!title) {
        return yield* new PricingValidationFailure({
          message: "Price list title is required.",
        });
      }

      const now = clock.now();
      const priceList: PriceListRecord = {
        createdAt: now,
        description: input.description?.trim() || null,
        endsAt: input.endsAt ?? null,
        id: yield* createPriceListIdEffect(
          createId(PRICE_LIST_ID_PREFIX, idGenerator)
        ),
        startsAt: input.startsAt ?? null,
        status: input.status ?? "draft",
        title,
        updatedAt: now,
      };

      return yield* repository.savePriceList(priceList);
    }),
  createPricePreference: (input) =>
    Effect.gen(function* createPricePreferenceEffect() {
      const now = clock.now();

      return yield* repository.savePricePreference({
        attribute: normalizeText(input.attribute),
        createdAt: now,
        currencyCode: normalizeCurrencyCode(input.currencyCode),
        id: yield* createPricePreferenceIdEffect(
          createId(PRICE_PREFERENCE_ID_PREFIX, idGenerator)
        ),
        updatedAt: now,
        value: normalizeText(input.value),
      });
    }),
  createPriceRule: (input) =>
    Effect.gen(function* createPriceRuleEffect() {
      const priceList = yield* repository.findPriceListById(input.priceListId);

      if (!priceList) {
        return yield* new PricingPriceListNotFound({
          priceListId: input.priceListId,
        });
      }

      const now = clock.now();
      const rule: PriceRuleRecord = {
        attribute: normalizeText(input.attribute),
        createdAt: now,
        id: yield* createPriceRuleIdEffect(
          createId(PRICE_RULE_ID_PREFIX, idGenerator)
        ),
        priceListId: input.priceListId,
        updatedAt: now,
        value: normalizeText(input.value),
      };

      return yield* repository.savePriceRule(rule);
    }),
  createPriceSet: (input) =>
    Effect.gen(function* createPriceSetEffect() {
      const title = normalizeText(input.title);

      if (!title) {
        return yield* new PricingValidationFailure({
          message: "Price set title is required.",
        });
      }

      const now = clock.now();
      const priceSet: PriceSetRecord = {
        createdAt: now,
        id: yield* createPriceSetIdEffect(
          createId(PRICE_SET_ID_PREFIX, idGenerator)
        ),
        metadata: input.metadata ?? {},
        title,
        updatedAt: now,
      };
      const saved = yield* repository.savePriceSet(priceSet);

      yield* publishEvent(
        eventPublisher,
        createEventEnvelope({
          id: createId("evt_", idGenerator),
          name: PRICE_SET_CREATED_EVENT,
          payload: {
            id: saved.id,
            title: saved.title,
          } satisfies PriceSetCreatedEventPayload,
          sourceModule: "pricing",
          subject: {
            id: saved.id,
            type: "price-set",
          },
        })
      );

      return saved;
    }),
  listCurrencies: repository.listCurrencies,
});

export const createPricingRepositoryLayer = (repository: PricingRepository) =>
  Layer.succeed(PricingRepositoryService, repository);

export const createPricingServiceLayer = (service: PricingServiceShape) =>
  Layer.succeed(PricingService, service);

export const createPricingServiceFromDependenciesLayer = () =>
  Layer.effect(
    PricingService,
    Effect.gen(function* createPricingServiceFromDependenciesEffect() {
      const clock = yield* ClockService;
      const idGenerator = yield* IdGeneratorService;
      const repository = yield* PricingRepositoryService;
      const eventPublisher = yield* Effect.serviceOption(
        EventPublisherService
      ).pipe(
        Effect.map((option) =>
          option._tag === "Some" ? option.value : undefined
        )
      );

      return createPricingService({
        clock,
        eventPublisher,
        idGenerator,
        repository,
      });
    })
  );

export const defaultPricingService = createPricingService({
  repository: defaultPricingRepository,
});
