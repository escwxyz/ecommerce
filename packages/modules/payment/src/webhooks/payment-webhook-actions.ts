import type { PaymentProviderEvent } from "@ecommerce/payment-provider";

export type PaymentWebhookAction =
  | {
      readonly idempotencyKey?: string;
      readonly paymentIntentId: string;
      readonly providerKey: string;
      readonly type:
        | "payment.authorized"
        | "payment.captured"
        | "payment.failed";
    }
  | {
      readonly idempotencyKey?: string;
      readonly paymentIntentId: string;
      readonly providerKey: string;
      readonly refundId: string;
      readonly type: "refund.succeeded";
    }
  | {
      readonly checkoutSessionId: string;
      readonly idempotencyKey?: string;
      readonly paymentIntentId?: string;
      readonly providerKey: string;
      readonly type: "checkout.completed";
    }
  | {
      readonly idempotencyKey?: string;
      readonly providerKey: string;
      readonly type: "ignored";
    };

export interface PaymentWebhookActionResult {
  readonly actions: readonly PaymentWebhookAction[];
}

export const mapProviderEventToPaymentAction = (
  event: PaymentProviderEvent
): PaymentWebhookAction => {
  if (
    event.type === "payment.authorized" ||
    event.type === "payment.captured" ||
    event.type === "payment.failed"
  ) {
    return {
      idempotencyKey: event.idempotencyKey,
      paymentIntentId: event.paymentIntent.id,
      providerKey: event.providerId,
      type: event.type,
    };
  }

  if (event.type === "refund.succeeded") {
    return {
      idempotencyKey: event.idempotencyKey,
      paymentIntentId: event.refund.paymentIntentId,
      providerKey: event.providerId,
      refundId: event.refund.id,
      type: event.type,
    };
  }

  if (event.type === "checkout.completed") {
    return {
      checkoutSessionId: event.checkoutSession.id,
      idempotencyKey: event.idempotencyKey,
      paymentIntentId: event.checkoutSession.paymentIntentId,
      providerKey: event.providerId,
      type: event.type,
    };
  }

  return {
    idempotencyKey: event.idempotencyKey,
    providerKey: event.providerId,
    type: "ignored",
  };
};

export const mapProviderEventsToPaymentActions = (
  events: readonly PaymentProviderEvent[]
): PaymentWebhookActionResult => ({
  actions: events.map(mapProviderEventToPaymentAction),
});
