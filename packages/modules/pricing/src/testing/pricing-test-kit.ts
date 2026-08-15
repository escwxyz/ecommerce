import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
} from "@ecommerce/core/testing";

import { createResettableInMemoryPricingRepository } from "../repositories";
import { createPricingService } from "../services";
import type { CreatePricingServiceOptions } from "../services";

export const createTestPricingService = (
  options: Omit<
    CreatePricingServiceOptions,
    "outboxWriter" | "repository" | "transactionBoundary"
  > = {}
) => {
  const outbox = createInMemoryOutbox();
  const repository = createResettableInMemoryPricingRepository();

  return createPricingService({
    ...options,
    outboxWriter: outbox.writer,
    repository,
    transactionBoundary: createInMemoryTransactionBoundary({
      resources: [repository, outbox],
    }),
  });
};
