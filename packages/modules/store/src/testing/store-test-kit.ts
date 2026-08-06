import { createResettableInMemoryStoreRepository } from "../repositories";
import { createStoreService } from "../services";
import type { CreateStoreServiceOptions } from "../services";

export const createTestStoreService = (
  options: Omit<CreateStoreServiceOptions, "repository"> = {}
) =>
  createStoreService({
    ...options,
    repository: createResettableInMemoryStoreRepository(),
  });
