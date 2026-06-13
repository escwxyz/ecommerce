import type { Kysely } from "kysely";

import type {
  CampaignRecord,
  PromotionCampaignRow,
  PromotionDatabase,
  PromotionRecord,
  PromotionRedemptionRecord,
  PromotionRedemptionRow,
  PromotionRepository,
  PromotionRow,
  PromotionRuleRecord,
  PromotionRuleRow,
  PromotionUsageLimitRecord,
  PromotionUsageLimitRow,
} from "../../domain";
import {
  createCampaignId,
  createPromotionId,
  createPromotionRedemptionId,
  createPromotionRuleId,
  createPromotionUsageLimitId,
} from "../../domain";

export type PromotionD1Database = Kysely<PromotionDatabase>;

export interface CreateD1PromotionRepositoryOptions {
  readonly db: PromotionD1Database;
}

const parseJsonColumn = <Value>(value: string): Value => JSON.parse(value);
const toJsonColumn = (value: unknown): string => JSON.stringify(value);
const normalizeCode = (value: string): string => value.trim().toUpperCase();

const toCampaignRecord = (row: PromotionCampaignRow): CampaignRecord => ({
  createdAt: new Date(row.created_at),
  description: row.description,
  id: createCampaignId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  name: row.name,
  updatedAt: new Date(row.updated_at),
});

const toPromotionRecord = (row: PromotionRow): PromotionRecord => ({
  applicationMethod: parseJsonColumn(row.application_method_json),
  campaignId:
    row.campaign_id === null ? null : createCampaignId(row.campaign_id),
  code: row.code,
  createdAt: new Date(row.created_at),
  endsAt: row.ends_at === null ? null : new Date(row.ends_at),
  id: createPromotionId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  startsAt: row.starts_at === null ? null : new Date(row.starts_at),
  status: row.status as PromotionRecord["status"],
  title: row.title,
  updatedAt: new Date(row.updated_at),
});

const toRuleRecord = (row: PromotionRuleRow): PromotionRuleRecord => ({
  attribute: row.attribute,
  createdAt: new Date(row.created_at),
  id: createPromotionRuleId(row.id),
  promotionId: createPromotionId(row.promotion_id),
  updatedAt: new Date(row.updated_at),
  value: row.value,
});

const toUsageLimitRecord = (
  row: PromotionUsageLimitRow
): PromotionUsageLimitRecord => ({
  createdAt: new Date(row.created_at),
  id: createPromotionUsageLimitId(row.id),
  limit: row.limit_value,
  promotionId: createPromotionId(row.promotion_id),
  scope: row.scope as PromotionUsageLimitRecord["scope"],
  updatedAt: new Date(row.updated_at),
});

const toRedemptionRecord = (
  row: PromotionRedemptionRow
): PromotionRedemptionRecord => ({
  adjustmentIds: parseJsonColumn(row.adjustment_ids_json),
  cartId: row.cart_id,
  createdAt: new Date(row.created_at),
  id: createPromotionRedemptionId(row.id),
  promotionId: createPromotionId(row.promotion_id),
});

export const createD1PromotionRepository = ({
  db,
}: CreateD1PromotionRepositoryOptions): PromotionRepository => ({
  countRedemptions: async (promotionId) => {
    const row = await db
      .selectFrom("promotion_redemption")
      .select(({ fn }) => fn.count("id").as("count"))
      .where("promotion_id", "=", promotionId)
      .executeTakeFirst();

    return Number(row?.count ?? 0);
  },
  findCampaignById: async (id) => {
    const row = await db
      .selectFrom("promotion_campaign")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toCampaignRecord(row) : null;
  },
  findPromotionByCode: async (code) => {
    const row = await db
      .selectFrom("promotion_promotion")
      .selectAll()
      .where("code", "=", normalizeCode(code))
      .executeTakeFirst();

    return row ? toPromotionRecord(row) : null;
  },
  findPromotionById: async (id) => {
    const row = await db
      .selectFrom("promotion_promotion")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toPromotionRecord(row) : null;
  },
  findRulesByPromotionId: async (promotionId) => {
    const rows = await db
      .selectFrom("promotion_rule")
      .selectAll()
      .where("promotion_id", "=", promotionId)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toRuleRecord);
  },
  findUsageLimitsByPromotionId: async (promotionId) => {
    const rows = await db
      .selectFrom("promotion_usage_limit")
      .selectAll()
      .where("promotion_id", "=", promotionId)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toUsageLimitRecord);
  },
  listAutomaticPromotions: async () => {
    const rows = await db
      .selectFrom("promotion_promotion")
      .selectAll()
      .where("code", "is", null)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toPromotionRecord);
  },
  listRedemptions: async (promotionId) => {
    const rows = await db
      .selectFrom("promotion_redemption")
      .selectAll()
      .where("promotion_id", "=", promotionId)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toRedemptionRecord);
  },
  saveCampaign: async (campaign) => {
    const values = {
      created_at: campaign.createdAt.getTime(),
      description: campaign.description,
      id: campaign.id,
      metadata_json: toJsonColumn(campaign.metadata),
      name: campaign.name,
      updated_at: campaign.updatedAt.getTime(),
    } as const;

    await db
      .insertInto("promotion_campaign")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          created_at: values.created_at,
          description: values.description,
          metadata_json: values.metadata_json,
          name: values.name,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return campaign;
  },
  savePromotion: async (promotion) => {
    const values = {
      application_method_json: toJsonColumn(promotion.applicationMethod),
      campaign_id: promotion.campaignId,
      code: promotion.code,
      created_at: promotion.createdAt.getTime(),
      ends_at: promotion.endsAt?.getTime() ?? null,
      id: promotion.id,
      metadata_json: toJsonColumn(promotion.metadata),
      starts_at: promotion.startsAt?.getTime() ?? null,
      status: promotion.status,
      title: promotion.title,
      updated_at: promotion.updatedAt.getTime(),
    } as const;

    await db
      .insertInto("promotion_promotion")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          application_method_json: values.application_method_json,
          campaign_id: values.campaign_id,
          code: values.code,
          created_at: values.created_at,
          ends_at: values.ends_at,
          metadata_json: values.metadata_json,
          starts_at: values.starts_at,
          status: values.status,
          title: values.title,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return promotion;
  },
  saveRedemption: async (redemption) => {
    const values = {
      adjustment_ids_json: toJsonColumn(redemption.adjustmentIds),
      cart_id: redemption.cartId,
      created_at: redemption.createdAt.getTime(),
      id: redemption.id,
      promotion_id: redemption.promotionId,
    } as const;

    await db
      .insertInto("promotion_redemption")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          adjustment_ids_json: values.adjustment_ids_json,
          cart_id: values.cart_id,
          created_at: values.created_at,
          promotion_id: values.promotion_id,
        })
      )
      .execute();

    return redemption;
  },
  saveRule: async (rule) => {
    const values = {
      attribute: rule.attribute,
      created_at: rule.createdAt.getTime(),
      id: rule.id,
      promotion_id: rule.promotionId,
      updated_at: rule.updatedAt.getTime(),
      value: rule.value,
    } as const;

    await db
      .insertInto("promotion_rule")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          attribute: values.attribute,
          created_at: values.created_at,
          promotion_id: values.promotion_id,
          updated_at: values.updated_at,
          value: values.value,
        })
      )
      .execute();

    return rule;
  },
  saveUsageLimit: async (usageLimit) => {
    const values = {
      created_at: usageLimit.createdAt.getTime(),
      id: usageLimit.id,
      limit_value: usageLimit.limit,
      promotion_id: usageLimit.promotionId,
      scope: usageLimit.scope,
      updated_at: usageLimit.updatedAt.getTime(),
    } as const;

    await db
      .insertInto("promotion_usage_limit")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          created_at: values.created_at,
          limit_value: values.limit_value,
          promotion_id: values.promotion_id,
          scope: values.scope,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return usageLimit;
  },
});
