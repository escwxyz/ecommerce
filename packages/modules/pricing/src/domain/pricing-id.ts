import { Effect, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import { PricingInvalidIdentifier } from "./pricing.errors";
import {
  CurrencyIdSchema,
  MoneyAmountIdSchema,
  PriceListIdSchema,
  PricePreferenceIdSchema,
  PriceRuleIdSchema,
  PriceSetIdSchema,
} from "./pricing.schema";
import type {
  CurrencyId,
  MoneyAmountId,
  PriceListId,
  PricePreferenceId,
  PriceRuleId,
  PriceSetId,
} from "./pricing.types";

export const CURRENCY_ID_PREFIX = "cur_" as const;
export const PRICE_SET_ID_PREFIX = "pset_" as const;
export const MONEY_AMOUNT_ID_PREFIX = "amt_" as const;
export const PRICE_LIST_ID_PREFIX = "plist_" as const;
export const PRICE_RULE_ID_PREFIX = "prule_" as const;
export const PRICE_PREFERENCE_ID_PREFIX = "ppref_" as const;

export const createCurrencyId = (value: string): CurrencyId =>
  value as CurrencyId;
export const serializeCurrencyId = (id: CurrencyId): string => id;
export const createCurrencyIdEffect = (
  value: string
): EffectValue<CurrencyId, PricingInvalidIdentifier> =>
  Schema.decodeUnknownEffect(CurrencyIdSchema)(value).pipe(
    Effect.mapError(
      () =>
        new PricingInvalidIdentifier({
          expectedPrefix: CURRENCY_ID_PREFIX,
          value,
        })
    )
  );

export const createPriceSetId = (value: string): PriceSetId =>
  value as PriceSetId;
export const serializePriceSetId = (id: PriceSetId): string => id;
export const createPriceSetIdEffect = (
  value: string
): EffectValue<PriceSetId, PricingInvalidIdentifier> =>
  Schema.decodeUnknownEffect(PriceSetIdSchema)(value).pipe(
    Effect.mapError(
      () =>
        new PricingInvalidIdentifier({
          expectedPrefix: PRICE_SET_ID_PREFIX,
          value,
        })
    )
  );

export const createMoneyAmountId = (value: string): MoneyAmountId =>
  value as MoneyAmountId;
export const serializeMoneyAmountId = (id: MoneyAmountId): string => id;
export const createMoneyAmountIdEffect = (
  value: string
): EffectValue<MoneyAmountId, PricingInvalidIdentifier> =>
  Schema.decodeUnknownEffect(MoneyAmountIdSchema)(value).pipe(
    Effect.mapError(
      () =>
        new PricingInvalidIdentifier({
          expectedPrefix: MONEY_AMOUNT_ID_PREFIX,
          value,
        })
    )
  );

export const createPriceListId = (value: string): PriceListId =>
  value as PriceListId;
export const serializePriceListId = (id: PriceListId): string => id;
export const createPriceListIdEffect = (
  value: string
): EffectValue<PriceListId, PricingInvalidIdentifier> =>
  Schema.decodeUnknownEffect(PriceListIdSchema)(value).pipe(
    Effect.mapError(
      () =>
        new PricingInvalidIdentifier({
          expectedPrefix: PRICE_LIST_ID_PREFIX,
          value,
        })
    )
  );

export const createPriceRuleId = (value: string): PriceRuleId =>
  value as PriceRuleId;
export const serializePriceRuleId = (id: PriceRuleId): string => id;
export const createPriceRuleIdEffect = (
  value: string
): EffectValue<PriceRuleId, PricingInvalidIdentifier> =>
  Schema.decodeUnknownEffect(PriceRuleIdSchema)(value).pipe(
    Effect.mapError(
      () =>
        new PricingInvalidIdentifier({
          expectedPrefix: PRICE_RULE_ID_PREFIX,
          value,
        })
    )
  );

export const createPricePreferenceId = (value: string): PricePreferenceId =>
  value as PricePreferenceId;
export const serializePricePreferenceId = (id: PricePreferenceId): string => id;
export const createPricePreferenceIdEffect = (
  value: string
): EffectValue<PricePreferenceId, PricingInvalidIdentifier> =>
  Schema.decodeUnknownEffect(PricePreferenceIdSchema)(value).pipe(
    Effect.mapError(
      () =>
        new PricingInvalidIdentifier({
          expectedPrefix: PRICE_PREFERENCE_ID_PREFIX,
          value,
        })
    )
  );
