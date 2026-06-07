import type { CommerceModuleApiFragment } from "@ecommerce/core";
import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { implement, ORPCError } from "@orpc/server";

import { regionSalesChannelContractRouter } from "../contracts";
import type {
  CreateRegionInput,
  CreateSalesChannelInput,
  PublishProductInput,
  RegionApiRecord,
  RegionIdentifierInput,
  RegionRecord,
  SalesChannelApiRecord,
  SalesChannelIdentifierInput,
  SalesChannelRecord,
  ValidateRegionInput,
} from "../domain";
import {
  createRegionId,
  createSalesChannelId,
  serializeRegionId,
  serializeSalesChannelId,
} from "../domain";
import { regionSalesChannelPermissions } from "../permissions";
import {
  createRegionService,
  createSalesChannelService,
  defaultRegionService,
  defaultSalesChannelService,
} from "../services";
import type {
  CreateRegionServiceOptions,
  CreateSalesChannelServiceOptions,
} from "../services";

export interface RegionSalesChannelModuleContext {
  readonly auth: unknown;
  readonly authorization: {
    evaluatePermission(input: {
      readonly permission: CommercePermissionDescriptor;
      readonly session: RegionSalesChannelModuleContext["session"];
    }): RegionSalesChannelAuthorizationDecision;
  };
  readonly session: {
    readonly user?: unknown | null;
  } | null;
}

type RegionSalesChannelAuthorizationDecision =
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
  session: RegionSalesChannelModuleContext["session"],
  permission: CommercePermissionDescriptor,
  authorization: RegionSalesChannelModuleContext["authorization"]
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

const serializeRegion = (region: RegionRecord): RegionApiRecord => ({
  countries: [...region.countries],
  createdAt: region.createdAt.toISOString(),
  currencyCode: region.currencyCode,
  id: serializeRegionId(region.id),
  metadata: region.metadata,
  name: region.name,
  providerAvailability: {
    fulfillmentOptionIds: [...region.providerAvailability.fulfillmentOptionIds],
    paymentProviderIds: [...region.providerAvailability.paymentProviderIds],
    taxProviderId: region.providerAvailability.taxProviderId,
  },
  updatedAt: region.updatedAt.toISOString(),
});

const serializeSalesChannel = (
  channel: SalesChannelRecord
): SalesChannelApiRecord => ({
  createdAt: channel.createdAt.toISOString(),
  description: channel.description,
  id: serializeSalesChannelId(channel.id),
  metadata: channel.metadata,
  name: channel.name,
  productIds: [...channel.productIds],
  status: channel.status,
  updatedAt: channel.updatedAt.toISOString(),
});

export interface CreateRegionSalesChannelRouteFragmentOptions {
  readonly key?: string;
  readonly region?: CreateRegionServiceOptions;
  readonly salesChannel?: CreateSalesChannelServiceOptions;
}

const hasRegionOptions = (options: CreateRegionServiceOptions): boolean =>
  Boolean(
    options.clock ||
    options.eventPublisher ||
    options.idGenerator ||
    options.repository
  );

const hasSalesChannelOptions = (
  options: CreateSalesChannelServiceOptions
): boolean =>
  Boolean(
    options.clock ||
    options.eventPublisher ||
    options.idGenerator ||
    options.repository
  );

export const createRegionSalesChannelRouteFragment = ({
  key = "module:region-sales-channel",
  region: regionOptions = {},
  salesChannel: salesChannelOptions = {},
}: CreateRegionSalesChannelRouteFragmentOptions = {}) => {
  const regionService = hasRegionOptions(regionOptions)
    ? createRegionService(regionOptions)
    : defaultRegionService;
  const salesChannelService = hasSalesChannelOptions(salesChannelOptions)
    ? createSalesChannelService(salesChannelOptions)
    : defaultSalesChannelService;

  const baseImplementation = implement(
    regionSalesChannelContractRouter
  ).$context<RegionSalesChannelModuleContext>();

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
    regionCreate: protectedImplementation.regionCreate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: RegionSalesChannelModuleContext;
        readonly input: CreateRegionInput;
      }) => {
        assertPermission(
          context.session,
          regionSalesChannelPermissions.regionWrite,
          context.authorization
        );

        return serializeRegion(await regionService.createRegion(input));
      }
    ),
    regionGet: protectedImplementation.regionGet.handler(
      async ({
        context,
        input,
      }: {
        readonly context: RegionSalesChannelModuleContext;
        readonly input: RegionIdentifierInput;
      }) => {
        assertPermission(
          context.session,
          regionSalesChannelPermissions.regionRead,
          context.authorization
        );

        const regionRecord = await regionService.getRegionById(
          createRegionId(input.id)
        );

        return regionRecord ? serializeRegion(regionRecord) : null;
      }
    ),
    regionList: protectedImplementation.regionList.handler(
      async ({ context }) => {
        assertPermission(
          context.session,
          regionSalesChannelPermissions.regionRead,
          context.authorization
        );

        const records = await regionService.listRegions();

        return records.map(serializeRegion);
      }
    ),
    regionValidate: protectedImplementation.regionValidate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: RegionSalesChannelModuleContext;
        readonly input: ValidateRegionInput;
      }) => {
        assertPermission(
          context.session,
          regionSalesChannelPermissions.regionRead,
          context.authorization
        );

        const result = await regionService.validateRegionConstraints(input);

        return {
          allowed: result.allowed,
          reasons: [...result.reasons],
        };
      }
    ),
    salesChannelCreate: protectedImplementation.salesChannelCreate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: RegionSalesChannelModuleContext;
        readonly input: CreateSalesChannelInput;
      }) => {
        assertPermission(
          context.session,
          regionSalesChannelPermissions.salesChannelWrite,
          context.authorization
        );

        return serializeSalesChannel(
          await salesChannelService.createSalesChannel(input)
        );
      }
    ),
    salesChannelGet: protectedImplementation.salesChannelGet.handler(
      async ({
        context,
        input,
      }: {
        readonly context: RegionSalesChannelModuleContext;
        readonly input: SalesChannelIdentifierInput;
      }) => {
        assertPermission(
          context.session,
          regionSalesChannelPermissions.salesChannelRead,
          context.authorization
        );

        const channel = await salesChannelService.getSalesChannelById(
          createSalesChannelId(input.id)
        );

        return channel ? serializeSalesChannel(channel) : null;
      }
    ),
    salesChannelList: protectedImplementation.salesChannelList.handler(
      async ({ context }) => {
        assertPermission(
          context.session,
          regionSalesChannelPermissions.salesChannelRead,
          context.authorization
        );

        const channels = await salesChannelService.listSalesChannels();

        return channels.map(serializeSalesChannel);
      }
    ),
    salesChannelProductPublish:
      protectedImplementation.salesChannelProductPublish.handler(
        async ({
          context,
          input,
        }: {
          readonly context: RegionSalesChannelModuleContext;
          readonly input: PublishProductInput;
        }) => {
          assertPermission(
            context.session,
            regionSalesChannelPermissions.salesChannelWrite,
            context.authorization
          );

          return serializeSalesChannel(
            await salesChannelService.publishProductToSalesChannel(input)
          );
        }
      ),
    salesChannelPublishabilityCheck:
      protectedImplementation.salesChannelPublishabilityCheck.handler(
        async ({
          context,
          input,
        }: {
          readonly context: RegionSalesChannelModuleContext;
          readonly input: PublishProductInput;
        }) => {
          assertPermission(
            context.session,
            regionSalesChannelPermissions.salesChannelRead,
            context.authorization
          );

          const result =
            await salesChannelService.checkProductPublishability(input);

          return {
            publishable: result.publishable,
            reasons: [...result.reasons],
          };
        }
      ),
  });

  return {
    key,
    router,
  } as const satisfies CommerceModuleApiFragment<typeof router>;
};

export const regionSalesChannelApiFragment =
  createRegionSalesChannelRouteFragment();
export const regionSalesChannelRouter = regionSalesChannelApiFragment.router;
