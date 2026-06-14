import type { z } from "zod";

import type {
  FulfillmentAddressSchema,
  FulfillmentLineItemSchema,
  FulfillmentMoneySchema,
} from "../domain";

export type FulfillmentProviderMoney = z.infer<typeof FulfillmentMoneySchema>;
export type FulfillmentProviderAddress = z.infer<
  typeof FulfillmentAddressSchema
>;
export type FulfillmentProviderLineItem = z.infer<
  typeof FulfillmentLineItemSchema
>;

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
  readonly valid: boolean;
  readonly reason?: string;
}

export interface FulfillmentProviderRateInput {
  readonly address?: FulfillmentProviderAddress;
  readonly items?: readonly FulfillmentProviderLineItem[];
  readonly providerServiceId: string;
}

export interface FulfillmentProviderCreateInput {
  readonly address?: FulfillmentProviderAddress;
  readonly idempotencyKey: string;
  readonly items: readonly FulfillmentProviderLineItem[];
  readonly orderId: string;
  readonly providerServiceId: string;
}

export interface FulfillmentProviderCancelInput {
  readonly providerFulfillmentId: string;
  readonly reason?: string;
}

export interface FulfillmentProviderTrackInput {
  readonly providerFulfillmentId: string;
}

export interface FulfillmentProvider {
  readonly id: string;
  createFulfillment(
    input: FulfillmentProviderCreateInput
  ): Promise<FulfillmentProviderFulfillment>;
  cancelFulfillment(input: FulfillmentProviderCancelInput): Promise<void>;
  rate(input: FulfillmentProviderRateInput): Promise<FulfillmentProviderRate>;
  trackShipment(
    input: FulfillmentProviderTrackInput
  ): Promise<FulfillmentProviderShipment | null>;
  validateOption(
    input: FulfillmentProviderRateInput
  ): Promise<FulfillmentProviderValidationResult>;
}

export const defineFulfillmentProvider = <
  const Provider extends FulfillmentProvider,
>(
  provider: Provider
): Provider => provider;
