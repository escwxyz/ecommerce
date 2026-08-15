import type { CorrelationContext } from "@ecommerce/core";
import { Effect } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type {
  FulfillmentAddress,
  FulfillmentExpectedError,
  FulfillmentLineItem,
  FulfillmentProviderMoney,
} from "../domain";
import { FulfillmentValidationFailure } from "../domain";

export const DEFAULT_FULFILLMENT_PROVIDER_CANCELLATION_TIMEOUT_MS = 15_000;

export interface FulfillmentProviderRate {
  readonly amount: FulfillmentProviderMoney;
  readonly providerKey: string;
  readonly providerServiceId: string;
}

export interface FulfillmentProviderShipment {
  readonly carrier?: string;
  readonly labelUrl?: string;
  readonly providerShipmentId: string;
  readonly status: "ready" | "shipped" | "in-transit" | "delivered";
  readonly trackingNumber?: string;
  readonly trackingUrl?: string;
}

export interface FulfillmentProviderFulfillment {
  readonly providerFulfillmentId: string;
  readonly shipment?: FulfillmentProviderShipment;
  readonly status: "created" | "shipped" | "failed";
}

export interface FulfillmentProviderValidationResult {
  readonly reason?: string;
  readonly valid: boolean;
}

export interface FulfillmentProviderRateInput {
  readonly address?: FulfillmentAddress;
  readonly correlation?: CorrelationContext;
  readonly items?: readonly FulfillmentLineItem[];
  readonly providerServiceId: string;
}

export interface FulfillmentProviderCreateInput {
  readonly address?: FulfillmentAddress;
  readonly correlation?: CorrelationContext;
  readonly idempotencyKey: string;
  readonly items: readonly FulfillmentLineItem[];
  readonly orderId: string;
  readonly providerServiceId: string;
}

export interface FulfillmentProviderCancelInput {
  readonly correlation?: CorrelationContext;
  /** Stable identity that providers must use to deduplicate cancellation retries. */
  readonly idempotencyKey: string;
  readonly providerFulfillmentId: string;
  readonly reason?: string;
}

export interface FulfillmentProviderTrackInput {
  readonly correlation?: CorrelationContext;
  readonly providerFulfillmentId: string;
}

/** Runtime-neutral fulfillment provider boundary. Concrete carrier SDKs must be adapted behind this Effect contract. */
export interface FulfillmentProvider {
  readonly cancelFulfillment: (
    input: FulfillmentProviderCancelInput
  ) => EffectValue<void, FulfillmentExpectedError>;
  readonly createFulfillment: (
    input: FulfillmentProviderCreateInput
  ) => EffectValue<FulfillmentProviderFulfillment, FulfillmentExpectedError>;
  readonly id: string;
  readonly rate: (
    input: FulfillmentProviderRateInput
  ) => EffectValue<FulfillmentProviderRate, FulfillmentExpectedError>;
  readonly trackShipment: (
    input: FulfillmentProviderTrackInput
  ) => EffectValue<
    FulfillmentProviderShipment | null,
    FulfillmentExpectedError
  >;
  readonly validateOption: (
    input: FulfillmentProviderRateInput
  ) => EffectValue<
    FulfillmentProviderValidationResult,
    FulfillmentExpectedError
  >;
}

export const defineFulfillmentProvider = <
  const Provider extends FulfillmentProvider,
>(
  provider: Provider
): Provider => provider;

const providerCancellationTimeoutFailure = (timeoutMs: number) =>
  new FulfillmentValidationFailure({
    message: `Fulfillment provider cancellation timed out after ${timeoutMs}ms.`,
  });

const withProviderCancellationTimeout = (
  effect: EffectValue<void, FulfillmentExpectedError>,
  timeoutMs: number
) =>
  effect.pipe(
    Effect.timeoutOrElse({
      duration: `${timeoutMs} millis`,
      orElse: () => Effect.fail(providerCancellationTimeoutFailure(timeoutMs)),
    })
  );

/**
 * Temporary bridge for legacy Promise-based provider implementations while
 * external carrier integrations migrate behind the Effect provider contract.
 */
export const createFulfillmentProviderFromPromiseProvider = (
  provider: {
    readonly cancelFulfillment: (
      input: FulfillmentProviderCancelInput
    ) => Promise<void>;
    readonly createFulfillment: (
      input: FulfillmentProviderCreateInput
    ) => Promise<FulfillmentProviderFulfillment>;
    readonly id: string;
    readonly rate: (
      input: FulfillmentProviderRateInput
    ) => Promise<FulfillmentProviderRate>;
    readonly trackShipment: (
      input: FulfillmentProviderTrackInput
    ) => Promise<FulfillmentProviderShipment | null>;
    readonly validateOption: (
      input: FulfillmentProviderRateInput
    ) => Promise<FulfillmentProviderValidationResult>;
  },
  options: {
    readonly cancellationTimeoutMs?: number;
  } = {}
): FulfillmentProvider => ({
  cancelFulfillment: (input) =>
    withProviderCancellationTimeout(
      Effect.tryPromise({
        catch: () =>
          new FulfillmentValidationFailure({
            message: "Fulfillment provider cancellation failed.",
          }),
        try: () => provider.cancelFulfillment(input),
      }),
      options.cancellationTimeoutMs ??
        DEFAULT_FULFILLMENT_PROVIDER_CANCELLATION_TIMEOUT_MS
    ),
  createFulfillment: (input) =>
    Effect.tryPromise({
      catch: () =>
        new FulfillmentValidationFailure({
          message: "Fulfillment provider creation failed.",
        }),
      try: () => provider.createFulfillment(input),
    }),
  id: provider.id,
  rate: (input) =>
    Effect.tryPromise({
      catch: () =>
        new FulfillmentValidationFailure({
          message: "Fulfillment provider rating failed.",
        }),
      try: () => provider.rate(input),
    }),
  trackShipment: (input) =>
    Effect.tryPromise({
      catch: () =>
        new FulfillmentValidationFailure({
          message: "Fulfillment provider tracking failed.",
        }),
      try: () => provider.trackShipment(input),
    }),
  validateOption: (input) =>
    Effect.tryPromise({
      catch: () =>
        new FulfillmentValidationFailure({
          message: "Fulfillment provider validation failed.",
        }),
      try: () => provider.validateOption(input),
    }),
});
