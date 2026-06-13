import type { CommerceModuleApiFragment } from "@ecommerce/core";
import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { implement, ORPCError } from "@orpc/server";

import { pricingContractRouter } from "../contracts";
import type {
  CalculatedPrice,
  CreateCurrencyInput,
  CreateMoneyAmountInput,
  CreatePriceListInput,
  CreatePriceRuleInput,
  CreatePriceSetInput,
  CurrencyApiRecord,
  CurrencyRecord,
  MoneyAmountApiRecord,
  MoneyAmountRecord,
  PriceListApiRecord,
  PriceListRecord,
  PriceRuleApiRecord,
  PriceRuleRecord,
  PriceSetApiRecord,
  PriceSetRecord,
} from "../domain";
import { pricingPermissions } from "../permissions";
import { createPricingService, defaultPricingService } from "../services";
import type { CreatePricingServiceOptions } from "../services";

export interface PricingModuleContext {
  readonly auth: unknown;
  readonly authorization: {
    evaluatePermission(input: {
      readonly permission: CommercePermissionDescriptor;
      readonly session: PricingModuleContext["session"];
    }): PricingAuthorizationDecision;
  };
  readonly session: {
    readonly user?: unknown | null;
  } | null;
}

type PricingAuthorizationDecision =
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
  session: PricingModuleContext["session"],
  permission: CommercePermissionDescriptor,
  authorization: PricingModuleContext["authorization"]
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

const serializeCurrency = (currency: CurrencyRecord): CurrencyApiRecord => ({
  code: currency.code,
  createdAt: currency.createdAt.toISOString(),
  id: currency.id,
  name: currency.name,
  precision: currency.precision,
  updatedAt: currency.updatedAt.toISOString(),
});

const serializePriceSet = (priceSet: PriceSetRecord): PriceSetApiRecord => ({
  createdAt: priceSet.createdAt.toISOString(),
  id: priceSet.id,
  metadata: priceSet.metadata,
  title: priceSet.title,
  updatedAt: priceSet.updatedAt.toISOString(),
});

const serializePriceList = (
  priceList: PriceListRecord
): PriceListApiRecord => ({
  createdAt: priceList.createdAt.toISOString(),
  description: priceList.description,
  endsAt: priceList.endsAt?.toISOString() ?? null,
  id: priceList.id,
  startsAt: priceList.startsAt?.toISOString() ?? null,
  status: priceList.status,
  title: priceList.title,
  updatedAt: priceList.updatedAt.toISOString(),
});

const serializeMoneyAmount = (
  amount: MoneyAmountRecord
): MoneyAmountApiRecord => ({
  amount: amount.amount,
  createdAt: amount.createdAt.toISOString(),
  currencyCode: amount.currencyCode,
  id: amount.id,
  priceListId: amount.priceListId,
  priceSetId: amount.priceSetId,
  rules: amount.rules,
  updatedAt: amount.updatedAt.toISOString(),
});

const serializePriceRule = (rule: PriceRuleRecord): PriceRuleApiRecord => ({
  attribute: rule.attribute,
  createdAt: rule.createdAt.toISOString(),
  id: rule.id,
  priceListId: rule.priceListId,
  updatedAt: rule.updatedAt.toISOString(),
  value: rule.value,
});

const serializeCalculatedPrice = (
  calculatedPrice: CalculatedPrice
): CalculatedPrice => calculatedPrice;

export interface CreatePricingRouteFragmentOptions extends CreatePricingServiceOptions {
  readonly key?: string;
}

export const createPricingRouteFragment = ({
  key = "module:pricing",
  ...options
}: CreatePricingRouteFragmentOptions = {}) => {
  const service =
    options.clock ||
    options.eventPublisher ||
    options.idGenerator ||
    options.repository
      ? createPricingService(options)
      : defaultPricingService;

  const baseImplementation = implement(
    pricingContractRouter
  ).$context<PricingModuleContext>();

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
    pricingCalculate: protectedImplementation.pricingCalculate.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          pricingPermissions.read,
          context.authorization
        );

        return serializeCalculatedPrice(await service.calculatePrice(input));
      }
    ),
    pricingCurrencyCreate:
      protectedImplementation.pricingCurrencyCreate.handler(
        async ({
          context,
          input,
        }: {
          readonly context: PricingModuleContext;
          readonly input: CreateCurrencyInput;
        }) => {
          assertPermission(
            context.session,
            pricingPermissions.write,
            context.authorization
          );

          return serializeCurrency(await service.createCurrency(input));
        }
      ),
    pricingCurrencyList: protectedImplementation.pricingCurrencyList.handler(
      async ({ context }) => {
        assertPermission(
          context.session,
          pricingPermissions.read,
          context.authorization
        );

        const currencies = await service.listCurrencies();

        return currencies.map(serializeCurrency);
      }
    ),
    pricingMoneyAmountCreate:
      protectedImplementation.pricingMoneyAmountCreate.handler(
        async ({
          context,
          input,
        }: {
          readonly context: PricingModuleContext;
          readonly input: CreateMoneyAmountInput;
        }) => {
          assertPermission(
            context.session,
            pricingPermissions.write,
            context.authorization
          );

          return serializeMoneyAmount(await service.createMoneyAmount(input));
        }
      ),
    pricingPriceListCreate:
      protectedImplementation.pricingPriceListCreate.handler(
        async ({
          context,
          input,
        }: {
          readonly context: PricingModuleContext;
          readonly input: CreatePriceListInput;
        }) => {
          assertPermission(
            context.session,
            pricingPermissions.write,
            context.authorization
          );

          return serializePriceList(await service.createPriceList(input));
        }
      ),
    pricingPriceRuleCreate:
      protectedImplementation.pricingPriceRuleCreate.handler(
        async ({
          context,
          input,
        }: {
          readonly context: PricingModuleContext;
          readonly input: CreatePriceRuleInput;
        }) => {
          assertPermission(
            context.session,
            pricingPermissions.write,
            context.authorization
          );

          return serializePriceRule(await service.createPriceRule(input));
        }
      ),
    pricingPriceSetCreate:
      protectedImplementation.pricingPriceSetCreate.handler(
        async ({
          context,
          input,
        }: {
          readonly context: PricingModuleContext;
          readonly input: CreatePriceSetInput;
        }) => {
          assertPermission(
            context.session,
            pricingPermissions.write,
            context.authorization
          );

          return serializePriceSet(await service.createPriceSet(input));
        }
      ),
  });

  return {
    key,
    router,
  } as const satisfies CommerceModuleApiFragment<typeof router>;
};

export const pricingApiFragment = createPricingRouteFragment();
export const pricingRouter = pricingApiFragment.router;
