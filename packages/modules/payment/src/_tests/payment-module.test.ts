import { describe, expect, it } from "bun:test";

import { call } from "@orpc/server";

import {
  createPaymentCollectionId,
  createPaymentId,
  createPaymentRouteFragment,
  mapProviderEventToPaymentAction,
  paymentModule,
} from "../index";
import { createPaymentTestKit } from "../testing";

const createAllowedContext = () =>
  ({
    context: {
      auth: {},
      authorization: {
        evaluatePermission: () => ({ allowed: true as const }),
      },
      session: {
        session: {
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          expiresAt: new Date("2026-01-02T00:00:00.000Z"),
          id: "session_1",
          token: "token_1",
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          userId: "user_1",
        },
        user: {
          banned: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          email: "ada@example.com",
          emailVerified: true,
          id: "user_1",
          name: "Ada Lovelace",
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
    },
  }) as const;

describe("payment module", () => {
  it("declares payment-owned schema, events, workflow steps, API, and admin metadata", () => {
    const { contributions } = paymentModule;

    if (!contributions) {
      throw new Error("Payment module contributions are required.");
    }

    expect(paymentModule.key).toBe("payment");
    expect(paymentModule.schema?.tables).toContain("payment_collection");
    expect(contributions.eventTypes).toContain("payment.authorized");
    expect(contributions.workflowSteps?.map((step) => step.name)).toEqual(
      expect.arrayContaining(["payment.authorize-session", "payment.capture"])
    );
    expect(contributions.apiFragments?.[0]?.key).toBe("module:payment");
    expect(contributions.adminSurfaces?.[0]?.label).toBe("Payments");
  });

  it("runs collection, session, authorization, capture, and refund operations through a fake provider", async () => {
    const { service } = createPaymentTestKit();
    await service.registerProvider("fake");

    const collection = await service.createCollection({
      amount: 1200,
      cartId: "cart_1",
      currencyCode: "usd",
    });
    const session = await service.createSession({
      collectionId: collection.id,
      idempotencyKey: "session_1",
      providerKey: "fake",
    });
    const payment = await service.authorizePaymentSession({
      idempotencyKey: "authorize_1",
      sessionId: session.id,
    });
    const capture = await service.capturePayment({
      idempotencyKey: "capture_1",
      paymentId: payment.id,
    });
    const duplicateCapture = await service.capturePayment({
      idempotencyKey: "capture_1",
      paymentId: payment.id,
    });
    const refund = await service.refundPayment({
      idempotencyKey: "refund_1",
      paymentId: payment.id,
      reason: "customer-request",
    });

    expect(collection.currencyCode).toBe("USD");
    expect(payment.status).toBe("authorized");
    expect(capture.status).toBe("succeeded");
    expect(duplicateCapture.id).toBe(capture.id);
    expect(refund.status).toBe("succeeded");
  });

  it("rejects capture amounts above the authorized payment amount", async () => {
    const { repository, service } = createPaymentTestKit();
    await service.registerProvider("fake");

    const collection = await service.createCollection({
      amount: 1200,
      cartId: "cart_overcapture",
      currencyCode: "usd",
    });
    const session = await service.createSession({
      collectionId: collection.id,
      idempotencyKey: "session_overcapture",
      providerKey: "fake",
    });
    const payment = await service.authorizePaymentSession({
      idempotencyKey: "authorize_overcapture",
      sessionId: session.id,
    });

    await expect(
      service.capturePayment({
        amount: 1300,
        idempotencyKey: "capture_overcapture",
        paymentId: payment.id,
      })
    ).rejects.toThrow(
      "Capture amount 1300 exceeds authorized payment amount 1200."
    );

    await expect(
      repository.findCaptureByIdempotencyKey("capture_overcapture")
    ).resolves.toBeNull();
    await expect(repository.findPaymentById(payment.id)).resolves.toMatchObject(
      {
        status: "authorized",
      }
    );
    await expect(
      repository.findCollectionById(collection.id)
    ).resolves.toMatchObject({
      status: "authorized",
    });
  });

  it("rejects refund amounts above the payment amount", async () => {
    const { repository, service } = createPaymentTestKit();
    await service.registerProvider("fake");

    const collection = await service.createCollection({
      amount: 1200,
      cartId: "cart_overrefund",
      currencyCode: "usd",
    });
    const session = await service.createSession({
      collectionId: collection.id,
      idempotencyKey: "session_overrefund",
      providerKey: "fake",
    });
    const payment = await service.authorizePaymentSession({
      idempotencyKey: "authorize_overrefund",
      sessionId: session.id,
    });

    await expect(
      service.refundPayment({
        amount: 1300,
        idempotencyKey: "refund_overrefund",
        paymentId: payment.id,
        reason: "customer-request",
      })
    ).rejects.toThrow("Refund amount 1300 exceeds payment amount 1200.");

    await expect(
      repository.findRefundByIdempotencyKey("refund_overrefund")
    ).resolves.toBeNull();
    await expect(repository.findPaymentById(payment.id)).resolves.toMatchObject(
      {
        status: "authorized",
      }
    );
    await expect(
      repository.findCollectionById(collection.id)
    ).resolves.toMatchObject({
      status: "authorized",
    });
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

    const result = await service.parseProviderWebhook({
      headers: {},
      payload: "{}",
      providerKey: "fake",
    });

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

  it("exposes protected payment API route fragments", async () => {
    const { provider, repository } = createPaymentTestKit();
    const fragment = createPaymentRouteFragment({
      providerRegistry: {
        getProvider: () => provider,
        listProviders: () => [provider],
      },
      repository,
    });
    const context = createAllowedContext();
    const detail = await call(
      fragment.router.paymentCollectionCreate,
      {
        amount: 500,
        currencyCode: "USD",
        metadata: {},
      },
      context
    );
    const session = await call(
      fragment.router.paymentSessionCreate,
      {
        collectionId: detail.id,
        idempotencyKey: "route_session",
        providerKey: "fake",
      },
      context
    );
    const payment = await call(
      fragment.router.paymentAuthorizeSession,
      {
        idempotencyKey: "route_authorize",
        sessionId: session.id,
      },
      context
    );

    expect(detail.id).toStartWith("paycol_");
    expect(payment.collectionId).toBe(detail.id);
    expect(
      await repository.findCollectionById(createPaymentCollectionId(detail.id))
    ).not.toBeNull();
    expect(
      await repository.findPaymentById(createPaymentId(payment.id))
    ).not.toBeNull();
  });
});
