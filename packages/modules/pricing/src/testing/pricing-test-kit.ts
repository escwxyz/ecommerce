import { defaultPricingRepository } from "../repositories";
import { createPricingService } from "../services";
import type { CreatePricingServiceOptions } from "../services";

export const resetPricingState = (): void => {
  defaultPricingRepository.clear();
};

export const createTestPricingService = (
  options: CreatePricingServiceOptions = {}
) => createPricingService(options);
