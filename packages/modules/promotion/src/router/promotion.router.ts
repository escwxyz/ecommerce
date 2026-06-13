import type { CommerceModuleApiFragment } from "@ecommerce/core";
import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { implement, ORPCError } from "@orpc/server";

import { promotionContractRouter } from "../contracts";
import type {
  CalculatePromotionAdjustmentsInput,
  CampaignApiRecord,
  CampaignRecord,
  CreateCampaignInput,
  CreatePromotionInput,
  CreatePromotionRuleInput,
  CreatePromotionUsageLimitInput,
  PromotionApiRecord,
  PromotionRecord,
  PromotionRedemptionApiRecord,
  PromotionRedemptionRecord,
  PromotionRuleApiRecord,
  PromotionRuleRecord,
  PromotionUsageLimitApiRecord,
  PromotionUsageLimitRecord,
  RecordPromotionRedemptionInput,
} from "../domain";
import { promotionPermissions } from "../permissions";
import { createPromotionService, defaultPromotionService } from "../services";
import type { CreatePromotionServiceOptions } from "../services";

export interface PromotionModuleContext {
  readonly auth: unknown;
  readonly authorization: {
    evaluatePermission(input: {
      readonly permission: CommercePermissionDescriptor;
      readonly session: PromotionModuleContext["session"];
    }): PromotionAuthorizationDecision;
  };
  readonly session: {
    readonly user?: unknown | null;
  } | null;
}

type PromotionAuthorizationDecision =
  | {
      readonly allowed: true;
    }
  | {
      readonly allowed: false;
      readonly reason:
        | "missing-authenticated-actor"
        | "missing-permission"
        | "unsupported-permission";
    };

const assertPermission = (
  session: PromotionModuleContext["session"],
  permission: CommercePermissionDescriptor,
  authorization: PromotionModuleContext["authorization"]
): void => {
  const decision = authorization.evaluatePermission({ permission, session });

  if (decision.allowed) {
    return;
  }

  if (decision.reason === "missing-authenticated-actor") {
    throw new ORPCError("UNAUTHORIZED");
  }

  throw new ORPCError("FORBIDDEN");
};

const serializeCampaign = (campaign: CampaignRecord): CampaignApiRecord => ({
  createdAt: campaign.createdAt.toISOString(),
  description: campaign.description,
  id: campaign.id,
  metadata: campaign.metadata,
  name: campaign.name,
  updatedAt: campaign.updatedAt.toISOString(),
});

const serializePromotion = (
  promotion: PromotionRecord
): PromotionApiRecord => ({
  applicationMethod: promotion.applicationMethod,
  campaignId: promotion.campaignId,
  code: promotion.code,
  createdAt: promotion.createdAt.toISOString(),
  endsAt: promotion.endsAt?.toISOString() ?? null,
  id: promotion.id,
  metadata: promotion.metadata,
  startsAt: promotion.startsAt?.toISOString() ?? null,
  status: promotion.status,
  title: promotion.title,
  updatedAt: promotion.updatedAt.toISOString(),
});

const serializeRule = (rule: PromotionRuleRecord): PromotionRuleApiRecord => ({
  attribute: rule.attribute,
  createdAt: rule.createdAt.toISOString(),
  id: rule.id,
  promotionId: rule.promotionId,
  updatedAt: rule.updatedAt.toISOString(),
  value: rule.value,
});

const serializeUsageLimit = (
  usageLimit: PromotionUsageLimitRecord
): PromotionUsageLimitApiRecord => ({
  createdAt: usageLimit.createdAt.toISOString(),
  id: usageLimit.id,
  limit: usageLimit.limit,
  promotionId: usageLimit.promotionId,
  scope: usageLimit.scope,
  updatedAt: usageLimit.updatedAt.toISOString(),
});

const serializeRedemption = (
  redemption: PromotionRedemptionRecord
): PromotionRedemptionApiRecord => ({
  adjustmentIds: [...redemption.adjustmentIds],
  cartId: redemption.cartId,
  createdAt: redemption.createdAt.toISOString(),
  id: redemption.id,
  promotionId: redemption.promotionId,
});

export interface CreatePromotionRouteFragmentOptions extends CreatePromotionServiceOptions {
  readonly key?: string;
}

export const createPromotionRouteFragment = ({
  key = "module:promotion",
  ...options
}: CreatePromotionRouteFragmentOptions = {}) => {
  const service =
    options.clock ||
    options.eventPublisher ||
    options.idGenerator ||
    options.repository
      ? createPromotionService(options)
      : defaultPromotionService;

  const baseImplementation = implement(
    promotionContractRouter
  ).$context<PromotionModuleContext>();

  const protectedImplementation = baseImplementation.use(
    ({ context, next }) => {
      if (!context.session?.user) {
        throw new ORPCError("UNAUTHORIZED");
      }

      return next({
        context: {
          auth: context.auth,
          authorization: context.authorization,
          session: context.session,
        },
      });
    }
  );

  const router = protectedImplementation.router({
    promotionAdjustmentsCalculate:
      protectedImplementation.promotionAdjustmentsCalculate.handler(
        ({
          context,
          input,
        }: {
          readonly context: PromotionModuleContext;
          readonly input: CalculatePromotionAdjustmentsInput;
        }) => {
          assertPermission(
            context.session,
            promotionPermissions.read,
            context.authorization
          );

          return service.calculateAdjustments(input);
        }
      ),
    promotionCampaignCreate:
      protectedImplementation.promotionCampaignCreate.handler(
        async ({
          context,
          input,
        }: {
          readonly context: PromotionModuleContext;
          readonly input: CreateCampaignInput;
        }) => {
          assertPermission(
            context.session,
            promotionPermissions.write,
            context.authorization
          );

          return serializeCampaign(await service.createCampaign(input));
        }
      ),
    promotionCreate: protectedImplementation.promotionCreate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: PromotionModuleContext;
        readonly input: CreatePromotionInput;
      }) => {
        assertPermission(
          context.session,
          promotionPermissions.write,
          context.authorization
        );

        return serializePromotion(await service.createPromotion(input));
      }
    ),
    promotionRedemptionRecord:
      protectedImplementation.promotionRedemptionRecord.handler(
        async ({
          context,
          input,
        }: {
          readonly context: PromotionModuleContext;
          readonly input: RecordPromotionRedemptionInput;
        }) => {
          assertPermission(
            context.session,
            promotionPermissions.write,
            context.authorization
          );

          return serializeRedemption(await service.recordRedemption(input));
        }
      ),
    promotionRuleCreate: protectedImplementation.promotionRuleCreate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: PromotionModuleContext;
        readonly input: CreatePromotionRuleInput;
      }) => {
        assertPermission(
          context.session,
          promotionPermissions.write,
          context.authorization
        );

        return serializeRule(await service.createPromotionRule(input));
      }
    ),
    promotionUsageLimitCreate:
      protectedImplementation.promotionUsageLimitCreate.handler(
        async ({
          context,
          input,
        }: {
          readonly context: PromotionModuleContext;
          readonly input: CreatePromotionUsageLimitInput;
        }) => {
          assertPermission(
            context.session,
            promotionPermissions.write,
            context.authorization
          );

          return serializeUsageLimit(await service.createUsageLimit(input));
        }
      ),
  });

  return {
    key,
    router,
  } as const satisfies CommerceModuleApiFragment<typeof router>;
};

export const promotionApiFragment = createPromotionRouteFragment();
export const promotionRouter = promotionApiFragment.router;
