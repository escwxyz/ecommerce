import {
  EffectHttpAuthMiddleware,
  EffectHttpExecutionMiddleware,
  EffectHttpForbidden,
  EffectHttpRequestContextMiddleware,
} from "@ecommerce/api/effect-http-middleware";
import { createApiSuccessSchema } from "@ecommerce/api/http-api-schemas";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import {
  CheckoutCompletionFailure,
  CheckoutCompletionResultSchema,
  CompleteCheckoutInputSchema,
} from "../domain";

const checkoutAdminGroupIdentifier = "checkoutAdmin";

/** Declared HTTP error schemas for this module contract surface. */
export const checkoutWriteErrors = [
  EffectHttpForbidden,
  CheckoutCompletionFailure.pipe(HttpApiSchema.status(400)),
] as const;

/** Success envelope schema exported for contract-only API consumers. */
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
