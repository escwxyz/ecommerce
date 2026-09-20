import {
  defineCommerceModule,
  defineCommerceModuleServiceContribution,
  defineCommerceModuleWorkflowContribution,
} from "@ecommerce/core";
import type { CommerceWorkflowDefinition } from "@ecommerce/core";
import { Effect, Schema } from "effect";

import { checkoutAdminSurfaces } from "../admin";
import {
  CheckoutCompletionResultSchema,
  CompleteCheckoutInputSchema,
} from "../domain";
import type {
  CheckoutExpectedError,
  CheckoutCompletionResult,
  CompleteCheckoutInput,
} from "../domain";
import { checkoutPermissionList } from "../permissions";
import {
  CHECKOUT_COMPLETED_EVENT,
  CHECKOUT_FAILED_EVENT,
  CheckoutService,
  CheckoutServiceLive,
} from "../services";
import type { CheckoutServiceShape } from "../services";

/**
 * Executes Checkout's public service inside the workflow runtime. The service
 * owns commerce sequencing, idempotency, and compensation; the runtime owns
 * execution and persists the completed result for replay.
 */
export const checkoutWorkflow: CommerceWorkflowDefinition<
  CompleteCheckoutInput,
  CheckoutCompletionResult,
  CheckoutExpectedError,
  CheckoutServiceShape
> = {
  key: "checkout.complete",
  inputSchema: CompleteCheckoutInputSchema,
  outputSchema: CheckoutCompletionResultSchema,
  resolveOutput: (attempts) => {
    const output = attempts.find(
      (attempt) =>
        attempt.stepName === "checkout.complete" &&
        attempt.status === "completed"
    )?.output;
    if (!Schema.is(CheckoutCompletionResultSchema)(output)) {
      throw new Error("Checkout workflow completed without a valid result.");
    }
    return output;
  },
  steps: [
    {
      name: "checkout.complete",
      run: (input) =>
        CheckoutService.use((service) => service.completeCheckout(input)).pipe(
          Effect.map((output) => ({ output }))
        ),
    },
  ],
  version: 1,
};

export const checkoutModule = defineCommerceModule({
  contributions: {
    adminSurfaces: checkoutAdminSurfaces,
    eventTypes: [CHECKOUT_COMPLETED_EVENT, CHECKOUT_FAILED_EVENT],
    permissions: checkoutPermissionList,
    services: [
      defineCommerceModuleServiceContribution({
        key: "checkout:service",
        layer: CheckoutServiceLive,
        service: CheckoutService,
      }),
    ],
    workflows: [
      defineCommerceModuleWorkflowContribution({
        key: checkoutWorkflow.key,
        layer: CheckoutServiceLive,
        workflow: checkoutWorkflow,
      }),
    ],
  },
  dependencies: [
    "store",
    "region-sales-channel",
    "product",
    "pricing",
    "promotion",
    "tax",
    "inventory",
    "customer",
    "cart",
    "payment",
    "fulfillment",
    "order",
    "notification-event",
  ],
  key: "checkout",
});
