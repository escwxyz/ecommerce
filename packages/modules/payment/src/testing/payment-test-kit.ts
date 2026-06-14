import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";

import {
  createFakePaymentProvider,
  createPaymentProviderRegistry,
} from "../providers";
import { createResettableInMemoryPaymentRepository } from "../repositories";
import { createPaymentService } from "../services";

export const createPaymentTestKit = () => {
  const provider = createFakePaymentProvider({
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  });
  const repository = createResettableInMemoryPaymentRepository();
  const service = createPaymentService({
    clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
    idGenerator: createSequenceIdGenerator([
      "payprov_test",
      "paycol_test",
      "payses_test",
      "pay_test",
      "paycap_test",
      "payref_test",
      "payacct_test",
      "paymtd_test",
    ]),
    providerRegistry: createPaymentProviderRegistry([provider]),
    repository,
  });

  return {
    provider,
    repository,
    service,
  };
};
