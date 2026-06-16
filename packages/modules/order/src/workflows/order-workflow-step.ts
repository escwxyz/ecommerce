import { Effect } from "effect";

export const createOrderFromCheckoutWorkflowStep = {
  name: "order.create-from-checkout",
  run: () =>
    Effect.succeed({
      output: {
        contract: "order.createFromCheckout",
      },
    }),
} as const;
