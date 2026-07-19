import { createResettableInMemoryStoreRepository } from "../repositories";
import { createStoreService } from "../services";
import type { CreateStoreServiceOptions } from "../services";

const repository = createResettableInMemoryStoreRepository();

export const createTestStoreService = (
  options: Omit<CreateStoreServiceOptions, "repository"> = {}
) =>
  createStoreService({
    ...options,
    repository,
  });

export const resetStoreState = (): void => {
  repository.clear();
};
