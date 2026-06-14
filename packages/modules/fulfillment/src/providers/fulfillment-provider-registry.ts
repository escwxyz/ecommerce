import type { FulfillmentProvider } from "./fulfillment-provider";

export interface FulfillmentProviderRegistry {
  getProvider(providerKey: string): FulfillmentProvider | null;
  listProviders(): readonly FulfillmentProvider[];
}

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
