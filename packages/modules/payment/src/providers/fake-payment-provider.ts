import { definePaymentProvider } from "@ecommerce/payment-provider";
import type {
  PaymentProvider,
  PaymentProviderEvent,
  PaymentProviderWebhookResult,
} from "@ecommerce/payment-provider";
import { Effect } from "effect";

export interface FakePaymentProviderOptions {
  readonly id?: string;
  readonly now?: () => Date;
}

export interface FakePaymentProvider extends PaymentProvider {
  queueWebhookEvent(event: PaymentProviderEvent): void;
}

const defaultNow = () => new Date();

export const createFakePaymentProvider = ({
  id = "fake",
  now = defaultNow,
}: FakePaymentProviderOptions = {}): FakePaymentProvider => {
  let nextSequence = 1;
  const queuedWebhookEvents: PaymentProviderEvent[] = [];
  const nextId = (prefix: string) => {
    const value = `${id}_${prefix}_${nextSequence}`;
    nextSequence += 1;
    return value;
  };

  return definePaymentProvider({
    id,
    capabilities: [
      "customers",
      "payment-methods",
      "checkout-sessions",
      "payment-intents",
      "captures",
      "cancellations",
      "refunds",
      "webhooks",
    ],
    attachPaymentMethod: (input) =>
      Effect.succeed({
        customerId: input.customerId,
        displayName: "Fake card",
        id: nextId("method"),
        providerId: id,
        reusable: true,
        type: "card",
      }),
    cancelPaymentIntent: (input) =>
      Effect.succeed({
        amount: { amount: 0, currencyCode: "USD" },
        id: input.paymentIntentId,
        providerId: id,
        status: "canceled",
      }),
    capturePaymentIntent: (input) =>
      Effect.succeed({
        amount: input.amount ?? { amount: 0, currencyCode: "USD" },
        id: input.paymentIntentId,
        providerId: id,
        status: "captured",
      }),
    createCheckoutSession: (input) =>
      Effect.succeed({
        amount: input.amount,
        customerId: input.customerId,
        id: nextId("checkout"),
        metadata: input.metadata,
        mode: input.mode,
        paymentIntentId: nextId("intent"),
        providerId: id,
        status: "open",
        url: `https://payments.example/${id}/checkout`,
      }),
    createCustomer: (input) =>
      Effect.succeed({
        email: input.email,
        id: nextId("customer"),
        metadata: input.metadata,
        name: input.name,
        providerId: id,
      }),
    createPaymentIntent: (input) =>
      Effect.succeed({
        amount: input.amount,
        customerId: input.customerId,
        id: nextId("intent"),
        metadata: input.metadata,
        paymentMethodId: input.paymentMethodId,
        providerId: id,
        status: input.captureMethod === "automatic" ? "captured" : "authorized",
      }),
    parseWebhook: (): Effect.Effect<PaymentProviderWebhookResult> =>
      Effect.succeed({
        events: queuedWebhookEvents.splice(0),
      }),
    queueWebhookEvent: (event) => {
      queuedWebhookEvents.push({
        ...event,
        occurredAt: event.occurredAt ?? now(),
      });
    },
    refundPayment: (input) =>
      Effect.succeed({
        amount: input.amount ?? { amount: 0, currencyCode: "USD" },
        id: nextId("refund"),
        paymentIntentId: input.paymentIntentId,
        providerId: id,
        reason: input.reason,
        status: "succeeded",
      }),
  });
};
