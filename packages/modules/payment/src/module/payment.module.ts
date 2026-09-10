import {
  ClockService,
  IdGeneratorService,
  defineCommerceModule,
  defineCommerceModuleServiceContribution,
} from "@ecommerce/core";
import { Effect, Layer } from "effect";

import { paymentAdminSurfaces } from "../admin";
import { PaymentRepositoryService } from "../domain";
import { paymentPermissionList } from "../permissions";
import { PaymentProviderRegistryService } from "../providers";
import {
  PAYMENT_AUTHORIZED_EVENT,
  PAYMENT_CANCELED_EVENT,
  PAYMENT_CAPTURED_EVENT,
  PAYMENT_COLLECTION_CREATED_EVENT,
  PAYMENT_REFUNDED_EVENT,
  PAYMENT_SESSION_CREATED_EVENT,
  PAYMENT_WEBHOOK_APPLIED_EVENT,
  PaymentService,
  createPaymentService,
} from "../services";

const paymentServiceLayer = Layer.effect(
  PaymentService,
  Effect.gen(function* createModulePaymentService() {
    return createPaymentService({
      clock: yield* ClockService,
      idGenerator: yield* IdGeneratorService,
      providerRegistry: yield* PaymentProviderRegistryService,
      repository: yield* PaymentRepositoryService,
    });
  })
);

export const paymentExtensionPoints = {
  providerRegistered: "payment.provider-registered",
  webhookActionMapped: "payment.webhook-action-mapped",
} as const;

export const paymentModule = defineCommerceModule({
  contributions: {
    adminSurfaces: paymentAdminSurfaces,
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
    services: [
      defineCommerceModuleServiceContribution({
        key: "payment:service",
        layer: paymentServiceLayer,
        service: PaymentService,
      }),
    ],
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
  schema: { tables: [] },
});
