import { CheckoutService, checkoutPermissions } from "@ecommerce/checkout";
import { Effect } from "effect";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import { checkoutAdminHttpApiGroup } from "./checkout-effect-http-contract";
import {
  defineAdminHttpApiGroupContribution,
  defineEffectHttpApiModuleContribution,
} from "./effect-http-api";
import {
  CurrentEffectHttpRequestContext,
  withEffectHttpPermission,
} from "./effect-http-middleware";
import type { EffectHttpRequestIdentity } from "./effect-http-middleware";

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

export const checkoutEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineAdminHttpApiGroupContribution({
        group: checkoutAdminHttpApiGroup,
        handlers: checkoutAdminHttpApiHandlers,
        key: "module:checkout.admin",
        owner: "module",
      }),
    ],
    moduleName: "checkout",
  });
