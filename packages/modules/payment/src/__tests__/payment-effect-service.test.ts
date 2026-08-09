import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import { createPaymentCollectionId, createPaymentId } from "../domain";
import { createPaymentTestKit } from "../testing";
import { mapProviderEventToPaymentAction } from "../webhooks";

describe("payment Effect service", () => {
  it("runs collection, session, authorization, capture, and refund operations through a fake provider", async () => {
    const { service } = createPaymentTestKit();
    await Effect.runPromise(service.registerProvider("fake"));

    const collection = await Effect.runPromise(
      service.createCollection({
        amount: 1200,
        cartId: "cart_1",
        currencyCode: "usd",
      })
    );
    const session = await Effect.runPromise(
      service.createSession({
        collectionId: collection.id,
        idempotencyKey: "session_1",
        providerKey: "fake",
      })
    );
    const payment = await Effect.runPromise(
      service.authorizePaymentSession({
        idempotencyKey: "authorize_1",
        sessionId: session.id,
      })
    );
    const capture = await Effect.runPromise(
      service.capturePayment({
        idempotencyKey: "capture_1",
        paymentId: payment.id,
      })
    );
    const duplicateCapture = await Effect.runPromise(
      service.capturePayment({
        idempotencyKey: "capture_1",
        paymentId: payment.id,
      })
    );
    const refund = await Effect.runPromise(
      service.refundPayment({
        idempotencyKey: "refund_1",
        paymentId: payment.id,
        reason: "customer-request",
      })
    );

    expect(collection.currencyCode).toBe("USD");
    expect(payment.status).toBe("authorized");
    expect(capture.status).toBe("succeeded");
    expect(duplicateCapture.id).toBe(capture.id);
    expect(refund.status).toBe("succeeded");
  });

  it("rejects capture amounts above the authorized payment amount", async () => {
    const { repository, service } = createPaymentTestKit();
    await Effect.runPromise(service.registerProvider("fake"));
    const collection = await Effect.runPromise(
      service.createCollection({
        amount: 1200,
        cartId: "cart_overcapture",
        currencyCode: "usd",
      })
    );
    const session = await Effect.runPromise(
      service.createSession({
        collectionId: collection.id,
        idempotencyKey: "session_overcapture",
        providerKey: "fake",
      })
    );
    const payment = await Effect.runPromise(
      service.authorizePaymentSession({
        idempotencyKey: "authorize_overcapture",
        sessionId: session.id,
      })
    );

    await expect(
      Effect.runPromise(
        service.capturePayment({
          amount: 1300,
          idempotencyKey: "capture_overcapture",
          paymentId: payment.id,
        })
      )
    ).rejects.toMatchObject({
      _tag: "PaymentValidationFailure",
      message: "Capture amount 1300 exceeds authorized payment amount 1200.",
    });
    await expect(
      Effect.runPromise(
        repository.findPaymentById(createPaymentId(String(payment.id)))
      )
    ).resolves.toMatchObject({ status: "authorized" });
    await expect(
      Effect.runPromise(
        repository.findCollectionById(
          createPaymentCollectionId(String(collection.id))
        )
      )
    ).resolves.toMatchObject({ status: "authorized" });
  });

  it("idempotently cancels an authorized payment through its provider", async () => {
    const { repository, service } = createPaymentTestKit();
    await Effect.runPromise(service.registerProvider("fake"));
    const collection = await Effect.runPromise(
      service.createCollection({
        amount: 1200,
        cartId: "cart_cancel",
        currencyCode: "usd",
      })
    );
    const session = await Effect.runPromise(
      service.createSession({
        collectionId: collection.id,
        idempotencyKey: "session_cancel",
        providerKey: "fake",
      })
    );
    const payment = await Effect.runPromise(
      service.authorizePaymentSession({
        idempotencyKey: "authorize_cancel",
        sessionId: session.id,
      })
    );

    const canceled = await Effect.runPromise(
      service.cancelPayment({
        idempotencyKey: "checkout_1:payment:cancel-authorization",
        paymentId: payment.id,
      })
    );
    const duplicate = await Effect.runPromise(
      service.cancelPayment({
        idempotencyKey: "checkout_1:payment:cancel-authorization",
        paymentId: payment.id,
      })
    );

    expect(canceled.status).toBe("canceled");
    expect(duplicate.id).toBe(canceled.id);
    await expect(
      Effect.runPromise(repository.findCollectionById(collection.id))
    ).resolves.toMatchObject({ status: "canceled" });
  });

  it("maps provider webhook events into normalized payment actions", async () => {
    const { provider, service } = createPaymentTestKit();
    const occurredAt = new Date("2026-01-01T00:00:00.000Z");
    provider.queueWebhookEvent({
      id: "evt_authorized",
      idempotencyKey: "webhook_authorized",
      occurredAt,
      paymentIntent: {
        amount: { amount: 1200, currencyCode: "USD" },
        id: "intent_webhook",
        providerId: "fake",
        status: "authorized",
      },
      providerId: "fake",
      type: "payment.authorized",
    });

    const result = await Effect.runPromise(
      service.parseProviderWebhook({
        headers: {},
        payload: "{}",
        providerKey: "fake",
      })
    );

    expect(result.actions).toEqual([
      {
        idempotencyKey: "webhook_authorized",
        paymentIntentId: "intent_webhook",
        providerKey: "fake",
        type: "payment.authorized",
      },
    ]);
    expect(
      mapProviderEventToPaymentAction({
        checkoutSession: {
          id: "checkout_1",
          mode: "payment",
          paymentIntentId: "intent_1",
          providerId: "fake",
          status: "completed",
        },
        id: "evt_checkout",
        occurredAt,
        providerId: "fake",
        type: "checkout.completed",
      })
    ).toMatchObject({
      checkoutSessionId: "checkout_1",
      paymentIntentId: "intent_1",
      type: "checkout.completed",
    });
  });
});
