import type { PaymentProvider } from "@ecommerce/payment-provider";
import { Context } from "effect";

export interface PaymentProviderRegistry {
  getProvider(providerKey: string): PaymentProvider | null;
  listProviders(): readonly PaymentProvider[];
}

/** Host-provided payment integrations available to the payment module. */
export const PaymentProviderRegistryService =
  Context.Service<PaymentProviderRegistry>(
    "@ecommerce/payment/PaymentProviderRegistryService"
  );

export const createPaymentProviderRegistry = (
  providers: readonly PaymentProvider[]
): PaymentProviderRegistry => {
  const providersByKey = new Map<string, PaymentProvider>();

  for (const provider of providers) {
    providersByKey.set(provider.id, provider);
  }

  return {
    getProvider: (providerKey) => providersByKey.get(providerKey) ?? null,
    listProviders: () => [...providersByKey.values()],
  };
};

export const emptyPaymentProviderRegistry = createPaymentProviderRegistry([]);
