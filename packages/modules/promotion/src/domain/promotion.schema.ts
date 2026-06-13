import { z } from "zod";

const MetadataSchema = z.record(z.string(), z.unknown());
const RuleAttributesSchema = z.record(z.string(), z.string());

export const PromotionStatusSchema = z.enum(["draft", "active", "disabled"]);

export const PromotionApplicationMethodSchema = z.object({
  allocation: z.enum(["cart", "line-item"]),
  target: z.enum(["subtotal", "line-item"]),
  type: z.enum(["fixed", "percentage"]),
  value: z.number().int().min(1).max(100),
});

export const CampaignRecordSchema = z.object({
  createdAt: z.date(),
  description: z.string().nullable(),
  id: z.string().min(1).startsWith("pcamp_"),
  metadata: MetadataSchema,
  name: z.string().min(1),
  updatedAt: z.date(),
});

export const CreateCampaignInputSchema = z.object({
  description: z.string().optional(),
  metadata: MetadataSchema.optional(),
  name: z.string().min(1),
});

export const PromotionRecordSchema = z.object({
  applicationMethod: PromotionApplicationMethodSchema,
  campaignId: z.string().min(1).startsWith("pcamp_").nullable(),
  code: z.string().min(1).nullable(),
  createdAt: z.date(),
  endsAt: z.date().nullable(),
  id: z.string().min(1).startsWith("promo_"),
  metadata: MetadataSchema,
  startsAt: z.date().nullable(),
  status: PromotionStatusSchema,
  title: z.string().min(1),
  updatedAt: z.date(),
});

export const CreatePromotionInputSchema = z.object({
  applicationMethod: PromotionApplicationMethodSchema,
  campaignId: z.string().min(1).startsWith("pcamp_").optional(),
  code: z.string().min(1).optional(),
  endsAt: z.date().optional(),
  metadata: MetadataSchema.optional(),
  startsAt: z.date().optional(),
  status: PromotionStatusSchema.optional(),
  title: z.string().min(1),
});

export const PromotionRuleRecordSchema = z.object({
  attribute: z.string().min(1),
  createdAt: z.date(),
  id: z.string().min(1).startsWith("prule_"),
  promotionId: z.string().min(1).startsWith("promo_"),
  updatedAt: z.date(),
  value: z.string().min(1),
});

export const CreatePromotionRuleInputSchema = z.object({
  attribute: z.string().min(1),
  promotionId: z.string().min(1).startsWith("promo_"),
  value: z.string().min(1),
});

export const PromotionUsageLimitRecordSchema = z.object({
  createdAt: z.date(),
  id: z.string().min(1).startsWith("plimit_"),
  limit: z.number().int().positive(),
  promotionId: z.string().min(1).startsWith("promo_"),
  scope: z.enum(["total", "customer"]),
  updatedAt: z.date(),
});

export const CreatePromotionUsageLimitInputSchema = z.object({
  limit: z.number().int().positive(),
  promotionId: z.string().min(1).startsWith("promo_"),
  scope: z.enum(["total", "customer"]),
});

export const PromotionRedemptionRecordSchema = z.object({
  adjustmentIds: z.array(z.string().min(1).startsWith("padj_")),
  cartId: z.string().min(1),
  createdAt: z.date(),
  id: z.string().min(1).startsWith("pred_"),
  promotionId: z.string().min(1).startsWith("promo_"),
});

export const RecordPromotionRedemptionInputSchema = z.object({
  adjustmentIds: z.array(z.string().min(1).startsWith("padj_")),
  cartId: z.string().min(1),
  promotionId: z.string().min(1).startsWith("promo_"),
});

export const PromotionCartInputSchema = z.object({
  currencyCode: z.string().min(3).max(3),
  id: z.string().min(1),
  lines: z
    .array(
      z.object({
        id: z.string().min(1),
        quantity: z.number().int().positive(),
        subtotal: z.number().int().nonnegative(),
      })
    )
    .optional(),
  subtotal: z.number().int().nonnegative(),
});

export const CalculatePromotionAdjustmentsInputSchema = z.object({
  cart: PromotionCartInputSchema,
  context: RuleAttributesSchema.optional(),
  promotionCodes: z.array(z.string().min(1)).optional(),
});

export const PromotionAdjustmentTraceSchema = z.object({
  promotionCode: z.string().nullable(),
  ruleMatches: z.array(z.string()),
  source: z.enum(["automatic", "discount-code"]),
});

export const PromotionAdjustmentSchema = z.object({
  amount: z.number().int().nonpositive(),
  currencyCode: z.string().min(3).max(3),
  id: z.string().min(1).startsWith("padj_"),
  promotionId: z.string().min(1).startsWith("promo_"),
  target: z.enum(["subtotal", "line-item"]),
  trace: PromotionAdjustmentTraceSchema,
});

export const PromotionAdjustmentResultSchema = z.object({
  adjustments: z.array(PromotionAdjustmentSchema),
  cartId: z.string().min(1),
  currencyCode: z.string().min(3).max(3),
  subtotal: z.number().int().nonnegative(),
  totalDiscount: z.number().int().nonpositive(),
});

export const CampaignApiRecordSchema = CampaignRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const PromotionApiRecordSchema = PromotionRecordSchema.extend({
  createdAt: z.string().min(1),
  endsAt: z.string().min(1).nullable(),
  startsAt: z.string().min(1).nullable(),
  updatedAt: z.string().min(1),
});

export const PromotionRuleApiRecordSchema = PromotionRuleRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const PromotionUsageLimitApiRecordSchema =
  PromotionUsageLimitRecordSchema.extend({
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  });

export const PromotionRedemptionApiRecordSchema =
  PromotionRedemptionRecordSchema.extend({
    createdAt: z.string().min(1),
  });
