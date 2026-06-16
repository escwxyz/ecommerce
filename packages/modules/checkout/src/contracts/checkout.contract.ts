import { defineApiContractRoute } from "@ecommerce/module-contracts";

import {
  CheckoutCompletionResultSchema,
  CompleteCheckoutInputSchema,
} from "../domain";

export const checkoutContractRouter = {
  checkoutComplete: defineApiContractRoute({
    description:
      "Complete checkout through the shared workflow orchestration contract.",
    method: "POST",
    operationId: "checkoutComplete",
    path: "/checkout/complete",
    successDescription: "Checkout workflow completed.",
    summary: "Complete checkout",
    tags: ["Checkout"],
  })
    .input(CompleteCheckoutInputSchema)
    .output(CheckoutCompletionResultSchema),
} as const;
