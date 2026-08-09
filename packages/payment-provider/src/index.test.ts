import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import { definePaymentProvider } from "./index";
import type { PaymentProviderEvent } from "./index";

describe("payment provider foundation", () => {
  it("normalizes provider operations without exposing concrete SDKs", async () => {
    const provider = definePaymentProvider({
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
      id: "fake-provider",
      attachPaymentMethod: (input) =>
        Effect.succeed({
          customerId: input.customerId,
          displayName: "Visa ending 4242",
          id: "pm_1",
          providerId: "fake-provider",
          reusable: true,
          type: "card",
        }),
      capturePaymentIntent: (input) =>
        Effect.succeed({
          amount: input.amount ?? {
            amount: 1000,
            currencyCode: "USD",
          },
          id: input.paymentIntentId,
          providerId: "fake-provider",
          status: "captured",
        }),
      cancelPaymentIntent: (input) =>
        Effect.succeed({
          amount: {
            amount: 1000,
            currencyCode: "USD",
          },
          id: input.paymentIntentId,
          providerId: "fake-provider",
          status: "canceled",
        }),
      createCheckoutSession: (input) =>
        Effect.succeed({
          customerId: input.customerId,
          id: "checkout_1",
          metadata: input.metadata,
          mode: input.mode,
          paymentIntentId: "pi_1",
          providerId: "fake-provider",
          status: "open",
          url: "https://pay.example.test/checkout_1",
        }),
      createCustomer: (input) =>
        Effect.succeed({
          email: input.email,
          id: "cus_1",
          metadata: input.metadata,
          name: input.name,
          providerId: "fake-provider",
        }),
      createPaymentIntent: (input) =>
        Effect.succeed({
          amount: input.amount,
          customerId: input.customerId,
          id: "pi_1",
          paymentMethodId: input.paymentMethodId,
          providerId: "fake-provider",
          status: "authorized",
        }),
      parseWebhook: (_input) =>
        Effect.succeed({
          events: [
            {
              checkoutSession: {
                id: "checkout_1",
                mode: "payment",
                paymentIntentId: "pi_1",
                providerId: "fake-provider",
                status: "completed",
              },
              id: "evt_checkout_1",
              idempotencyKey: "checkout:checkout_1",
              occurredAt: new Date("2026-06-06T00:00:00.000Z"),
              providerId: "fake-provider",
              type: "checkout.completed",
            },
          ] satisfies readonly PaymentProviderEvent[],
        }),
      refundPayment: (input) =>
        Effect.succeed({
          amount: input.amount ?? {
            amount: 1000,
            currencyCode: "USD",
          },
          id: "refund_1",
          paymentIntentId: input.paymentIntentId,
          providerId: "fake-provider",
          reason: input.reason,
          status: "succeeded",
        }),
    });

    const customer = await Effect.runPromise(
      provider.createCustomer({
        email: "customer@example.test",
        name: "Ada Customer",
      })
    );
    const intent = await Effect.runPromise(
      provider.createPaymentIntent({
        amount: {
          amount: 1000,
          currencyCode: "USD",
        },
        customerId: customer.id,
        idempotencyKey: "intent:cart_1",
      })
    );
    const canceledIntent = await Effect.runPromise(
      provider.cancelPaymentIntent({
        idempotencyKey: "checkout_1:payment:cancel-authorization",
        paymentIntentId: intent.id,
      })
    );
    const webhook = await Effect.runPromise(
      provider.parseWebhook({
        headers: {
          "x-provider-signature": "test",
        },
        payload: "{}",
      })
    );

    expect(provider.capabilities).toContain("refunds");
    expect(canceledIntent).toMatchObject({
      id: "pi_1",
      status: "canceled",
    });
    expect(intent).toMatchObject({
      customerId: "cus_1",
      providerId: "fake-provider",
      status: "authorized",
    });
    expect(webhook.events[0]).toMatchObject({
      idempotencyKey: "checkout:checkout_1",
      providerId: "fake-provider",
      type: "checkout.completed",
    });
  });
});
