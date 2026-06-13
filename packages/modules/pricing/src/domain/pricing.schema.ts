import { z } from "zod";

const MetadataSchema = z.record(z.string(), z.unknown());
const RuleAttributesSchema = z.record(z.string(), z.string());

export const CurrencyRecordSchema = z.object({
  code: z.string().min(3).max(3),
  createdAt: z.date(),
  id: z.string().min(1).startsWith("cur_"),
  name: z.string().min(1),
  precision: z.number().int().min(0).max(6),
  updatedAt: z.date(),
});

export const CreateCurrencyInputSchema = z.object({
  code: z.string().min(3).max(3),
  name: z.string().min(1),
  precision: z.number().int().min(0).max(6).optional(),
});

export const PriceSetRecordSchema = z.object({
  createdAt: z.date(),
  id: z.string().min(1).startsWith("pset_"),
  metadata: MetadataSchema,
  title: z.string().min(1),
  updatedAt: z.date(),
});

export const CreatePriceSetInputSchema = z.object({
  metadata: MetadataSchema.optional(),
  title: z.string().min(1),
});

export const PriceListStatusSchema = z.enum(["draft", "active", "disabled"]);

export const PriceListRecordSchema = z.object({
  createdAt: z.date(),
  description: z.string().nullable(),
  id: z.string().min(1).startsWith("plist_"),
  startsAt: z.date().nullable(),
  endsAt: z.date().nullable(),
  status: PriceListStatusSchema,
  title: z.string().min(1),
  updatedAt: z.date(),
});

export const CreatePriceListInputSchema = z.object({
  description: z.string().optional(),
  endsAt: z.date().optional(),
  startsAt: z.date().optional(),
  status: PriceListStatusSchema.optional(),
  title: z.string().min(1),
});

export const MoneyAmountRecordSchema = z.object({
  amount: z.number().int().nonnegative(),
  createdAt: z.date(),
  currencyCode: z.string().min(3).max(3),
  id: z.string().min(1).startsWith("amt_"),
  priceListId: z.string().min(1).startsWith("plist_").nullable(),
  priceSetId: z.string().min(1).startsWith("pset_"),
  rules: RuleAttributesSchema,
  updatedAt: z.date(),
});

export const CreateMoneyAmountInputSchema = z.object({
  amount: z.number().int().nonnegative(),
  currencyCode: z.string().min(3).max(3),
  priceListId: z.string().min(1).startsWith("plist_").optional(),
  priceSetId: z.string().min(1).startsWith("pset_"),
  rules: RuleAttributesSchema.optional(),
});

export const PriceRuleRecordSchema = z.object({
  attribute: z.string().min(1),
  createdAt: z.date(),
  id: z.string().min(1).startsWith("prule_"),
  priceListId: z.string().min(1).startsWith("plist_"),
  updatedAt: z.date(),
  value: z.string().min(1),
});

export const CreatePriceRuleInputSchema = z.object({
  attribute: z.string().min(1),
  priceListId: z.string().min(1).startsWith("plist_"),
  value: z.string().min(1),
});

export const PricePreferenceRecordSchema = z.object({
  attribute: z.string().min(1),
  createdAt: z.date(),
  currencyCode: z.string().min(3).max(3),
  id: z.string().min(1).startsWith("ppref_"),
  updatedAt: z.date(),
  value: z.string().min(1),
});

export const CreatePricePreferenceInputSchema = z.object({
  attribute: z.string().min(1),
  currencyCode: z.string().min(3).max(3),
  value: z.string().min(1),
});

export const CalculatePriceInputSchema = z.object({
  context: RuleAttributesSchema.optional(),
  currencyCode: z.string().min(3).max(3),
  priceSetId: z.string().min(1).startsWith("pset_"),
  quantity: z.number().int().positive().optional(),
});

export const PriceTraceSchema = z.object({
  moneyAmountId: z.string().min(1).startsWith("amt_"),
  priceListId: z.string().min(1).startsWith("plist_").nullable(),
  ruleMatches: z.array(z.string()),
  source: z.enum(["base", "price-list"]),
});

export const CalculatedPriceSchema = z.object({
  amount: z.number().int().nonnegative(),
  currencyCode: z.string().min(3).max(3),
  priceSetId: z.string().min(1).startsWith("pset_"),
  quantity: z.number().int().positive(),
  subtotal: z.number().int().nonnegative(),
  trace: PriceTraceSchema,
});

export const CurrencyApiRecordSchema = CurrencyRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const PriceSetApiRecordSchema = PriceSetRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const MoneyAmountApiRecordSchema = MoneyAmountRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const PriceListApiRecordSchema = PriceListRecordSchema.extend({
  createdAt: z.string().min(1),
  endsAt: z.string().min(1).nullable(),
  startsAt: z.string().min(1).nullable(),
  updatedAt: z.string().min(1),
});

export const PriceRuleApiRecordSchema = PriceRuleRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const PricePreferenceApiRecordSchema =
  PricePreferenceRecordSchema.extend({
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  });
