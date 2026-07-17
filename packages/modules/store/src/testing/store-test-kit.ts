import {
  createResettableInMemoryStoreRepository,
  createStoreLegacyRepositoryFromRepository,
} from "../repositories";
import { createStorePromiseService } from "../services";
import type { CreateStorePromiseServiceOptions } from "../services";

const repository = createResettableInMemoryStoreRepository();

export const createTestStoreService = (
  options: Omit<CreateStorePromiseServiceOptions, "repository"> = {}
) =>
  createStorePromiseService({
    ...options,
    repository: createStoreLegacyRepositoryFromRepository(repository),
  });

export const resetStoreState = (): void => {
  repository.clear();
};
