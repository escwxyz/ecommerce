import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";

import { createResettableInMemoryRegionSalesChannelRepository } from "../repositories";
import { createRegionService, createSalesChannelService } from "../services";

export const createTestRegionSalesChannelServices = () => {
  const repository = createResettableInMemoryRegionSalesChannelRepository();
  const clock = createStaticClock(new Date("2026-01-01T00:00:00.000Z"));

  return {
    regionService: createRegionService({
      clock,
      idGenerator: createSequenceIdGenerator(["reg_1", "evt_reg_1"]),
      repository,
    }),
    repository,
    salesChannelService: createSalesChannelService({
      clock,
      idGenerator: createSequenceIdGenerator(["sc_1", "evt_sc_1"]),
      repository,
    }),
  };
};

export const resetRegionSalesChannelState = (): void => {
  // Test helpers create isolated repositories; retained for API symmetry.
};
