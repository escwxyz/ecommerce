import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  createPaymentAccountHolderId,
  createPaymentCaptureId,
  createPaymentCollectionId,
  createPaymentId,
  createPaymentMethodId,
  createPaymentProviderRecordId,
  createPaymentRefundId,
  createPaymentSessionId,
  type Payment,
  type PaymentAccountHolder,
  type PaymentCapture,
  type PaymentCollection,
  type PaymentMethod,
  type PaymentProviderRecord,
  type PaymentRefund,
  type PaymentRepository,
  type PaymentSession,
} from "../domain";
import { createInMemoryPaymentRepository } from "../repositories";

const now = new Date("2026-01-01T00:00:00.000Z");
const collectionId = createPaymentCollectionId("paycol_contract");
const sessionId = createPaymentSessionId("payses_contract");
const paymentId = createPaymentId("pay_contract");

const runPaymentRepositoryContract = (
  name: string,
  createRepository: () => PaymentRepository
) => {
  describe(name, () => {
    it("saves and reads payment-owned records", async () => {
      const repository = createRepository();
      const providerRecord: PaymentProviderRecord = {
        createdAt: now,
        id: createPaymentProviderRecordId("payprov_contract"),
        isEnabled: true,
        providerKey: "fake",
        providerRecordId: "fake",
        updatedAt: now,
      };
      const accountHolder: PaymentAccountHolder = {
        createdAt: now,
        customerId: "cus_contract",
        email: "ada@example.com",
        id: createPaymentAccountHolderId("payacct_contract"),
        metadata: {},
        providerAccountHolderId: "fake_customer",
        providerKey: "fake",
        updatedAt: now,
      };
      const method: PaymentMethod = {
        accountHolderId: accountHolder.id,
        createdAt: now,
        displayName: "Visa",
        id: createPaymentMethodId("paymtd_contract"),
        metadata: {},
        providerKey: "fake",
        providerPaymentMethodId: "pm_contract",
        reusable: true,
        type: "card",
        updatedAt: now,
      };
      const collection: PaymentCollection = {
        amount: 1200,
        cartId: "cart_contract",
        createdAt: now,
        currencyCode: "USD",
        id: collectionId,
        metadata: {},
        status: "pending",
        updatedAt: now,
      };
      const session: PaymentSession = {
        amount: 1200,
        collectionId,
        createdAt: now,
        currencyCode: "USD",
        id: sessionId,
        metadata: {},
        providerKey: "fake",
        providerPaymentIntentId: "intent_contract",
        status: "authorized",
        updatedAt: now,
      };
      const payment: Payment = {
        amount: 1200,
        collectionId,
        createdAt: now,
        currencyCode: "USD",
        id: paymentId,
        metadata: {},
        providerKey: "fake",
        providerPaymentIntentId: "intent_contract",
        sessionId,
        status: "authorized",
        updatedAt: now,
      };
      const capture: PaymentCapture = {
        amount: 1200,
        createdAt: now,
        currencyCode: "USD",
        id: createPaymentCaptureId("paycap_contract"),
        idempotencyKey: "capture_contract",
        paymentId,
        providerCaptureId: "intent_contract",
        status: "succeeded",
      };
      const refund: PaymentRefund = {
        amount: 1200,
        createdAt: now,
        currencyCode: "USD",
        id: createPaymentRefundId("payref_contract"),
        idempotencyKey: "refund_contract",
        paymentId,
        providerRefundId: "refund_contract",
        reason: "customer-request",
        status: "succeeded",
      };

      await Effect.runPromise(repository.saveProviderRecord(providerRecord));
      await Effect.runPromise(repository.saveAccountHolder(accountHolder));
      await Effect.runPromise(repository.saveMethod(method));
      await Effect.runPromise(repository.saveCollection(collection));
      await Effect.runPromise(repository.saveSession(session));
      await Effect.runPromise(repository.savePayment(payment));
      await Effect.runPromise(repository.saveCapture(capture));
      await Effect.runPromise(repository.saveRefund(refund));

      await expect(
        Effect.runPromise(repository.findAccountHolderById(accountHolder.id))
      ).resolves.toEqual(accountHolder);
      await expect(
        Effect.runPromise(
          repository.findAccountHolderByProviderId({
            providerAccountHolderId: "fake_customer",
            providerKey: "fake",
          })
        )
      ).resolves.toEqual(accountHolder);
      await expect(
        Effect.runPromise(repository.findMethodById(method.id))
      ).resolves.toEqual(method);
      await expect(
        Effect.runPromise(repository.findCollectionById(collection.id))
      ).resolves.toEqual(collection);
      await expect(
        Effect.runPromise(repository.findSessionById(session.id))
      ).resolves.toEqual(session);
      await expect(
        Effect.runPromise(
          repository.findSessionByProviderIntent({
            providerKey: "fake",
            providerPaymentIntentId: "intent_contract",
          })
        )
      ).resolves.toEqual(session);
      await expect(
        Effect.runPromise(repository.findPaymentById(payment.id))
      ).resolves.toEqual(payment);
      await expect(
        Effect.runPromise(
          repository.findCaptureByIdempotencyKey("capture_contract")
        )
      ).resolves.toEqual(capture);
      await expect(
        Effect.runPromise(
          repository.findRefundByIdempotencyKey("refund_contract")
        )
      ).resolves.toEqual(refund);
      await expect(
        Effect.runPromise(repository.listCollections)
      ).resolves.toEqual([collection]);
    });
  });
};

runPaymentRepositoryContract("in-memory payment repository", () =>
  createInMemoryPaymentRepository()
);
