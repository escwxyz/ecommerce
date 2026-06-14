import { defineApiContractRoute } from "@ecommerce/module-contracts";
import { z } from "zod";

import {
  AttachPaymentMethodInputSchema,
  AuthorizePaymentSessionInputSchema,
  CapturePaymentInputSchema,
  CreatePaymentAccountHolderInputSchema,
  CreatePaymentCollectionInputSchema,
  CreatePaymentSessionInputSchema,
  PaymentAccountHolderApiSchema,
  PaymentApiSchema,
  PaymentCaptureApiSchema,
  PaymentCollectionDetailApiSchema,
  PaymentListApiSchema,
  PaymentMethodApiSchema,
  PaymentRefundApiSchema,
  PaymentSessionApiSchema,
  RefundPaymentInputSchema,
} from "../domain";

export const PaymentCollectionIdentifierSchema = z.object({
  id: z.string().min(1).startsWith("paycol_"),
});

export const PaymentProviderIdentifierSchema = z.object({
  providerKey: z.string().min(1),
});

export const PaymentWebhookInputSchema = PaymentProviderIdentifierSchema.extend(
  {
    headers: z.record(z.string(), z.string()),
    payload: z.string().min(1),
  }
);

export const PaymentWebhookActionSchema = z.discriminatedUnion("type", [
  z.object({
    idempotencyKey: z.string().min(1).optional(),
    paymentIntentId: z.string().min(1),
    providerKey: z.string().min(1),
    type: z.enum(["payment.authorized", "payment.captured", "payment.failed"]),
  }),
  z.object({
    idempotencyKey: z.string().min(1).optional(),
    paymentIntentId: z.string().min(1),
    providerKey: z.string().min(1),
    refundId: z.string().min(1),
    type: z.literal("refund.succeeded"),
  }),
  z.object({
    checkoutSessionId: z.string().min(1),
    idempotencyKey: z.string().min(1).optional(),
    paymentIntentId: z.string().min(1).optional(),
    providerKey: z.string().min(1),
    type: z.literal("checkout.completed"),
  }),
  z.object({
    idempotencyKey: z.string().min(1).optional(),
    providerKey: z.string().min(1),
    type: z.literal("ignored"),
  }),
]);

export const PaymentWebhookActionResultSchema = z.object({
  actions: z.array(PaymentWebhookActionSchema).readonly(),
});

export const paymentContractRouter = {
  paymentAccountHolderCreate: defineApiContractRoute({
    description:
      "Create a provider-backed payment account holder owned by the payment module.",
    method: "POST",
    operationId: "paymentAccountHolderCreate",
    path: "/payments/account-holders",
    successDescription: "Payment account holder created.",
    summary: "Create payment account holder",
    tags: ["Payments"],
  })
    .input(CreatePaymentAccountHolderInputSchema)
    .output(PaymentAccountHolderApiSchema),
  paymentAuthorizeSession: defineApiContractRoute({
    description:
      "Authorize a payment session through the configured provider adapter.",
    method: "POST",
    operationId: "paymentAuthorizeSession",
    path: "/payments/sessions/{sessionId}/authorize",
    successDescription: "Payment session authorized.",
    summary: "Authorize payment session",
    tags: ["Payments"],
  })
    .input(AuthorizePaymentSessionInputSchema)
    .output(PaymentApiSchema),
  paymentCapture: defineApiContractRoute({
    description: "Capture an authorized ecommerce payment.",
    method: "POST",
    operationId: "paymentCapture",
    path: "/payments/{paymentId}/captures",
    successDescription: "Payment captured.",
    summary: "Capture payment",
    tags: ["Payments"],
  })
    .input(CapturePaymentInputSchema)
    .output(PaymentCaptureApiSchema),
  paymentCollectionCreate: defineApiContractRoute({
    description: "Create a cart-scoped ecommerce payment collection.",
    method: "POST",
    operationId: "paymentCollectionCreate",
    path: "/payments/collections",
    successDescription: "Payment collection created.",
    summary: "Create payment collection",
    tags: ["Payments"],
  })
    .input(CreatePaymentCollectionInputSchema)
    .output(PaymentCollectionDetailApiSchema),
  paymentCollectionGet: defineApiContractRoute({
    description: "Load a payment collection with sessions and payments.",
    method: "GET",
    operationId: "paymentCollectionGet",
    path: "/payments/collections/{id}",
    successDescription: "Payment collection returned.",
    summary: "Get payment collection",
    tags: ["Payments"],
  })
    .input(PaymentCollectionIdentifierSchema)
    .output(PaymentCollectionDetailApiSchema.nullable()),
  paymentCollectionList: defineApiContractRoute({
    description: "List payment collections for admin payment management.",
    method: "GET",
    operationId: "paymentCollectionList",
    path: "/payments/collections",
    successDescription: "Payment collections returned.",
    summary: "List payment collections",
    tags: ["Payments"],
  })
    .input(z.unknown())
    .output(PaymentListApiSchema),
  paymentMethodAttach: defineApiContractRoute({
    description:
      "Attach a provider payment method to a payment account holder.",
    method: "POST",
    operationId: "paymentMethodAttach",
    path: "/payments/account-holders/{accountHolderId}/methods",
    successDescription: "Payment method attached.",
    summary: "Attach payment method",
    tags: ["Payments"],
  })
    .input(AttachPaymentMethodInputSchema)
    .output(PaymentMethodApiSchema),
  paymentRefund: defineApiContractRoute({
    description: "Refund a captured ecommerce payment.",
    method: "POST",
    operationId: "paymentRefund",
    path: "/payments/{paymentId}/refunds",
    successDescription: "Payment refunded.",
    summary: "Refund payment",
    tags: ["Payments"],
  })
    .input(RefundPaymentInputSchema)
    .output(PaymentRefundApiSchema),
  paymentSessionCreate: defineApiContractRoute({
    description:
      "Create or initialize a provider-backed payment session for a collection.",
    method: "POST",
    operationId: "paymentSessionCreate",
    path: "/payments/sessions",
    successDescription: "Payment session created.",
    summary: "Create payment session",
    tags: ["Payments"],
  })
    .input(CreatePaymentSessionInputSchema)
    .output(PaymentSessionApiSchema),
  paymentWebhookParse: defineApiContractRoute({
    description:
      "Parse a provider webhook into normalized payment webhook actions.",
    method: "POST",
    operationId: "paymentWebhookParse",
    path: "/payments/providers/{providerKey}/webhooks/parse",
    successDescription: "Payment webhook actions returned.",
    summary: "Parse payment webhook",
    tags: ["Payments"],
  })
    .input(PaymentWebhookInputSchema)
    .output(PaymentWebhookActionResultSchema),
} as const;
