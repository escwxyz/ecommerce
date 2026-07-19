import { Context } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type { PricingExpectedError } from "./pricing.errors";
import type {
  CalculatedPriceApiSchema,
  CalculatedPriceSchema,
  CalculatePriceInputSchema,
  CreateCurrencyInputSchema,
  CreateMoneyAmountInputSchema,
  CreatePriceListInputSchema,
  CreatePricePreferenceInputSchema,
  CreatePriceRuleInputSchema,
  CreatePriceSetInputSchema,
  CurrencyApiListSchema,
  CurrencyApiRecordSchema,
  CurrencyIdSchema,
  CurrencyRecordSchema,
  MoneyAmountApiRecordSchema,
  MoneyAmountIdSchema,
  MoneyAmountRecordSchema,
  PriceListApiRecordSchema,
  PriceListIdSchema,
  PriceListRecordSchema,
  PriceListStatusSchema,
  PricePreferenceApiRecordSchema,
  PricePreferenceIdSchema,
  PricePreferenceRecordSchema,
  PriceRuleApiRecordSchema,
  PriceRuleIdSchema,
  PriceRuleRecordSchema,
  PriceSetApiRecordSchema,
  PriceSetIdSchema,
  PriceSetRecordSchema,
} from "./pricing.schema";

export type CurrencyId = typeof CurrencyIdSchema.Type;
export type PriceSetId = typeof PriceSetIdSchema.Type;
export type MoneyAmountId = typeof MoneyAmountIdSchema.Type;
export type PriceListId = typeof PriceListIdSchema.Type;
export type PriceRuleId = typeof PriceRuleIdSchema.Type;
export type PricePreferenceId = typeof PricePreferenceIdSchema.Type;
export type PriceListStatus = typeof PriceListStatusSchema.Type;
export type CreateCurrencyInput = typeof CreateCurrencyInputSchema.Type;
export type CurrencyRecord = typeof CurrencyRecordSchema.Type;
export type CurrencyApiRecord = typeof CurrencyApiRecordSchema.Type;
export type CurrencyApiList = typeof CurrencyApiListSchema.Type;
export type CreatePriceSetInput = typeof CreatePriceSetInputSchema.Type;
export type PriceSetRecord = typeof PriceSetRecordSchema.Type;
export type PriceSetApiRecord = typeof PriceSetApiRecordSchema.Type;
export type CreatePriceListInput = typeof CreatePriceListInputSchema.Type;
export type PriceListRecord = typeof PriceListRecordSchema.Type;
export type PriceListApiRecord = typeof PriceListApiRecordSchema.Type;
export type CreateMoneyAmountInput = typeof CreateMoneyAmountInputSchema.Type;
export type MoneyAmountRecord = typeof MoneyAmountRecordSchema.Type;
export type MoneyAmountApiRecord = typeof MoneyAmountApiRecordSchema.Type;
export type CreatePriceRuleInput = typeof CreatePriceRuleInputSchema.Type;
export type PriceRuleRecord = typeof PriceRuleRecordSchema.Type;
export type PriceRuleApiRecord = typeof PriceRuleApiRecordSchema.Type;
export type CreatePricePreferenceInput =
  typeof CreatePricePreferenceInputSchema.Type;
export type PricePreferenceRecord = typeof PricePreferenceRecordSchema.Type;
export type PricePreferenceApiRecord =
  typeof PricePreferenceApiRecordSchema.Type;
export type CalculatePriceInput = typeof CalculatePriceInputSchema.Type;
export type CalculatedPrice = typeof CalculatedPriceSchema.Type;
export type CalculatedPriceApi = typeof CalculatedPriceApiSchema.Type;

export interface PricingRepository {
  readonly findCurrencyByCode: (
    code: string
  ) => EffectValue<CurrencyRecord | null, PricingExpectedError>;
  readonly findMoneyAmountsForPriceSet: (
    priceSetId: PriceSetId
  ) => EffectValue<readonly MoneyAmountRecord[], PricingExpectedError>;
  readonly findPriceListById: (
    id: PriceListId
  ) => EffectValue<PriceListRecord | null, PricingExpectedError>;
  readonly findPriceRulesByPriceListId: (
    priceListId: PriceListId
  ) => EffectValue<readonly PriceRuleRecord[], PricingExpectedError>;
  readonly findPriceSetById: (
    id: PriceSetId
  ) => EffectValue<PriceSetRecord | null, PricingExpectedError>;
  readonly listCurrencies: EffectValue<
    readonly CurrencyRecord[],
    PricingExpectedError
  >;
  readonly saveCurrency: (
    currency: CurrencyRecord
  ) => EffectValue<CurrencyRecord, PricingExpectedError>;
  readonly saveMoneyAmount: (
    amount: MoneyAmountRecord
  ) => EffectValue<MoneyAmountRecord, PricingExpectedError>;
  readonly savePriceList: (
    priceList: PriceListRecord
  ) => EffectValue<PriceListRecord, PricingExpectedError>;
  readonly savePricePreference: (
    preference: PricePreferenceRecord
  ) => EffectValue<PricePreferenceRecord, PricingExpectedError>;
  readonly savePriceRule: (
    rule: PriceRuleRecord
  ) => EffectValue<PriceRuleRecord, PricingExpectedError>;
  readonly savePriceSet: (
    priceSet: PriceSetRecord
  ) => EffectValue<PriceSetRecord, PricingExpectedError>;
}

/** Effect-native pricing repository contract consumed by pricing services. */
export const PricingRepositoryService = Context.Service<PricingRepository>(
  "@ecommerce/pricing/PricingRepositoryService"
);
