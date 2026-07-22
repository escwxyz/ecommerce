import type { PaymentProviderEvent } from "@ecommerce/payment-provider";

import type {
  PaymentWebhookAction,
  PaymentWebhookActionResult,
} from "../domain";

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
