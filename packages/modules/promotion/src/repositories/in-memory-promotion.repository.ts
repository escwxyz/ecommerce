import type {
  CampaignId,
  CampaignRecord,
  PromotionId,
  PromotionRecord,
  PromotionRedemptionRecord,
  PromotionRepository,
  PromotionRuleRecord,
  PromotionUsageLimitRecord,
} from "../domain";

export interface ResettablePromotionRepository extends PromotionRepository {
  clear(): void;
}

const sortByCreatedAtDescending = <
  TRecord extends { readonly createdAt: Date },
>(
  records: Iterable<TRecord>
): TRecord[] => {
  const sortedRecords: TRecord[] = [];

  for (const record of records) {
    const recordTimestamp = record.createdAt.getTime();
    let insertAt = 0;

    while (insertAt < sortedRecords.length) {
      const currentRecord = sortedRecords[insertAt];

      if (
        !currentRecord ||
        currentRecord.createdAt.getTime() < recordTimestamp
      ) {
        break;
      }

      insertAt += 1;
    }

    sortedRecords.splice(insertAt, 0, record);
  }

  return sortedRecords;
};

export class InMemoryPromotionRepository implements ResettablePromotionRepository {
  readonly #campaigns = new Map<string, CampaignRecord>();
  readonly #promotions = new Map<string, PromotionRecord>();
  readonly #redemptions = new Map<string, PromotionRedemptionRecord>();
  readonly #rules = new Map<string, PromotionRuleRecord>();
  readonly #usageLimits = new Map<string, PromotionUsageLimitRecord>();

  clear(): void {
    this.#campaigns.clear();
    this.#promotions.clear();
    this.#redemptions.clear();
    this.#rules.clear();
    this.#usageLimits.clear();
  }

  countRedemptions(promotionId: PromotionId): Promise<number> {
    let count = 0;

    for (const redemption of this.#redemptions.values()) {
      if (redemption.promotionId === promotionId) {
        count += 1;
      }
    }

    return Promise.resolve(count);
  }

  findCampaignById(id: CampaignId): Promise<CampaignRecord | null> {
    return Promise.resolve(this.#campaigns.get(id) ?? null);
  }

  findPromotionByCode(code: string): Promise<PromotionRecord | null> {
    const normalizedCode = code.trim().toUpperCase();

    for (const promotion of this.#promotions.values()) {
      if (promotion.code === normalizedCode) {
        return Promise.resolve(promotion);
      }
    }

    return Promise.resolve(null);
  }

  findPromotionById(id: PromotionId): Promise<PromotionRecord | null> {
    return Promise.resolve(this.#promotions.get(id) ?? null);
  }

  findRulesByPromotionId(
    promotionId: PromotionId
  ): Promise<readonly PromotionRuleRecord[]> {
    const rules: PromotionRuleRecord[] = [];

    for (const rule of this.#rules.values()) {
      if (rule.promotionId === promotionId) {
        rules.push(rule);
      }
    }

    return Promise.resolve(sortByCreatedAtDescending(rules));
  }

  findUsageLimitsByPromotionId(
    promotionId: PromotionId
  ): Promise<readonly PromotionUsageLimitRecord[]> {
    const usageLimits: PromotionUsageLimitRecord[] = [];

    for (const usageLimit of this.#usageLimits.values()) {
      if (usageLimit.promotionId === promotionId) {
        usageLimits.push(usageLimit);
      }
    }

    return Promise.resolve(sortByCreatedAtDescending(usageLimits));
  }

  listAutomaticPromotions(): Promise<readonly PromotionRecord[]> {
    const promotions: PromotionRecord[] = [];

    for (const promotion of this.#promotions.values()) {
      if (!promotion.code) {
        promotions.push(promotion);
      }
    }

    return Promise.resolve(sortByCreatedAtDescending(promotions));
  }

  listRedemptions(
    promotionId: PromotionId
  ): Promise<readonly PromotionRedemptionRecord[]> {
    const redemptions: PromotionRedemptionRecord[] = [];

    for (const redemption of this.#redemptions.values()) {
      if (redemption.promotionId === promotionId) {
        redemptions.push(redemption);
      }
    }

    return Promise.resolve(sortByCreatedAtDescending(redemptions));
  }

  saveCampaign(campaign: CampaignRecord): Promise<CampaignRecord> {
    this.#campaigns.set(campaign.id, campaign);
    return Promise.resolve(campaign);
  }

  savePromotion(promotion: PromotionRecord): Promise<PromotionRecord> {
    this.#promotions.set(promotion.id, promotion);
    return Promise.resolve(promotion);
  }

  saveRedemption(
    redemption: PromotionRedemptionRecord
  ): Promise<PromotionRedemptionRecord> {
    this.#redemptions.set(redemption.id, redemption);
    return Promise.resolve(redemption);
  }

  saveRule(rule: PromotionRuleRecord): Promise<PromotionRuleRecord> {
    this.#rules.set(rule.id, rule);
    return Promise.resolve(rule);
  }

  saveUsageLimit(
    usageLimit: PromotionUsageLimitRecord
  ): Promise<PromotionUsageLimitRecord> {
    this.#usageLimits.set(usageLimit.id, usageLimit);
    return Promise.resolve(usageLimit);
  }
}

export const defaultPromotionRepository = new InMemoryPromotionRepository();

export const createInMemoryPromotionRepository = (): PromotionRepository =>
  new InMemoryPromotionRepository();

export const createResettableInMemoryPromotionRepository =
  (): ResettablePromotionRepository => new InMemoryPromotionRepository();
