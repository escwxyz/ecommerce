import { createInMemoryPricingRepository } from "../repositories";
import { createPricingService } from "../services";
import type { CreatePricingServiceOptions } from "../services";

export const createTestPricingService = (
  options: Omit<CreatePricingServiceOptions, "repository"> = {}
) =>
  createPricingService({
    ...options,
    repository: createInMemoryPricingRepository(),
  });
