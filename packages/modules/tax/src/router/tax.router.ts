import type { CommerceModuleApiFragment } from "@ecommerce/core";
import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { implement, ORPCError } from "@orpc/server";

import { taxContractRouter } from "../contracts";
import type {
  CalculateTaxInput,
  CreateTaxCategoryInput,
  CreateTaxProviderConfigInput,
  CreateTaxRateInput,
  CreateTaxRegionInput,
  TaxCategoryApiRecord,
  TaxCategoryRecord,
  TaxProviderConfigApiRecord,
  TaxProviderConfigRecord,
  TaxRateApiRecord,
  TaxRateRecord,
  TaxRegionApiRecord,
  TaxRegionRecord,
} from "../domain";
import { taxPermissions } from "../permissions";
import { createTaxService, defaultTaxService } from "../services";
import type { CreateTaxServiceOptions } from "../services";

export interface TaxModuleContext {
  readonly auth: unknown;
  readonly authorization: {
    evaluatePermission(input: {
      readonly permission: CommercePermissionDescriptor;
      readonly session: TaxModuleContext["session"];
    }): TaxAuthorizationDecision;
  };
  readonly session: {
    readonly user?: unknown | null;
  } | null;
}

type TaxAuthorizationDecision =
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
  session: TaxModuleContext["session"],
  permission: CommercePermissionDescriptor,
  authorization: TaxModuleContext["authorization"]
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

const serializeCategory = (
  category: TaxCategoryRecord
): TaxCategoryApiRecord => ({
  code: category.code,
  createdAt: category.createdAt.toISOString(),
  description: category.description,
  id: category.id,
  metadata: category.metadata,
  name: category.name,
  updatedAt: category.updatedAt.toISOString(),
});

const serializeProviderConfig = (
  providerConfig: TaxProviderConfigRecord
): TaxProviderConfigApiRecord => ({
  createdAt: providerConfig.createdAt.toISOString(),
  id: providerConfig.id,
  isActive: providerConfig.isActive,
  metadata: providerConfig.metadata,
  providerKey: providerConfig.providerKey,
  settings: providerConfig.settings,
  updatedAt: providerConfig.updatedAt.toISOString(),
});

const serializeRate = (rate: TaxRateRecord): TaxRateApiRecord => ({
  categoryId: rate.categoryId,
  createdAt: rate.createdAt.toISOString(),
  id: rate.id,
  metadata: rate.metadata,
  name: rate.name,
  percentage: rate.percentage,
  regionId: rate.regionId,
  updatedAt: rate.updatedAt.toISOString(),
});

const serializeRegion = (region: TaxRegionRecord): TaxRegionApiRecord => ({
  code: region.code,
  countryCode: region.countryCode,
  createdAt: region.createdAt.toISOString(),
  id: region.id,
  metadata: region.metadata,
  name: region.name,
  providerConfigId: region.providerConfigId,
  updatedAt: region.updatedAt.toISOString(),
});

export interface CreateTaxRouteFragmentOptions extends CreateTaxServiceOptions {
  readonly key?: string;
}

export const createTaxRouteFragment = ({
  key = "module:tax",
  ...options
}: CreateTaxRouteFragmentOptions = {}) => {
  const service =
    options.clock ||
    options.eventPublisher ||
    options.idGenerator ||
    options.providers ||
    options.repository
      ? createTaxService(options)
      : defaultTaxService;

  const baseImplementation =
    implement(taxContractRouter).$context<TaxModuleContext>();

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
    taxCalculate: protectedImplementation.taxCalculate.handler(
      ({
        context,
        input,
      }: {
        readonly context: TaxModuleContext;
        readonly input: CalculateTaxInput;
      }) => {
        assertPermission(
          context.session,
          taxPermissions.read,
          context.authorization
        );

        return service.calculateTax(input);
      }
    ),
    taxCategoryCreate: protectedImplementation.taxCategoryCreate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: TaxModuleContext;
        readonly input: CreateTaxCategoryInput;
      }) => {
        assertPermission(
          context.session,
          taxPermissions.write,
          context.authorization
        );

        return serializeCategory(await service.createCategory(input));
      }
    ),
    taxProviderConfigCreate:
      protectedImplementation.taxProviderConfigCreate.handler(
        async ({
          context,
          input,
        }: {
          readonly context: TaxModuleContext;
          readonly input: CreateTaxProviderConfigInput;
        }) => {
          assertPermission(
            context.session,
            taxPermissions.write,
            context.authorization
          );

          return serializeProviderConfig(
            await service.createProviderConfig(input)
          );
        }
      ),
    taxRateCreate: protectedImplementation.taxRateCreate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: TaxModuleContext;
        readonly input: CreateTaxRateInput;
      }) => {
        assertPermission(
          context.session,
          taxPermissions.write,
          context.authorization
        );

        return serializeRate(await service.createRate(input));
      }
    ),
    taxRegionCreate: protectedImplementation.taxRegionCreate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: TaxModuleContext;
        readonly input: CreateTaxRegionInput;
      }) => {
        assertPermission(
          context.session,
          taxPermissions.write,
          context.authorization
        );

        return serializeRegion(await service.createRegion(input));
      }
    ),
  });

  return {
    key,
    router,
  } as const satisfies CommerceModuleApiFragment<typeof router>;
};

export const taxApiFragment = createTaxRouteFragment();
export const taxRouter = taxApiFragment.router;
