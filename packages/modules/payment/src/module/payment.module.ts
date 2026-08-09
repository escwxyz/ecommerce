import { defineCommerceModule } from "@ecommerce/core";
import { Effect } from "effect";

import { paymentAdminSurfaces } from "../admin";
import { paymentPermissionList } from "../permissions";
import {
  PAYMENT_AUTHORIZED_EVENT,
  PAYMENT_CANCELED_EVENT,
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
    apiFragments: [],
    eventTypes: [
      PAYMENT_COLLECTION_CREATED_EVENT,
      PAYMENT_SESSION_CREATED_EVENT,
      PAYMENT_AUTHORIZED_EVENT,
      PAYMENT_CANCELED_EVENT,
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
        name: "payment.cancel-authorization",
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
  schema: { tables: [] },
});
