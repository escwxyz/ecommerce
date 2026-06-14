import { definePaymentProvider } from "@ecommerce/payment-provider";
import type {
  PaymentProvider,
  PaymentProviderEvent,
  PaymentProviderIntent,
  PaymentProviderRefund,
  PaymentProviderWebhookResult,
} from "@ecommerce/payment-provider";

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
      "refunds",
      "webhooks",
    ],
    attachPaymentMethod: (input) =>
      Promise.resolve({
        customerId: input.customerId,
        displayName: "Fake card",
        id: nextId("method"),
        providerId: id,
        reusable: true,
        type: "card",
      }),
    capturePaymentIntent: (input): Promise<PaymentProviderIntent> =>
      Promise.resolve({
        amount: input.amount ?? { amount: 0, currencyCode: "USD" },
        id: input.paymentIntentId,
        providerId: id,
        status: "captured",
      }),
    createCheckoutSession: (input) =>
      Promise.resolve({
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
      Promise.resolve({
        email: input.email,
        id: nextId("customer"),
        metadata: input.metadata,
        name: input.name,
        providerId: id,
      }),
    createPaymentIntent: (input) =>
      Promise.resolve({
        amount: input.amount,
        customerId: input.customerId,
        id: nextId("intent"),
        metadata: input.metadata,
        paymentMethodId: input.paymentMethodId,
        providerId: id,
        status: input.captureMethod === "automatic" ? "captured" : "authorized",
      }),
    parseWebhook: (): Promise<PaymentProviderWebhookResult> =>
      Promise.resolve({
        events: queuedWebhookEvents.splice(0),
      }),
    queueWebhookEvent: (event) => {
      queuedWebhookEvents.push({
        ...event,
        occurredAt: event.occurredAt ?? now(),
      });
    },
    refundPayment: (input): Promise<PaymentProviderRefund> =>
      Promise.resolve({
        amount: input.amount ?? { amount: 0, currencyCode: "USD" },
        id: nextId("refund"),
        paymentIntentId: input.paymentIntentId,
        providerId: id,
        reason: input.reason,
        status: "succeeded",
      }),
  });
};
