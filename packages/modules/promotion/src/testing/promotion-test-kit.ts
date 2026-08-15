import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
} from "@ecommerce/core/testing";

import { createResettableInMemoryPromotionRepository } from "../repositories";
import type { ResettablePromotionRepository } from "../repositories";
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
  options: Omit<
    CreatePromotionServiceOptions,
    "outboxWriter" | "repository" | "transactionBoundary"
  > = {}
): PromotionTestKit => {
  const repository = createResettableInMemoryPromotionRepository();
  const outbox = createInMemoryOutbox();

  return {
    repository,
    service: createPromotionService({
      ...options,
      outboxWriter: outbox.writer,
      repository,
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [repository, outbox],
      }),
    }),
  };
};
