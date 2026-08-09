import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
} from "@ecommerce/core/testing";

import { createFulfillmentProviderRegistry } from "../providers";
import { createFakeFulfillmentProvider } from "../providers/fake-fulfillment-provider";
import { createResettableInMemoryFulfillmentRepository } from "../repositories";
import { createFulfillmentService } from "../services";

export const createFulfillmentTestKit = () => {
  const provider = createFakeFulfillmentProvider();
  const providerRegistry = createFulfillmentProviderRegistry([provider]);
  const repository = createResettableInMemoryFulfillmentRepository();
  const outbox = createInMemoryOutbox();
  const service = createFulfillmentService({
    outboxWriter: outbox.writer,
    providerRegistry,
    repository,
    transactionBoundary: createInMemoryTransactionBoundary({
      resources: [repository, outbox],
    }),
  });

  return {
    provider,
    providerRegistry,
    repository,
    service,
  };
};
