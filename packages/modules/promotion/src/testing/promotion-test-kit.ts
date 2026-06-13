import { createResettableInMemoryPromotionRepository } from '../repositories';
import type { ResettablePromotionRepository } from '../repositories';
import { createPromotionService } from "../services";
import type {
  CreatePromotionServiceOptions,
  PromotionServiceShape,
} from "../services";

export interface PromotionTestKit {
  readonly repository: ResettablePromotionRepository;
  readonly service: PromotionServiceShape;
}

export const createPromotionTestKit = (
  options: Omit<CreatePromotionServiceOptions, "repository"> = {}
): PromotionTestKit => {
  const repository = createResettableInMemoryPromotionRepository();

  return {
    repository,
    service: createPromotionService({
      ...options,
      repository,
    }),
  };
};
