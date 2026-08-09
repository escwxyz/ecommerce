import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
  OutboxWriterServiceShape,
  TransactionBoundaryServiceShape,
  CurrentTransactionService,
} from "@ecommerce/core";
import {
  COMMERCE_EVENTS_OUTBOX_TOPIC,
  ClockService,
  IdGeneratorService,
  OutboxWriterService,
  TransactionBoundaryService,
  executeTransactionalMutation,
} from "@ecommerce/core";
import type { CommerceEventEnvelope } from "@ecommerce/core/events";
import { createEventEnvelope } from "@ecommerce/core/events";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import { nanoid } from "nanoid";

import type {
  CalculatePromotionAdjustmentsInput,
  CampaignRecord,
  CreateCampaignInput,
  CreatePromotionInput,
  CreatePromotionRuleInput,
  CreatePromotionUsageLimitInput,
  PromotionAdjustment,
  PromotionAdjustmentResult,
  PromotionExpectedError,
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
  PromotionCampaignNotFound,
  PromotionNotFound,
  PromotionRepositoryService,
  PromotionUnsupportedUsageLimitScope,
  PromotionValidationFailure,
  createCampaignIdEffect,
  createPromotionAdjustmentIdEffect,
  createPromotionIdEffect,
  createPromotionRedemptionIdEffect,
  createPromotionRuleIdEffect,
  createPromotionUsageLimitIdEffect,
} from "../domain";

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

export type PromotionServiceFailure = PromotionExpectedError;

export interface PromotionServiceShape {
  readonly calculateAdjustments: (
    input: CalculatePromotionAdjustmentsInput
  ) => EffectValue<PromotionAdjustmentResult, PromotionServiceFailure>;
  readonly createCampaign: (
    input: CreateCampaignInput
  ) => EffectValue<CampaignRecord, PromotionServiceFailure>;
  readonly createPromotion: (
    input: CreatePromotionInput
  ) => EffectValue<PromotionRecord, PromotionServiceFailure>;
  readonly createPromotionRule: (
    input: CreatePromotionRuleInput
  ) => EffectValue<PromotionRuleRecord, PromotionServiceFailure>;
  readonly createUsageLimit: (
    input: CreatePromotionUsageLimitInput
  ) => EffectValue<PromotionUsageLimitRecord, PromotionServiceFailure>;
  readonly recordRedemption: (
    input: RecordPromotionRedemptionInput
  ) => EffectValue<PromotionRedemptionRecord, PromotionServiceFailure>;
}

export const PromotionService = Context.Service<PromotionServiceShape>(
  "@ecommerce/promotion/PromotionService"
);

export interface CreatePromotionServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly outboxWriter: OutboxWriterServiceShape;
  readonly repository: PromotionRepository;
  readonly transactionBoundary: TransactionBoundaryServiceShape;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
});

const normalizeCode = (value: string): string => value.trim().toUpperCase();

const normalizeCurrencyCode = (currencyCode: string): string =>
  currencyCode.trim().toUpperCase();

const normalizeText = (value: string): string => value.trim();

const createId = (prefix: string, idGenerator: IdGeneratorServiceShape) => {
  const rawId = idGenerator.nextId();
  return rawId.startsWith(prefix) ? rawId : `${prefix}${rawId}`;
};

const publishEvent = (
  outboxWriter: OutboxWriterServiceShape,
  envelope: CommerceEventEnvelope,
  idempotencyKey: string
) =>
  outboxWriter
    .enqueue({
      event: envelope,
      idempotencyKey: `${envelope.name}:${idempotencyKey}`,
      topic: COMMERCE_EVENTS_OUTBOX_TOPIC,
    })
    .pipe(Effect.asVoid);

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

const getIsUsageLimitAvailable = ({
  promotion,
  repository,
}: {
  readonly promotion: PromotionRecord;
  readonly repository: PromotionRepository;
}): EffectValue<boolean, PromotionServiceFailure> =>
  Effect.gen(function* getIsUsageLimitAvailableEffect() {
    const usageLimits = yield* repository.findUsageLimitsByPromotionId(
      promotion.id
    );

    for (const usageLimit of usageLimits) {
      if (usageLimit.scope !== "total") {
        continue;
      }

      const redemptionCount = yield* repository.countRedemptions(promotion.id);

      if (redemptionCount >= usageLimit.limit) {
        return false;
      }
    }

    return true;
  });

const getCandidatePromotions = ({
  promotionCodes,
  repository,
}: {
  readonly promotionCodes: readonly string[];
  readonly repository: PromotionRepository;
}): EffectValue<readonly PromotionRecord[], PromotionServiceFailure> =>
  Effect.gen(function* getCandidatePromotionsEffect() {
    const promotions: PromotionRecord[] = [
      ...(yield* repository.listAutomaticPromotions),
    ];
    const uniquePromotionCodes = new Set<string>();

    for (const code of promotionCodes) {
      const normalizedCode = normalizeCode(code);

      if (uniquePromotionCodes.has(normalizedCode)) {
        continue;
      }

      uniquePromotionCodes.add(normalizedCode);

      const promotion = yield* repository.findPromotionByCode(normalizedCode);

      if (promotion) {
        promotions.push(promotion);
      }
    }

    return promotions;
  });

export const createPromotionService = ({
  clock = createDefaultClock(),
  idGenerator = createDefaultIdGenerator(),
  outboxWriter,
  repository,
  transactionBoundary,
}: CreatePromotionServiceOptions): PromotionServiceShape => {
  const service = {
    calculateAdjustments: (input: CalculatePromotionAdjustmentsInput) =>
      Effect.gen(function* calculateAdjustmentsEffect() {
        const now = clock.now();
        const context = input.context ?? {};
        const currencyCode = normalizeCurrencyCode(input.cart.currencyCode);
        const promotions = yield* getCandidatePromotions({
          promotionCodes: input.promotionCodes ?? [],
          repository,
        });
        const adjustments: PromotionAdjustment[] = [];

        for (const promotion of promotions) {
          if (!getPromotionIsActive(promotion, now)) {
            continue;
          }

          if (!(yield* getIsUsageLimitAvailable({ promotion, repository }))) {
            continue;
          }

          const rules = yield* repository.findRulesByPromotionId(promotion.id);

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

          const id = yield* createPromotionAdjustmentIdEffect(
            createId(PROMOTION_ADJUSTMENT_ID_PREFIX, idGenerator)
          );

          adjustments.push({
            amount,
            currencyCode,
            id,
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

        yield* publishEvent(
          outboxWriter,
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
          }),
          `${PROMOTION_ADJUSTMENTS_CALCULATED_EVENT}:${result.cartId}:${result.currencyCode}:${result.subtotal}:${result.totalDiscount}`
        );

        return result;
      }),
    createCampaign: (input: CreateCampaignInput) =>
      Effect.gen(function* createCampaignEffect() {
        const name = normalizeText(input.name);

        if (!name) {
          return yield* new PromotionValidationFailure({
            message: "Campaign name is required.",
          });
        }

        const now = clock.now();
        const campaign: CampaignRecord = {
          createdAt: now,
          description: input.description?.trim() || null,
          id: yield* createCampaignIdEffect(
            createId(CAMPAIGN_ID_PREFIX, idGenerator)
          ),
          metadata: input.metadata ?? {},
          name,
          updatedAt: now,
        };

        return yield* repository.saveCampaign(campaign);
      }),
    createPromotion: (input: CreatePromotionInput) =>
      Effect.gen(function* createPromotionEffect() {
        const title = normalizeText(input.title);

        if (!title) {
          return yield* new PromotionValidationFailure({
            message: "Promotion title is required.",
          });
        }

        const campaignId = input.campaignId
          ? yield* createCampaignIdEffect(input.campaignId)
          : null;

        if (campaignId) {
          const campaign = yield* repository.findCampaignById(campaignId);

          if (!campaign) {
            return yield* new PromotionCampaignNotFound({ campaignId });
          }
        }

        const now = clock.now();
        const promotion: PromotionRecord = {
          applicationMethod: input.applicationMethod,
          campaignId,
          code: input.code ? normalizeCode(input.code) : null,
          createdAt: now,
          endsAt: input.endsAt ?? null,
          id: yield* createPromotionIdEffect(
            createId(PROMOTION_ID_PREFIX, idGenerator)
          ),
          metadata: input.metadata ?? {},
          startsAt: input.startsAt ?? null,
          status: input.status ?? "draft",
          title,
          updatedAt: now,
        };
        const saved = yield* repository.savePromotion(promotion);

        yield* publishEvent(
          outboxWriter,
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
          }),
          `${PROMOTION_CREATED_EVENT}:${saved.id}`
        );

        return saved;
      }),
    createPromotionRule: (input: CreatePromotionRuleInput) =>
      Effect.gen(function* createPromotionRuleEffect() {
        const promotionId = yield* createPromotionIdEffect(input.promotionId);
        const promotion = yield* repository.findPromotionById(promotionId);

        if (!promotion) {
          return yield* new PromotionNotFound({ promotionId });
        }

        const attribute = normalizeText(input.attribute);
        const value = normalizeText(input.value);

        if (!attribute || !value) {
          return yield* new PromotionValidationFailure({
            message: "Promotion rule attribute and value are required.",
          });
        }

        const now = clock.now();
        const rule: PromotionRuleRecord = {
          attribute,
          createdAt: now,
          id: yield* createPromotionRuleIdEffect(
            createId(PROMOTION_RULE_ID_PREFIX, idGenerator)
          ),
          promotionId,
          updatedAt: now,
          value,
        };

        return yield* repository.saveRule(rule);
      }),
    createUsageLimit: (input: CreatePromotionUsageLimitInput) =>
      Effect.gen(function* createUsageLimitEffect() {
        const promotionId = yield* createPromotionIdEffect(input.promotionId);
        const promotion = yield* repository.findPromotionById(promotionId);

        if (!promotion) {
          return yield* new PromotionNotFound({ promotionId });
        }

        if (input.scope === "customer") {
          return yield* new PromotionUnsupportedUsageLimitScope({
            scope: input.scope,
          });
        }

        const now = clock.now();
        const usageLimit: PromotionUsageLimitRecord = {
          createdAt: now,
          id: yield* createPromotionUsageLimitIdEffect(
            createId(PROMOTION_USAGE_LIMIT_ID_PREFIX, idGenerator)
          ),
          limit: input.limit,
          promotionId,
          scope: input.scope,
          updatedAt: now,
        };

        return yield* repository.saveUsageLimit(usageLimit);
      }),
    recordRedemption: (input: RecordPromotionRedemptionInput) =>
      Effect.gen(function* recordRedemptionEffect() {
        const promotionId = yield* createPromotionIdEffect(input.promotionId);
        const promotion = yield* repository.findPromotionById(promotionId);

        if (!promotion) {
          return yield* new PromotionNotFound({ promotionId });
        }

        const redemption: PromotionRedemptionRecord = {
          adjustmentIds: [...input.adjustmentIds],
          cartId: input.cartId,
          createdAt: clock.now(),
          id: yield* createPromotionRedemptionIdEffect(
            createId(PROMOTION_REDEMPTION_ID_PREFIX, idGenerator)
          ),
          promotionId,
        };
        const saved = yield* repository.saveRedemption(redemption);

        yield* publishEvent(
          outboxWriter,
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
          }),
          `${PROMOTION_REDEMPTION_RECORDED_EVENT}:${saved.id}`
        );

        return saved;
      }),
  };

  const transactionalPromotionMutation = <A, E>(
    operation: string,
    effect: EffectValue<A, E, CurrentTransactionService>
  ) =>
    executeTransactionalMutation<A, E, never>({
      effect,
      moduleName: "promotion",
      operation,
      outboxMessages: () => [],
      outboxWriter,
      transactionBoundary,
    });

  return {
    calculateAdjustments: (input) =>
      transactionalPromotionMutation(
        "calculateAdjustments",
        service.calculateAdjustments(input)
      ),
    createCampaign: (input) =>
      transactionalPromotionMutation(
        "createCampaign",
        service.createCampaign(input)
      ),
    createPromotion: (input) =>
      transactionalPromotionMutation(
        "createPromotion",
        service.createPromotion(input)
      ),
    createPromotionRule: (input) =>
      transactionalPromotionMutation(
        "createPromotionRule",
        service.createPromotionRule(input)
      ),
    createUsageLimit: (input) =>
      transactionalPromotionMutation(
        "createUsageLimit",
        service.createUsageLimit(input)
      ),
    recordRedemption: (input) =>
      transactionalPromotionMutation(
        "recordRedemption",
        service.recordRedemption(input)
      ),
  };
};

export const createPromotionServiceLayer = (service: PromotionServiceShape) =>
  Layer.succeed(PromotionService, service);

export const PromotionServiceLive = Layer.effect(
  PromotionService,
  Effect.gen(function* createPromotionServiceLiveEffect() {
    const repository = yield* PromotionRepositoryService;
    const clock = yield* ClockService;
    const idGenerator = yield* IdGeneratorService;
    const outboxWriter = yield* OutboxWriterService;
    const transactionBoundary = yield* TransactionBoundaryService;

    return createPromotionService({
      clock,
      idGenerator,
      outboxWriter,
      repository,
      transactionBoundary,
    });
  })
);
