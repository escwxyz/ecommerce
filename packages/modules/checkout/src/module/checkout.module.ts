import { defineCommerceModule } from "@ecommerce/core";
import { Effect } from "effect";

import { checkoutAdminSurfaces } from "../admin";
import { checkoutPermissionList } from "../permissions";
import {
  CHECKOUT_COMPLETED_EVENT,
  CHECKOUT_FAILED_EVENT,
  CheckoutService,
} from "../services";

export const checkoutWorkflow = {
  key: "checkout.complete",
  resolveOutput: () => ({
    contract: "checkout.complete",
  }),
  steps: [
    {
      name: "checkout.validate-cart",
      run: () =>
        Effect.succeed({ output: { contract: "checkout.validateCart" } }),
    },
    {
      name: "checkout.calculate",
      run: () => Effect.succeed({ output: { contract: "checkout.calculate" } }),
    },
    {
      name: "checkout.reserve-inventory",
      run: () =>
        Effect.succeed({ output: { contract: "checkout.reserveInventory" } }),
      compensation: {
        name: "checkout.release-inventory",
        compensate: () => Effect.void,
      },
    },
    {
      name: "checkout.authorize-payment",
      run: () =>
        Effect.succeed({ output: { contract: "checkout.authorizePayment" } }),
    },
    {
      name: "checkout.create-order",
      run: () =>
        Effect.succeed({ output: { contract: "checkout.createOrder" } }),
    },
    {
      name: "checkout.create-fulfillment",
      run: () =>
        Effect.succeed({ output: { contract: "checkout.createFulfillment" } }),
      compensation: {
        name: "checkout.cancel-fulfillment",
        compensate: () => Effect.void,
      },
    },
    {
      name: "checkout.publish-events",
      run: () =>
        Effect.succeed({ output: { contract: "checkout.publishEvents" } }),
    },
  ],
  version: 1,
} as const;

export const checkoutModule = defineCommerceModule({
  contributions: {
    adminSurfaces: checkoutAdminSurfaces,
    apiFragments: [],
    eventTypes: [CHECKOUT_COMPLETED_EVENT, CHECKOUT_FAILED_EVENT],
    permissions: checkoutPermissionList,
    workflows: [checkoutWorkflow],
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
  providedServices: [{ key: "checkout-service", service: CheckoutService }],
});
