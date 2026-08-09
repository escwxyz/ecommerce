import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
} from "@ecommerce/core/testing";

import {
  createResettableInMemoryStoreRepository,
  storeRepositoryTransactionResource,
} from "../repositories";
import { createStoreService } from "../services";
import type { CreateStoreServiceOptions } from "../services";

export const createTestStoreService = (
  options: Omit<
    CreateStoreServiceOptions,
    "outboxWriter" | "repository" | "transactionBoundary"
  > = {}
) => {
  const repository = createResettableInMemoryStoreRepository();
  const outbox = createInMemoryOutbox();
  const transactionBoundary = createInMemoryTransactionBoundary({
    resources: [storeRepositoryTransactionResource(repository), outbox],
  });

  return createStoreService({
    ...options,
    outboxWriter: outbox.writer,
    repository,
    transactionBoundary,
  });
};
