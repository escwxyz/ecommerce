import { createFulfillmentProviderRegistry } from "../providers";
import { createFakeFulfillmentProvider } from "../providers/fake-fulfillment-provider";
import { createResettableInMemoryFulfillmentRepository } from "../repositories";
import { createFulfillmentService } from "../services";

export const createFulfillmentTestKit = () => {
  const provider = createFakeFulfillmentProvider();
  const providerRegistry = createFulfillmentProviderRegistry([provider]);
  const repository = createResettableInMemoryFulfillmentRepository();
  const service = createFulfillmentService({
    providerRegistry,
    repository,
  });

  return {
    provider,
    providerRegistry,
    repository,
    service,
  };
};
