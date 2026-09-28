import { defineEffectHttpApiModuleContribution } from "@ecommerce/api/effect-http-api";
import {
  CurrentEffectHttpRequestContext,
  withEffectHttpPermission,
} from "@ecommerce/api/effect-http-middleware";
import type { EffectHttpRequestIdentity } from "@ecommerce/api/effect-http-middleware";
import { defineCommerceModuleApiGroupContribution } from "@ecommerce/core";
import { Effect } from "effect";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import { checkoutPermissions } from "../permissions";
import { CheckoutService } from "../services";
import { checkoutAdminHttpApiGroup } from "./contract";

const checkoutAdminGroupIdentifier = "checkoutAdmin";

const checkoutAdminHttpApi = HttpApi.make("CheckoutAdminApi").add(
  checkoutAdminHttpApiGroup
);

const withSuccessEnvelope = <TData>(
  data: TData,
  request: EffectHttpRequestIdentity
) =>
  ({
    data,
    meta: { request },
    success: true,
  }) as const;

const withCurrentRequest = <TData, TError, TRequirements>(
  effect: Effect.Effect<TData, TError, TRequirements>
) =>
  Effect.gen(function* createCheckoutApiSuccessEnvelope() {
    const context = yield* CurrentEffectHttpRequestContext;
    const data = yield* effect;
    return withSuccessEnvelope(data, context.identity);
  });

/** Public Effect HTTP handlers supplied by this module contribution. */
export const checkoutAdminHttpApiHandlers = HttpApiBuilder.group(
  checkoutAdminHttpApi,
  checkoutAdminGroupIdentifier,
  (handlers) =>
    handlers.handle("checkoutComplete", ({ payload }) =>
      withEffectHttpPermission(
        withCurrentRequest(
          CheckoutService.use((service) => service.completeCheckout(payload))
        ),
        checkoutPermissions.execute
      )
    )
);

/** Executable HTTP contribution registered by the owning module definition. */
export const checkoutEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineCommerceModuleApiGroupContribution({
        group: checkoutAdminHttpApiGroup,
        handlers: checkoutAdminHttpApiHandlers,
        key: "module:checkout.admin",
        surface: "admin",
      }),
    ],
    moduleName: "checkout",
  });
