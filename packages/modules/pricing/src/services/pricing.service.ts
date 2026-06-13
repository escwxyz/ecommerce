import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import { Context, Layer } from "effect";
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
  PricingRepository,
} from "../domain";
import {
  CURRENCY_ID_PREFIX,
  MONEY_AMOUNT_ID_PREFIX,
  PRICE_LIST_ID_PREFIX,
  PRICE_PREFERENCE_ID_PREFIX,
  PRICE_RULE_ID_PREFIX,
  PRICE_SET_ID_PREFIX,
  createCurrencyId,
  createMoneyAmountId,
  createPriceListId,
  createPricePreferenceId,
  createPriceRuleId,
  createPriceSetId,
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

export interface PricingServiceShape {
  calculatePrice(input: CalculatePriceInput): Promise<CalculatedPrice>;
  createCurrency(input: CreateCurrencyInput): Promise<CurrencyRecord>;
  createMoneyAmount(input: CreateMoneyAmountInput): Promise<MoneyAmountRecord>;
  createPriceList(input: CreatePriceListInput): Promise<PriceListRecord>;
  createPricePreference(
    input: CreatePricePreferenceInput
  ): Promise<PricePreferenceRecord>;
  createPriceRule(input: CreatePriceRuleInput): Promise<PriceRuleRecord>;
  createPriceSet(input: CreatePriceSetInput): Promise<PriceSetRecord>;
  listCurrencies(): Promise<readonly CurrencyRecord[]>;
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
  source,
}: {
  readonly amount: MoneyAmountRecord;
  readonly input: CalculatePriceInput;
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
      ruleMatches: getMatchedRuleKeys(amount.rules),
      source,
    },
  };
};

const findBestAmount = async ({
  input,
  now,
  repository,
}: {
  readonly input: CalculatePriceInput;
  readonly now: Date;
  readonly repository: PricingRepository;
}): Promise<MoneyAmountRecord | null> => {
  const context = input.context ?? {};
  const priceSetId = createPriceSetId(input.priceSetId);
  const amounts = await repository.findMoneyAmountsForPriceSet(priceSetId);
  let baseAmount: MoneyAmountRecord | null = null;
  let bestRuleAmount: MoneyAmountRecord | null = null;

  for (const amount of amounts) {
    if (amount.currencyCode !== normalizeCurrencyCode(input.currencyCode)) {
      continue;
    }

    if (!getRulesMatch({ context, rules: amount.rules })) {
      continue;
    }

    if (!amount.priceListId) {
      baseAmount ??= amount;
      continue;
    }

    const priceList = await repository.findPriceListById(amount.priceListId);

    if (!priceList || !getPriceListIsActive(priceList, now)) {
      continue;
    }

    if (
      !bestRuleAmount ||
      Object.keys(amount.rules).length >
        Object.keys(bestRuleAmount.rules).length
    ) {
      bestRuleAmount = amount;
    }
  }

  return bestRuleAmount ?? baseAmount;
};

export const createPricingService = ({
  clock = createDefaultClock(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  repository = defaultPricingRepository,
}: CreatePricingServiceOptions = {}): PricingServiceShape => ({
  calculatePrice: async (input) => {
    const now = clock.now();
    const priceSetId = createPriceSetId(input.priceSetId);
    const priceSet = await repository.findPriceSetById(priceSetId);

    if (!priceSet) {
      throw new Error(`Price set "${input.priceSetId}" was not found.`);
    }

    const amount = await findBestAmount({ input, now, repository });

    if (!amount) {
      throw new Error("No matching price was found.");
    }

    const calculatedPrice = createCalculatedPrice({
      amount,
      input: {
        ...input,
        currencyCode: normalizeCurrencyCode(input.currencyCode),
      },
      source: amount.priceListId ? "price-list" : "base",
    });

    await eventPublisher.publish(
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
  },
  createCurrency: async (input) => {
    const code = normalizeCurrencyCode(input.code);
    const name = normalizeText(input.name);

    if (!code || !name) {
      throw new Error("Currency code and name are required.");
    }

    const existing = await repository.findCurrencyByCode(code);

    if (existing) {
      throw new Error(`Currency "${code}" already exists.`);
    }

    const now = clock.now();
    const currency: CurrencyRecord = {
      code,
      createdAt: now,
      id: createCurrencyId(createId(CURRENCY_ID_PREFIX, idGenerator)),
      name,
      precision: input.precision ?? 2,
      updatedAt: now,
    };

    return repository.saveCurrency(currency);
  },
  createMoneyAmount: async (input) => {
    const currencyCode = normalizeCurrencyCode(input.currencyCode);
    const priceSetId = createPriceSetId(input.priceSetId);
    const priceSet = await repository.findPriceSetById(priceSetId);

    if (!priceSet) {
      throw new Error(`Price set "${input.priceSetId}" was not found.`);
    }

    if (input.priceListId) {
      const priceList = await repository.findPriceListById(
        createPriceListId(input.priceListId)
      );

      if (!priceList) {
        throw new Error(`Price list "${input.priceListId}" was not found.`);
      }
    }

    const now = clock.now();
    const amount: MoneyAmountRecord = {
      amount: input.amount,
      createdAt: now,
      currencyCode,
      id: createMoneyAmountId(createId(MONEY_AMOUNT_ID_PREFIX, idGenerator)),
      priceListId: input.priceListId
        ? createPriceListId(input.priceListId)
        : null,
      priceSetId,
      rules: input.rules ?? {},
      updatedAt: now,
    };

    return repository.saveMoneyAmount(amount);
  },
  createPriceList: (input) => {
    const title = normalizeText(input.title);

    if (!title) {
      throw new Error("Price list title is required.");
    }

    const now = clock.now();
    const priceList: PriceListRecord = {
      createdAt: now,
      description: input.description?.trim() || null,
      endsAt: input.endsAt ?? null,
      id: createPriceListId(createId(PRICE_LIST_ID_PREFIX, idGenerator)),
      startsAt: input.startsAt ?? null,
      status: input.status ?? "draft",
      title,
      updatedAt: now,
    };

    return repository.savePriceList(priceList);
  },
  createPricePreference: (input) => {
    const now = clock.now();

    return repository.savePricePreference({
      attribute: normalizeText(input.attribute),
      createdAt: now,
      currencyCode: normalizeCurrencyCode(input.currencyCode),
      id: createPricePreferenceId(
        createId(PRICE_PREFERENCE_ID_PREFIX, idGenerator)
      ),
      updatedAt: now,
      value: normalizeText(input.value),
    });
  },
  createPriceRule: async (input) => {
    const priceListId = createPriceListId(input.priceListId);
    const priceList = await repository.findPriceListById(priceListId);

    if (!priceList) {
      throw new Error(`Price list "${input.priceListId}" was not found.`);
    }

    const now = clock.now();
    const rule: PriceRuleRecord = {
      attribute: normalizeText(input.attribute),
      createdAt: now,
      id: createPriceRuleId(createId(PRICE_RULE_ID_PREFIX, idGenerator)),
      priceListId,
      updatedAt: now,
      value: normalizeText(input.value),
    };

    return repository.savePriceRule(rule);
  },
  createPriceSet: async (input) => {
    const title = normalizeText(input.title);

    if (!title) {
      throw new Error("Price set title is required.");
    }

    const now = clock.now();
    const priceSet: PriceSetRecord = {
      createdAt: now,
      id: createPriceSetId(createId(PRICE_SET_ID_PREFIX, idGenerator)),
      metadata: input.metadata ?? {},
      title,
      updatedAt: now,
    };
    const saved = await repository.savePriceSet(priceSet);

    await eventPublisher.publish(
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
  },
  listCurrencies: () => repository.listCurrencies(),
});

export const createPricingServiceLayer = (service: PricingServiceShape) =>
  Layer.succeed(PricingService, service);

export const defaultPricingService = createPricingService({
  repository: defaultPricingRepository,
});
