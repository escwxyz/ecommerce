import {
  CheckoutCompletionFailure,
  CheckoutCompletionResultSchema,
  CompleteCheckoutInputSchema,
} from "@ecommerce/checkout";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import {
  EffectHttpAuthMiddleware,
  EffectHttpExecutionMiddleware,
  EffectHttpForbidden,
  EffectHttpRequestContextMiddleware,
} from "./effect-http-middleware";
import { createApiSuccessSchema } from "./http-api-schemas";

const checkoutAdminGroupIdentifier = "checkoutAdmin";

export const checkoutWriteErrors = [
  EffectHttpForbidden,
  CheckoutCompletionFailure.pipe(HttpApiSchema.status(400)),
] as const;

export const CheckoutCompletionResultSuccessSchema = createApiSuccessSchema(
  CheckoutCompletionResultSchema
);

/**
 * Checkout admin Effect HTTP contract for orchestration entrypoints.
 * The endpoint replaces the legacy oRPC checkout route while order and
 * notification-event remain composed as temporary downstream adapters.
 */
export const checkoutAdminHttpApiGroup = HttpApiGroup.make(
  checkoutAdminGroupIdentifier
)
  .add(
    HttpApiEndpoint.post("checkoutComplete", "/admin/checkout/complete", {
      error: checkoutWriteErrors,
      payload: CompleteCheckoutInputSchema,
      success: CheckoutCompletionResultSuccessSchema,
    })
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);
