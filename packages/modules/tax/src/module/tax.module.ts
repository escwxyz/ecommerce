import {
  ClockService,
  IdGeneratorService,
  OutboxWriterService,
  TransactionBoundaryService,
  defineCommerceModule,
  defineCommerceModuleServiceContribution,
} from "@ecommerce/core";
import { Effect, Layer } from "effect";

import { taxAdminSurfaces } from "../admin";
import { TaxRepositoryService } from "../domain";
import { taxPermissionList } from "../permissions";
import { manualTaxProvider } from "../providers";
import {
  TAX_CATEGORY_CREATED_EVENT,
  TAX_PROVIDER_CONFIGURED_EVENT,
  TAX_RATE_CREATED_EVENT,
  TAX_REGION_CREATED_EVENT,
  TaxService,
  createTaxService,
} from "../services";

const taxServiceLayer = Layer.effect(
  TaxService,
  Effect.gen(function* createModuleTaxService() {
    return createTaxService({
      clock: yield* ClockService,
      idGenerator: yield* IdGeneratorService,
      outboxWriter: yield* OutboxWriterService,
      providers: [manualTaxProvider],
      repository: yield* TaxRepositoryService,
      transactionBoundary: yield* TransactionBoundaryService,
    });
  })
);

export const taxExtensionPoints = {
  providerCalculators: "tax.provider-calculators",
  rateResolvers: "tax.rate-resolvers",
  taxLineConsumers: "tax.tax-line-consumers",
} as const;

export const taxModule = defineCommerceModule({
  contributions: {
    adminSurfaces: taxAdminSurfaces,
    eventTypes: [
      TAX_CATEGORY_CREATED_EVENT,
      TAX_PROVIDER_CONFIGURED_EVENT,
      TAX_REGION_CREATED_EVENT,
      TAX_RATE_CREATED_EVENT,
    ],
    permissions: taxPermissionList,
    services: [
      defineCommerceModuleServiceContribution({
        key: "tax:service",
        layer: taxServiceLayer,
        service: TaxService,
      }),
    ],
  },
  dependencies: [],
  key: "tax",
});
