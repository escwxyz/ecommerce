import { defineCommerceModule } from "@ecommerce/core";
import { Effect } from "effect";

import { cartAdminSurfaces } from "../admin";
import { cartPermissionList } from "../permissions";
import { cartApiFragment } from "../router";
import {
  CART_ADJUSTMENT_APPLIED_EVENT,
  CART_CHECKOUT_REFERENCE_SET_EVENT,
  CART_CREATED_EVENT,
  CART_CUSTOMER_ASSOCIATED_EVENT,
  CART_LINE_ITEM_ADDED_EVENT,
  CART_LINE_ITEM_UPDATED_EVENT,
  CART_TOTALS_UPDATED_EVENT,
  CartService,
} from "../services";

export const cartExtensionPoints = {
  checkoutPreparationSteps: "cart.checkout-preparation-steps",
  lineItemValidators: "cart.line-item-validators",
  totalSnapshotContributors: "cart.total-snapshot-contributors",
} as const;

export const cartModule = defineCommerceModule({
  contributions: {
    adminSurfaces: cartAdminSurfaces,
    apiFragments: [cartApiFragment],
    eventTypes: [
      CART_CREATED_EVENT,
      CART_LINE_ITEM_ADDED_EVENT,
      CART_LINE_ITEM_UPDATED_EVENT,
      CART_CUSTOMER_ASSOCIATED_EVENT,
      CART_CHECKOUT_REFERENCE_SET_EVENT,
      CART_ADJUSTMENT_APPLIED_EVENT,
      CART_TOTALS_UPDATED_EVENT,
    ],
    permissions: cartPermissionList,
    workflowSteps: [
      {
        name: "cart.prepare-checkout",
        run: () =>
          Effect.succeed({
            output: {
              contract: "cart.prepareCheckout",
            },
          }),
      },
    ],
  },
  dependencies: [
    "customer",
    "fulfillment",
    "inventory",
    "payment",
    "pricing",
    "product",
    "promotion",
    "region-sales-channel",
    "store",
    "tax",
  ],
  key: "cart",
  providedServices: [{ key: "cart-service", service: CartService }],
  schema: {
    tables: ["cart", "cart_line_item", "cart_adjustment"],
  },
});
