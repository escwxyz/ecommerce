import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";

import { createInMemoryCustomerRepository } from "../repositories";
import { createCustomerService } from "../services";

export const createTestCustomerService = () =>
  createCustomerService({
    clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
    idGenerator: createSequenceIdGenerator([
      "cust_test",
      "caddr_test",
      "cgrp_test",
    ]),
    repository: createInMemoryCustomerRepository(),
  });
