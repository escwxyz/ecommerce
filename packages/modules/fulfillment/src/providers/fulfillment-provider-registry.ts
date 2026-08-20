import { Context } from "effect";

import type { FulfillmentProvider } from "./fulfillment-provider";

export interface FulfillmentProviderRegistry {
  getProvider(providerKey: string): FulfillmentProvider | null;
  listProviders(): readonly FulfillmentProvider[];
}

/** Host-provided fulfillment integrations available to the fulfillment module. */
export const FulfillmentProviderRegistryService =
  Context.Service<FulfillmentProviderRegistry>(
    "@ecommerce/fulfillment/FulfillmentProviderRegistryService"
  );

export const createFulfillmentProviderRegistry = (
  providers: readonly FulfillmentProvider[]
): FulfillmentProviderRegistry => {
  const providersByKey = new Map<string, FulfillmentProvider>();

  for (const provider of providers) {
    providersByKey.set(provider.id, provider);
  }

  return {
    getProvider: (providerKey) => providersByKey.get(providerKey) ?? null,
    listProviders: () => [...providersByKey.values()],
  };
};

export const emptyFulfillmentProviderRegistry =
  createFulfillmentProviderRegistry([]);
