import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import { Context, Layer } from "effect";
import { nanoid } from "nanoid";

import type {
  CalculatePromotionAdjustmentsInput,
  CampaignRecord,
  CreateCampaignInput,
  CreatePromotionInput,
  CreatePromotionRuleInput,
  CreatePromotionUsageLimitInput,
  PromotionAdjustmentResult,
  PromotionRecord,
  PromotionRedemptionRecord,
  PromotionRepository,
  PromotionRuleRecord,
  PromotionUsageLimitRecord,
  RecordPromotionRedemptionInput,
} from "../domain";
import {
  CAMPAIGN_ID_PREFIX,
  PROMOTION_ADJUSTMENT_ID_PREFIX,
  PROMOTION_ID_PREFIX,
  PROMOTION_REDEMPTION_ID_PREFIX,
  PROMOTION_RULE_ID_PREFIX,
  PROMOTION_USAGE_LIMIT_ID_PREFIX,
  createCampaignId,
  createPromotionAdjustmentId,
  createPromotionId,
  createPromotionRedemptionId,
  createPromotionRuleId,
  createPromotionUsageLimitId,
} from "../domain";
import { defaultPromotionRepository } from "../repositories";

export const PROMOTION_CREATED_EVENT = "promotion.created" as const;
export const PROMOTION_ADJUSTMENTS_CALCULATED_EVENT =
  "promotion.adjustments-calculated" as const;
export const PROMOTION_REDEMPTION_RECORDED_EVENT =
  "promotion.redemption-recorded" as const;

export interface PromotionCreatedEventPayload {
  readonly code: string | null;
  readonly id: string;
  readonly title: string;
}

export interface PromotionAdjustmentsCalculatedEventPayload {
  readonly adjustmentCount: number;
  readonly cartId: string;
  readonly currencyCode: string;
  readonly totalDiscount: number;
}

export interface PromotionRedemptionRecordedEventPayload {
  readonly cartId: string;
  readonly id: string;
  readonly promotionId: string;
}

export interface PromotionServiceShape {
  calculateAdjustments(
    input: CalculatePromotionAdjustmentsInput
  ): Promise<PromotionAdjustmentResult>;
  createCampaign(input: CreateCampaignInput): Promise<CampaignRecord>;
  createPromotion(input: CreatePromotionInput): Promise<PromotionRecord>;
  createPromotionRule(
    input: CreatePromotionRuleInput
  ): Promise<PromotionRuleRecord>;
  createUsageLimit(
    input: CreatePromotionUsageLimitInput
  ): Promise<PromotionUsageLimitRecord>;
  recordRedemption(
    input: RecordPromotionRedemptionInput
  ): Promise<PromotionRedemptionRecord>;
}

export const PromotionService = Context.Service<PromotionServiceShape>(
  "@ecommerce/promotion/PromotionService"
);

export interface CreatePromotionServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly eventPublisher?: EventPublisherServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly repository?: PromotionRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
});

const createNoopEventPublisher = (): EventPublisherServiceShape => ({
  publish: () => {
    // Promotion events are optional until a runtime event bus is composed.
  },
});

const normalizeCode = (value: string): string => value.trim().toUpperCase();

const normalizeCurrencyCode = (currencyCode: string): string =>
  currencyCode.trim().toUpperCase();

const normalizeText = (value: string): string => value.trim();

const createId = (prefix: string, idGenerator: IdGeneratorServiceShape) => {
  const rawId = idGenerator.nextId();
  return rawId.startsWith(prefix) ? rawId : `${prefix}${rawId}`;
};

const getPromotionIsActive = (
  promotion: PromotionRecord,
  now: Date
): boolean => {
  if (promotion.status !== "active") {
    return false;
  }

  if (promotion.startsAt && promotion.startsAt.getTime() > now.getTime()) {
    return false;
  }

  if (promotion.endsAt && promotion.endsAt.getTime() < now.getTime()) {
    return false;
  }

  return true;
};

const getRulesMatch = ({
  context,
  rules,
}: {
  readonly context: Readonly<Record<string, string>>;
  readonly rules: readonly PromotionRuleRecord[];
}): boolean => {
  for (const rule of rules) {
    if (context[rule.attribute] !== rule.value) {
      return false;
    }
  }

  return true;
};

const getMatchedRuleKeys = (rules: readonly PromotionRuleRecord[]): string[] =>
  rules.map((rule) => `${rule.attribute}:${rule.value}`);

const calculateDiscountAmount = ({
  promotion,
  subtotal,
}: {
  readonly promotion: PromotionRecord;
  readonly subtotal: number;
}): number => {
  const { applicationMethod } = promotion;
  const cappedValue =
    applicationMethod.type === "percentage"
      ? Math.min(applicationMethod.value, 100)
      : applicationMethod.value;

  if (applicationMethod.type === "percentage") {
    return -Math.floor((subtotal * cappedValue) / 100);
  }

  return -Math.min(cappedValue, subtotal);
};

const getIsUsageLimitAvailable = async ({
  promotion,
  repository,
}: {
  readonly promotion: PromotionRecord;
  readonly repository: PromotionRepository;
}): Promise<boolean> => {
  const usageLimits = await repository.findUsageLimitsByPromotionId(
    promotion.id
  );

  for (const usageLimit of usageLimits) {
    if (usageLimit.scope !== "total") {
      continue;
    }

    const redemptionCount = await repository.countRedemptions(promotion.id);

    if (redemptionCount >= usageLimit.limit) {
      return false;
    }
  }

  return true;
};

const getCandidatePromotions = async ({
  promotionCodes,
  repository,
}: {
  readonly promotionCodes: readonly string[];
  readonly repository: PromotionRepository;
}): Promise<readonly PromotionRecord[]> => {
  const promotions: PromotionRecord[] = [
    ...(await repository.listAutomaticPromotions()),
  ];
  const uniquePromotionCodes = new Set<string>();

  for (const code of promotionCodes) {
    const normalizedCode = normalizeCode(code);

    if (uniquePromotionCodes.has(normalizedCode)) {
      continue;
    }

    uniquePromotionCodes.add(normalizedCode);

    const promotion = await repository.findPromotionByCode(normalizedCode);

    if (promotion) {
      promotions.push(promotion);
    }
  }

  return promotions;
};

export const createPromotionService = ({
  clock = createDefaultClock(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  repository = defaultPromotionRepository,
}: CreatePromotionServiceOptions = {}): PromotionServiceShape => ({
  calculateAdjustments: async (input) => {
    const now = clock.now();
    const context = input.context ?? {};
    const currencyCode = normalizeCurrencyCode(input.cart.currencyCode);
    const promotions = await getCandidatePromotions({
      promotionCodes: input.promotionCodes ?? [],
      repository,
    });
    const adjustments: PromotionAdjustmentResult["adjustments"] = [];

    for (const promotion of promotions) {
      if (!getPromotionIsActive(promotion, now)) {
        continue;
      }

      if (!(await getIsUsageLimitAvailable({ promotion, repository }))) {
        continue;
      }

      const rules = await repository.findRulesByPromotionId(promotion.id);

      if (!getRulesMatch({ context, rules })) {
        continue;
      }

      const amount = calculateDiscountAmount({
        promotion,
        subtotal: input.cart.subtotal,
      });

      if (amount === 0) {
        continue;
      }

      adjustments.push({
        amount,
        currencyCode,
        id: createPromotionAdjustmentId(
          createId(PROMOTION_ADJUSTMENT_ID_PREFIX, idGenerator)
        ),
        promotionId: promotion.id,
        target: promotion.applicationMethod.target,
        trace: {
          promotionCode: promotion.code,
          ruleMatches: getMatchedRuleKeys(rules),
          source: promotion.code ? "discount-code" : "automatic",
        },
      });
    }

    const result: PromotionAdjustmentResult = {
      adjustments,
      cartId: input.cart.id,
      currencyCode,
      subtotal: input.cart.subtotal,
      totalDiscount: adjustments.reduce(
        (total, adjustment) => total + adjustment.amount,
        0
      ),
    };

    await eventPublisher.publish(
      createEventEnvelope({
        id: createId("evt_", idGenerator),
        name: PROMOTION_ADJUSTMENTS_CALCULATED_EVENT,
        payload: {
          adjustmentCount: result.adjustments.length,
          cartId: result.cartId,
          currencyCode: result.currencyCode,
          totalDiscount: result.totalDiscount,
        } satisfies PromotionAdjustmentsCalculatedEventPayload,
        sourceModule: "promotion",
        subject: {
          id: result.cartId,
          type: "cart",
        },
      })
    );

    return result;
  },
  createCampaign: (input) => {
    const name = normalizeText(input.name);

    if (!name) {
      throw new Error("Campaign name is required.");
    }

    const now = clock.now();
    const campaign: CampaignRecord = {
      createdAt: now,
      description: input.description?.trim() || null,
      id: createCampaignId(createId(CAMPAIGN_ID_PREFIX, idGenerator)),
      metadata: input.metadata ?? {},
      name,
      updatedAt: now,
    };

    return repository.saveCampaign(campaign);
  },
  createPromotion: async (input) => {
    const title = normalizeText(input.title);

    if (!title) {
      throw new Error("Promotion title is required.");
    }

    const campaignId = input.campaignId
      ? createCampaignId(input.campaignId)
      : null;

    if (campaignId) {
      const campaign = await repository.findCampaignById(campaignId);

      if (!campaign) {
        throw new Error(`Campaign "${input.campaignId}" was not found.`);
      }
    }

    const now = clock.now();
    const promotion: PromotionRecord = {
      applicationMethod: input.applicationMethod,
      campaignId,
      code: input.code ? normalizeCode(input.code) : null,
      createdAt: now,
      endsAt: input.endsAt ?? null,
      id: createPromotionId(createId(PROMOTION_ID_PREFIX, idGenerator)),
      metadata: input.metadata ?? {},
      startsAt: input.startsAt ?? null,
      status: input.status ?? "draft",
      title,
      updatedAt: now,
    };
    const saved = await repository.savePromotion(promotion);

    await eventPublisher.publish(
      createEventEnvelope({
        id: createId("evt_", idGenerator),
        name: PROMOTION_CREATED_EVENT,
        payload: {
          code: saved.code,
          id: saved.id,
          title: saved.title,
        } satisfies PromotionCreatedEventPayload,
        sourceModule: "promotion",
        subject: {
          id: saved.id,
          type: "promotion",
        },
      })
    );

    return saved;
  },
  createPromotionRule: async (input) => {
    const promotionId = createPromotionId(input.promotionId);
    const promotion = await repository.findPromotionById(promotionId);

    if (!promotion) {
      throw new Error(`Promotion "${input.promotionId}" was not found.`);
    }

    const now = clock.now();
    const rule: PromotionRuleRecord = {
      attribute: normalizeText(input.attribute),
      createdAt: now,
      id: createPromotionRuleId(
        createId(PROMOTION_RULE_ID_PREFIX, idGenerator)
      ),
      promotionId,
      updatedAt: now,
      value: normalizeText(input.value),
    };

    return repository.saveRule(rule);
  },
  createUsageLimit: async (input) => {
    const promotionId = createPromotionId(input.promotionId);
    const promotion = await repository.findPromotionById(promotionId);

    if (!promotion) {
      throw new Error(`Promotion "${input.promotionId}" was not found.`);
    }

    const now = clock.now();
    const usageLimit: PromotionUsageLimitRecord = {
      createdAt: now,
      id: createPromotionUsageLimitId(
        createId(PROMOTION_USAGE_LIMIT_ID_PREFIX, idGenerator)
      ),
      limit: input.limit,
      promotionId,
      scope: input.scope,
      updatedAt: now,
    };

    return repository.saveUsageLimit(usageLimit);
  },
  recordRedemption: async (input) => {
    const promotionId = createPromotionId(input.promotionId);
    const promotion = await repository.findPromotionById(promotionId);

    if (!promotion) {
      throw new Error(`Promotion "${input.promotionId}" was not found.`);
    }

    const redemption: PromotionRedemptionRecord = {
      adjustmentIds: [...input.adjustmentIds],
      cartId: input.cartId,
      createdAt: clock.now(),
      id: createPromotionRedemptionId(
        createId(PROMOTION_REDEMPTION_ID_PREFIX, idGenerator)
      ),
      promotionId,
    };
    const saved = await repository.saveRedemption(redemption);

    await eventPublisher.publish(
      createEventEnvelope({
        id: createId("evt_", idGenerator),
        name: PROMOTION_REDEMPTION_RECORDED_EVENT,
        payload: {
          cartId: saved.cartId,
          id: saved.id,
          promotionId: saved.promotionId,
        } satisfies PromotionRedemptionRecordedEventPayload,
        sourceModule: "promotion",
        subject: {
          id: saved.promotionId,
          type: "promotion",
        },
      })
    );

    return saved;
  },
});

export const createPromotionServiceLayer = (service: PromotionServiceShape) =>
  Layer.succeed(PromotionService, service);

export const defaultPromotionService = createPromotionService({
  repository: defaultPromotionRepository,
});
