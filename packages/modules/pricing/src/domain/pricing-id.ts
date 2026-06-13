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

export const createPriceSetId = (value: string): PriceSetId =>
  value as PriceSetId;
export const serializePriceSetId = (id: PriceSetId): string => id;

export const createMoneyAmountId = (value: string): MoneyAmountId =>
  value as MoneyAmountId;
export const serializeMoneyAmountId = (id: MoneyAmountId): string => id;

export const createPriceListId = (value: string): PriceListId =>
  value as PriceListId;
export const serializePriceListId = (id: PriceListId): string => id;

export const createPriceRuleId = (value: string): PriceRuleId =>
  value as PriceRuleId;
export const serializePriceRuleId = (id: PriceRuleId): string => id;

export const createPricePreferenceId = (value: string): PricePreferenceId =>
  value as PricePreferenceId;
export const serializePricePreferenceId = (id: PricePreferenceId): string => id;
