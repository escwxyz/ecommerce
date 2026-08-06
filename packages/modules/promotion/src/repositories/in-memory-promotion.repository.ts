import { Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type {
  CampaignId,
  CampaignRecord,
  PromotionExpectedError,
  PromotionId,
  PromotionRecord,
  PromotionRedemptionRecord,
  PromotionRepository,
  PromotionRuleRecord,
  PromotionUsageLimitRecord,
} from "../domain";
import { PromotionRepositoryService } from "../domain";

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

const succeed = <A>(value: A): EffectValue<A, PromotionExpectedError> =>
  Effect.succeed(value);

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

  countRedemptions(
    promotionId: PromotionId
  ): EffectValue<number, PromotionExpectedError> {
    let count = 0;

    for (const redemption of this.#redemptions.values()) {
      if (redemption.promotionId === promotionId) {
        count += 1;
      }
    }

    return succeed(count);
  }

  findCampaignById(
    id: CampaignId
  ): EffectValue<CampaignRecord | null, PromotionExpectedError> {
    return succeed(this.#campaigns.get(id) ?? null);
  }

  findPromotionByCode(
    code: string
  ): EffectValue<PromotionRecord | null, PromotionExpectedError> {
    const normalizedCode = code.trim().toUpperCase();

    for (const promotion of this.#promotions.values()) {
      if (promotion.code === normalizedCode) {
        return succeed(promotion);
      }
    }

    return succeed(null);
  }

  findPromotionById(
    id: PromotionId
  ): EffectValue<PromotionRecord | null, PromotionExpectedError> {
    return succeed(this.#promotions.get(id) ?? null);
  }

  findRulesByPromotionId(
    promotionId: PromotionId
  ): EffectValue<readonly PromotionRuleRecord[], PromotionExpectedError> {
    const rules: PromotionRuleRecord[] = [];

    for (const rule of this.#rules.values()) {
      if (rule.promotionId === promotionId) {
        rules.push(rule);
      }
    }

    return succeed(sortByCreatedAtDescending(rules));
  }

  findUsageLimitsByPromotionId(
    promotionId: PromotionId
  ): EffectValue<readonly PromotionUsageLimitRecord[], PromotionExpectedError> {
    const usageLimits: PromotionUsageLimitRecord[] = [];

    for (const usageLimit of this.#usageLimits.values()) {
      if (usageLimit.promotionId === promotionId) {
        usageLimits.push(usageLimit);
      }
    }

    return succeed(sortByCreatedAtDescending(usageLimits));
  }

  get listAutomaticPromotions(): EffectValue<
    readonly PromotionRecord[],
    PromotionExpectedError
  > {
    const promotions: PromotionRecord[] = [];

    for (const promotion of this.#promotions.values()) {
      if (!promotion.code) {
        promotions.push(promotion);
      }
    }

    return succeed(sortByCreatedAtDescending(promotions));
  }

  listRedemptions(
    promotionId: PromotionId
  ): EffectValue<readonly PromotionRedemptionRecord[], PromotionExpectedError> {
    const redemptions: PromotionRedemptionRecord[] = [];

    for (const redemption of this.#redemptions.values()) {
      if (redemption.promotionId === promotionId) {
        redemptions.push(redemption);
      }
    }

    return succeed(sortByCreatedAtDescending(redemptions));
  }

  saveCampaign(
    campaign: CampaignRecord
  ): EffectValue<CampaignRecord, PromotionExpectedError> {
    this.#campaigns.set(campaign.id, campaign);
    return succeed(campaign);
  }

  savePromotion(
    promotion: PromotionRecord
  ): EffectValue<PromotionRecord, PromotionExpectedError> {
    this.#promotions.set(promotion.id, promotion);
    return succeed(promotion);
  }

  saveRedemption(
    redemption: PromotionRedemptionRecord
  ): EffectValue<PromotionRedemptionRecord, PromotionExpectedError> {
    this.#redemptions.set(redemption.id, redemption);
    return succeed(redemption);
  }

  saveRule(
    rule: PromotionRuleRecord
  ): EffectValue<PromotionRuleRecord, PromotionExpectedError> {
    this.#rules.set(rule.id, rule);
    return succeed(rule);
  }

  saveUsageLimit(
    usageLimit: PromotionUsageLimitRecord
  ): EffectValue<PromotionUsageLimitRecord, PromotionExpectedError> {
    this.#usageLimits.set(usageLimit.id, usageLimit);
    return succeed(usageLimit);
  }
}

export const createInMemoryPromotionRepository = (): PromotionRepository =>
  new InMemoryPromotionRepository();

export const createResettableInMemoryPromotionRepository =
  (): ResettablePromotionRepository => new InMemoryPromotionRepository();

export const createInMemoryPromotionRepositoryLayer = (
  repository: PromotionRepository
) => Layer.succeed(PromotionRepositoryService, repository);
