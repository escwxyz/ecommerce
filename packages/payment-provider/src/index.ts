import { Effect } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

export type PaymentProviderCapability =
  | "customers"
  | "payment-methods"
  | "checkout-sessions"
  | "payment-intents"
  | "captures"
  | "refunds"
  | "subscriptions"
  | "invoices"
  | "webhooks";

export interface PaymentProviderMoney {
  readonly amount: number;
  readonly currencyCode: string;
}

export interface PaymentProviderCorrelationContext {
  readonly causationId?: string;
  readonly operationId?: string;
  readonly parentSpanId?: string;
  readonly requestId: string;
  readonly sampled?: boolean;
  readonly traceId?: string;
}

export interface PaymentProviderCustomer {
  readonly email?: string;
  readonly id: string;
  readonly metadata?: Record<string, unknown>;
  readonly name?: string;
  readonly providerId: string;
}

export interface CreatePaymentProviderCustomerInput {
  readonly correlation?: PaymentProviderCorrelationContext;
  readonly email?: string;
  readonly metadata?: Record<string, unknown>;
  readonly name?: string;
}

export interface PaymentProviderPaymentMethod {
  readonly customerId?: string;
  readonly displayName?: string;
  readonly id: string;
  readonly metadata?: Record<string, unknown>;
  readonly providerId: string;
  readonly reusable: boolean;
  readonly type: string;
}

export interface AttachPaymentProviderMethodInput {
  readonly correlation?: PaymentProviderCorrelationContext;
  readonly customerId: string;
  readonly providerPaymentMethodId: string;
}

export type PaymentProviderCheckoutMode = "payment" | "setup" | "subscription";

export interface CreatePaymentProviderCheckoutSessionInput {
  readonly amount?: PaymentProviderMoney;
  readonly cancelUrl: string;
  readonly customerId?: string;
  readonly correlation?: PaymentProviderCorrelationContext;
  readonly idempotencyKey: string;
  readonly metadata?: Record<string, unknown>;
  readonly mode: PaymentProviderCheckoutMode;
  readonly successUrl: string;
}

export interface PaymentProviderCheckoutSession {
  readonly customerId?: string;
  readonly id: string;
  readonly metadata?: Record<string, unknown>;
  readonly mode: PaymentProviderCheckoutMode;
  readonly paymentIntentId?: string;
  readonly providerId: string;
  readonly status: "open" | "completed" | "expired";
  readonly subscriptionId?: string;
  readonly url?: string;
}

export interface CreatePaymentProviderIntentInput {
  readonly amount: PaymentProviderMoney;
  readonly correlation?: PaymentProviderCorrelationContext;
  readonly captureMethod?: "automatic" | "manual";
  readonly customerId?: string;
  readonly idempotencyKey: string;
  readonly metadata?: Record<string, unknown>;
  readonly paymentMethodId?: string;
}

export interface PaymentProviderIntent {
  readonly amount: PaymentProviderMoney;
  readonly customerId?: string;
  readonly id: string;
  readonly metadata?: Record<string, unknown>;
  readonly paymentMethodId?: string;
  readonly providerId: string;
  readonly status:
    | "authorized"
    | "canceled"
    | "captured"
    | "failed"
    | "requires-confirmation"
    | "requires-payment-method";
}

export interface CapturePaymentProviderIntentInput {
  readonly amount?: PaymentProviderMoney;
  readonly correlation?: PaymentProviderCorrelationContext;
  readonly idempotencyKey: string;
  readonly paymentIntentId: string;
}

export interface RefundPaymentProviderInput {
  readonly amount?: PaymentProviderMoney;
  readonly correlation?: PaymentProviderCorrelationContext;
  readonly idempotencyKey: string;
  readonly paymentIntentId: string;
  readonly reason?: string;
}

export interface PaymentProviderRefund {
  readonly amount: PaymentProviderMoney;
  readonly id: string;
  readonly paymentIntentId: string;
  readonly providerId: string;
  readonly reason?: string;
  readonly status: "pending" | "succeeded" | "failed" | "canceled";
}

export interface CreatePaymentProviderSubscriptionInput {
  readonly correlation?: PaymentProviderCorrelationContext;
  readonly customerId: string;
  readonly idempotencyKey: string;
  readonly metadata?: Record<string, unknown>;
  readonly priceId: string;
}

export interface PaymentProviderSubscription {
  readonly currentPeriodEnd?: Date;
  readonly customerId: string;
  readonly id: string;
  readonly metadata?: Record<string, unknown>;
  readonly providerId: string;
  readonly status:
    | "active"
    | "canceled"
    | "incomplete"
    | "past-due"
    | "trialing";
}

export interface PaymentProviderInvoice {
  readonly amountDue: PaymentProviderMoney;
  readonly customerId?: string;
  readonly id: string;
  readonly metadata?: Record<string, unknown>;
  readonly providerId: string;
  readonly status: "draft" | "open" | "paid" | "void" | "uncollectible";
  readonly subscriptionId?: string;
}

export type PaymentProviderEventType =
  | "checkout.completed"
  | "payment_method.attached"
  | "payment.authorized"
  | "payment.captured"
  | "payment.failed"
  | "refund.succeeded"
  | "subscription.updated"
  | "subscription.deleted"
  | "invoice.updated";

export interface PaymentProviderEventBase<
  Type extends PaymentProviderEventType,
> {
  readonly id: string;
  readonly idempotencyKey?: string;
  readonly occurredAt: Date;
  readonly providerId: string;
  readonly raw?: unknown;
  readonly type: Type;
}

export interface CheckoutCompletedPaymentEvent extends PaymentProviderEventBase<"checkout.completed"> {
  readonly checkoutSession: PaymentProviderCheckoutSession;
}

export interface PaymentMethodAttachedEvent extends PaymentProviderEventBase<"payment_method.attached"> {
  readonly paymentMethod: PaymentProviderPaymentMethod;
}

export interface PaymentIntentEvent extends PaymentProviderEventBase<
  "payment.authorized" | "payment.captured" | "payment.failed"
> {
  readonly paymentIntent: PaymentProviderIntent;
}

export interface RefundSucceededEvent extends PaymentProviderEventBase<"refund.succeeded"> {
  readonly refund: PaymentProviderRefund;
}

export interface SubscriptionPaymentEvent extends PaymentProviderEventBase<
  "subscription.updated" | "subscription.deleted"
> {
  readonly subscription: PaymentProviderSubscription;
}

export interface InvoiceUpdatedEvent extends PaymentProviderEventBase<"invoice.updated"> {
  readonly invoice: PaymentProviderInvoice;
}

export type PaymentProviderEvent =
  | CheckoutCompletedPaymentEvent
  | InvoiceUpdatedEvent
  | PaymentIntentEvent
  | PaymentMethodAttachedEvent
  | RefundSucceededEvent
  | SubscriptionPaymentEvent;

export interface PaymentProviderWebhookInput {
  readonly correlation?: PaymentProviderCorrelationContext;
  readonly headers: Readonly<Record<string, string>>;
  readonly payload: string | Uint8Array;
}

export interface PaymentProviderWebhookResult {
  readonly events: readonly PaymentProviderEvent[];
}

export interface PaymentProviderFailure {
  readonly _tag: "PaymentProviderFailure";
  readonly message: string;
  readonly providerId: string;
}

export type PaymentProviderEffect<T> = EffectValue<T, PaymentProviderFailure>;

/** Runtime-neutral payment provider boundary. Concrete payment SDKs must be adapted behind this Effect contract. */
export interface PaymentProvider {
  readonly attachPaymentMethod: (
    input: AttachPaymentProviderMethodInput
  ) => PaymentProviderEffect<PaymentProviderPaymentMethod>;
  readonly capabilities: readonly PaymentProviderCapability[];
  readonly capturePaymentIntent: (
    input: CapturePaymentProviderIntentInput
  ) => PaymentProviderEffect<PaymentProviderIntent>;
  readonly createCheckoutSession: (
    input: CreatePaymentProviderCheckoutSessionInput
  ) => PaymentProviderEffect<PaymentProviderCheckoutSession>;
  readonly createCustomer: (
    input: CreatePaymentProviderCustomerInput
  ) => PaymentProviderEffect<PaymentProviderCustomer>;
  readonly createPaymentIntent: (
    input: CreatePaymentProviderIntentInput
  ) => PaymentProviderEffect<PaymentProviderIntent>;
  readonly createSubscription?: (
    input: CreatePaymentProviderSubscriptionInput
  ) => PaymentProviderEffect<PaymentProviderSubscription>;
  readonly id: string;
  readonly parseWebhook: (
    input: PaymentProviderWebhookInput
  ) => PaymentProviderEffect<PaymentProviderWebhookResult>;
  readonly refundPayment: (
    input: RefundPaymentProviderInput
  ) => PaymentProviderEffect<PaymentProviderRefund>;
}

export const definePaymentProvider = <const Provider extends PaymentProvider>(
  provider: Provider
): Provider => provider;

type PromisePaymentProvider = Omit<
  PaymentProvider,
  | "attachPaymentMethod"
  | "capturePaymentIntent"
  | "createCheckoutSession"
  | "createCustomer"
  | "createPaymentIntent"
  | "createSubscription"
  | "parseWebhook"
  | "refundPayment"
> & {
  readonly attachPaymentMethod: (
    input: AttachPaymentProviderMethodInput
  ) => Promise<PaymentProviderPaymentMethod>;
  readonly capturePaymentIntent: (
    input: CapturePaymentProviderIntentInput
  ) => Promise<PaymentProviderIntent>;
  readonly createCheckoutSession: (
    input: CreatePaymentProviderCheckoutSessionInput
  ) => Promise<PaymentProviderCheckoutSession>;
  readonly createCustomer: (
    input: CreatePaymentProviderCustomerInput
  ) => Promise<PaymentProviderCustomer>;
  readonly createPaymentIntent: (
    input: CreatePaymentProviderIntentInput
  ) => Promise<PaymentProviderIntent>;
  readonly createSubscription?: (
    input: CreatePaymentProviderSubscriptionInput
  ) => Promise<PaymentProviderSubscription>;
  readonly parseWebhook: (
    input: PaymentProviderWebhookInput
  ) => Promise<PaymentProviderWebhookResult>;
  readonly refundPayment: (
    input: RefundPaymentProviderInput
  ) => Promise<PaymentProviderRefund>;
};

const toProviderFailure = (
  providerId: string,
  operation: string
): PaymentProviderFailure => ({
  _tag: "PaymentProviderFailure",
  message: `Payment provider ${operation} failed.`,
  providerId,
});

/**
 * Temporary bridge for legacy Promise-based payment provider implementations.
 * External provider SDK adapters should migrate to the Effect-native contract directly.
 */
export const createPaymentProviderFromPromiseProvider = (
  provider: PromisePaymentProvider
): PaymentProvider => {
  const { createSubscription } = provider;

  return {
    attachPaymentMethod: (input) =>
      Effect.tryPromise({
        catch: () => toProviderFailure(provider.id, "method attachment"),
        try: () => provider.attachPaymentMethod(input),
      }),
    capabilities: provider.capabilities,
    capturePaymentIntent: (input) =>
      Effect.tryPromise({
        catch: () => toProviderFailure(provider.id, "capture"),
        try: () => provider.capturePaymentIntent(input),
      }),
    createCheckoutSession: (input) =>
      Effect.tryPromise({
        catch: () =>
          toProviderFailure(provider.id, "checkout session creation"),
        try: () => provider.createCheckoutSession(input),
      }),
    createCustomer: (input) =>
      Effect.tryPromise({
        catch: () => toProviderFailure(provider.id, "customer creation"),
        try: () => provider.createCustomer(input),
      }),
    createPaymentIntent: (input) =>
      Effect.tryPromise({
        catch: () => toProviderFailure(provider.id, "payment intent creation"),
        try: () => provider.createPaymentIntent(input),
      }),
    createSubscription: createSubscription
      ? (input) =>
          Effect.tryPromise({
            catch: () =>
              toProviderFailure(provider.id, "subscription creation"),
            try: () => createSubscription(input),
          })
      : undefined,
    id: provider.id,
    parseWebhook: (input) =>
      Effect.tryPromise({
        catch: () => toProviderFailure(provider.id, "webhook parsing"),
        try: () => provider.parseWebhook(input),
      }),
    refundPayment: (input) =>
      Effect.tryPromise({
        catch: () => toProviderFailure(provider.id, "refund"),
        try: () => provider.refundPayment(input),
      }),
  };
};
