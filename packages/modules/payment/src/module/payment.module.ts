import { defineCommerceModule } from "@ecommerce/core";
import { Effect } from "effect";

import { paymentAdminSurfaces } from "../admin";
import { paymentPermissionList } from "../permissions";
import { paymentApiFragment } from "../router";
import {
  PAYMENT_AUTHORIZED_EVENT,
  PAYMENT_CAPTURED_EVENT,
  PAYMENT_COLLECTION_CREATED_EVENT,
  PAYMENT_REFUNDED_EVENT,
  PAYMENT_SESSION_CREATED_EVENT,
  PAYMENT_WEBHOOK_APPLIED_EVENT,
  PaymentService,
} from "../services";

export const paymentExtensionPoints = {
  providerRegistered: "payment.provider-registered",
  webhookActionMapped: "payment.webhook-action-mapped",
} as const;

export const paymentModule = defineCommerceModule({
  contributions: {
    adminSurfaces: paymentAdminSurfaces,
    apiFragments: [paymentApiFragment],
    eventTypes: [
      PAYMENT_COLLECTION_CREATED_EVENT,
      PAYMENT_SESSION_CREATED_EVENT,
      PAYMENT_AUTHORIZED_EVENT,
      PAYMENT_CAPTURED_EVENT,
      PAYMENT_REFUNDED_EVENT,
      PAYMENT_WEBHOOK_APPLIED_EVENT,
    ],
    permissions: paymentPermissionList,
    workflowSteps: [
      {
        name: "payment.authorize-session",
        run: () => Effect.succeed({ output: null }),
      },
      {
        name: "payment.capture",
        run: () => Effect.succeed({ output: null }),
      },
      {
        name: "payment.refund",
        run: () => Effect.succeed({ output: null }),
      },
    ],
  },
  key: "payment",
  providedServices: [{ key: "payment-service", service: PaymentService }],
  schema: {
    tables: [
      "payment_provider",
      "payment_account_holder",
      "payment_method",
      "payment_collection",
      "payment_session",
      "payment",
      "payment_capture",
      "payment_refund",
    ],
  },
});
