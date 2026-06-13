import type { Brand } from "@ecommerce/core/brand";
import type { z } from "zod";

import type {
  CalculatePriceInputSchema,
  CalculatedPriceSchema,
  CreateCurrencyInputSchema,
  CreateMoneyAmountInputSchema,
  CreatePriceListInputSchema,
  CreatePricePreferenceInputSchema,
  CreatePriceRuleInputSchema,
  CreatePriceSetInputSchema,
  CurrencyApiRecordSchema,
  CurrencyRecordSchema,
  MoneyAmountApiRecordSchema,
  MoneyAmountRecordSchema,
  PriceListApiRecordSchema,
  PriceListRecordSchema,
  PriceListStatusSchema,
  PricePreferenceApiRecordSchema,
  PricePreferenceRecordSchema,
  PriceRuleApiRecordSchema,
  PriceRuleRecordSchema,
  PriceSetApiRecordSchema,
  PriceSetRecordSchema,
} from "./pricing.schema";

export type CurrencyId = Brand<string, "currency">;
export type PriceSetId = Brand<string, "price-set">;
export type MoneyAmountId = Brand<string, "money-amount">;
export type PriceListId = Brand<string, "price-list">;
export type PriceRuleId = Brand<string, "price-rule">;
export type PricePreferenceId = Brand<string, "price-preference">;
export type PriceListStatus = z.infer<typeof PriceListStatusSchema>;
export type CreateCurrencyInput = z.infer<typeof CreateCurrencyInputSchema>;
export type CurrencyRecord = Omit<
  z.infer<typeof CurrencyRecordSchema>,
  "id"
> & { readonly id: CurrencyId };
export type CurrencyApiRecord = z.infer<typeof CurrencyApiRecordSchema>;
export type CreatePriceSetInput = z.infer<typeof CreatePriceSetInputSchema>;
export type PriceSetRecord = Omit<
  z.infer<typeof PriceSetRecordSchema>,
  "id"
> & { readonly id: PriceSetId };
export type PriceSetApiRecord = z.infer<typeof PriceSetApiRecordSchema>;
export type CreatePriceListInput = z.infer<typeof CreatePriceListInputSchema>;
export type PriceListRecord = Omit<
  z.infer<typeof PriceListRecordSchema>,
  "id"
> & { readonly id: PriceListId };
export type PriceListApiRecord = z.infer<typeof PriceListApiRecordSchema>;
export type CreateMoneyAmountInput = z.infer<
  typeof CreateMoneyAmountInputSchema
>;
export type MoneyAmountRecord = Omit<
  z.infer<typeof MoneyAmountRecordSchema>,
  "id" | "priceListId" | "priceSetId"
> & {
  readonly id: MoneyAmountId;
  readonly priceListId: PriceListId | null;
  readonly priceSetId: PriceSetId;
};
export type MoneyAmountApiRecord = z.infer<typeof MoneyAmountApiRecordSchema>;
export type CreatePriceRuleInput = z.infer<typeof CreatePriceRuleInputSchema>;
export type PriceRuleRecord = Omit<
  z.infer<typeof PriceRuleRecordSchema>,
  "id" | "priceListId"
> & {
  readonly id: PriceRuleId;
  readonly priceListId: PriceListId;
};
export type PriceRuleApiRecord = z.infer<typeof PriceRuleApiRecordSchema>;
export type CreatePricePreferenceInput = z.infer<
  typeof CreatePricePreferenceInputSchema
>;
export type PricePreferenceRecord = Omit<
  z.infer<typeof PricePreferenceRecordSchema>,
  "id"
> & { readonly id: PricePreferenceId };
export type PricePreferenceApiRecord = z.infer<
  typeof PricePreferenceApiRecordSchema
>;
export type CalculatePriceInput = z.infer<typeof CalculatePriceInputSchema>;
export type CalculatedPrice = Omit<
  z.infer<typeof CalculatedPriceSchema>,
  "priceSetId" | "trace"
> & {
  readonly priceSetId: PriceSetId;
  readonly trace: Omit<
    z.infer<typeof CalculatedPriceSchema>["trace"],
    "moneyAmountId" | "priceListId"
  > & {
    readonly moneyAmountId: MoneyAmountId;
    readonly priceListId: PriceListId | null;
  };
};

export interface PricingRepository {
  findCurrencyByCode(code: string): Promise<CurrencyRecord | null>;
  findMoneyAmountsForPriceSet(
    priceSetId: PriceSetId
  ): Promise<readonly MoneyAmountRecord[]>;
  findPriceListById(id: PriceListId): Promise<PriceListRecord | null>;
  findPriceRulesByPriceListId(
    priceListId: PriceListId
  ): Promise<readonly PriceRuleRecord[]>;
  findPriceSetById(id: PriceSetId): Promise<PriceSetRecord | null>;
  listCurrencies(): Promise<readonly CurrencyRecord[]>;
  saveCurrency(currency: CurrencyRecord): Promise<CurrencyRecord>;
  saveMoneyAmount(amount: MoneyAmountRecord): Promise<MoneyAmountRecord>;
  savePriceList(priceList: PriceListRecord): Promise<PriceListRecord>;
  savePricePreference(
    preference: PricePreferenceRecord
  ): Promise<PricePreferenceRecord>;
  savePriceRule(rule: PriceRuleRecord): Promise<PriceRuleRecord>;
  savePriceSet(priceSet: PriceSetRecord): Promise<PriceSetRecord>;
}
