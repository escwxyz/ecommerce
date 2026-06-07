import type { CommerceModuleApiFragment } from "@ecommerce/core";
import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { implement, ORPCError } from "@orpc/server";

import { storeContractRouter } from "../contracts";
import type {
  StoreApiRecord,
  StoreDefaultsApiRecord,
  StoreSettings,
  UpdateStoreSettingsInput,
} from "../domain";
import { serializeStoreId } from "../domain";
import { storePermissions } from "../permissions";
import { createStoreService, defaultStoreService } from "../services";
import type { CreateStoreServiceOptions } from "../services";

export interface StoreModuleContext {
  readonly auth: unknown;
  readonly authorization: {
    evaluatePermission(input: {
      readonly permission: CommercePermissionDescriptor;
      readonly session: StoreModuleContext["session"];
    }): StoreAuthorizationDecision;
  };
  readonly session: {
    readonly user?: unknown | null;
  } | null;
}

type StoreAuthorizationDecision =
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
  session: StoreModuleContext["session"],
  permission: CommercePermissionDescriptor,
  authorization: StoreModuleContext["authorization"]
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

const serializeStore = (settings: StoreSettings): StoreApiRecord => ({
  createdAt: settings.createdAt.toISOString(),
  defaultCurrencyCode: settings.defaultCurrencyCode,
  defaultLocale: settings.defaultLocale,
  defaultRegionId: settings.defaultRegionId,
  defaultSalesChannelId: settings.defaultSalesChannelId,
  id: serializeStoreId(settings.id),
  metadata: settings.metadata,
  name: settings.name,
  supportedCurrencyCodes: [...settings.supportedCurrencyCodes],
  timezone: settings.timezone,
  updatedAt: settings.updatedAt.toISOString(),
});

const serializeDefaults = (
  settings: StoreSettings
): StoreDefaultsApiRecord => ({
  defaultCurrencyCode: settings.defaultCurrencyCode,
  defaultLocale: settings.defaultLocale,
  defaultRegionId: settings.defaultRegionId,
  defaultSalesChannelId: settings.defaultSalesChannelId,
  supportedCurrencyCodes: [...settings.supportedCurrencyCodes],
  timezone: settings.timezone,
});

export interface CreateStoreRouteFragmentOptions extends CreateStoreServiceOptions {
  readonly key?: string;
}

export const createStoreRouteFragment = ({
  key = "module:store",
  ...options
}: CreateStoreRouteFragmentOptions = {}) => {
  const service =
    options.repository ||
    options.clock ||
    options.idGenerator ||
    options.initialSettings ||
    options.eventPublisher
      ? createStoreService(options)
      : defaultStoreService;

  const baseImplementation =
    implement(storeContractRouter).$context<StoreModuleContext>();

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
    storeDefaultsGet: protectedImplementation.storeDefaultsGet.handler(
      async ({ context }) => {
        assertPermission(
          context.session,
          storePermissions.read,
          context.authorization
        );

        return serializeDefaults(await service.getStoreSettings());
      }
    ),
    storeSettingsGet: protectedImplementation.storeSettingsGet.handler(
      async ({ context }) => {
        assertPermission(
          context.session,
          storePermissions.read,
          context.authorization
        );

        return serializeStore(await service.getStoreSettings());
      }
    ),
    storeSettingsUpdate: protectedImplementation.storeSettingsUpdate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: StoreModuleContext;
        readonly input: UpdateStoreSettingsInput;
      }) => {
        assertPermission(
          context.session,
          storePermissions.write,
          context.authorization
        );

        return serializeStore(await service.updateStoreSettings(input));
      }
    ),
  });

  return {
    key,
    router,
  } as const satisfies CommerceModuleApiFragment<typeof router>;
};

export const storeApiFragment = createStoreRouteFragment();
export const storeRouter = storeApiFragment.router;
