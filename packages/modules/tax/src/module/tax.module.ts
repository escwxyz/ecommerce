import { defineCommerceModule } from "@ecommerce/core";

import { taxAdminSurfaces } from "../admin";
import { taxPermissionList } from "../permissions";
import {
  TAX_CALCULATED_EVENT,
  TAX_CATEGORY_CREATED_EVENT,
  TAX_PROVIDER_CONFIGURED_EVENT,
  TAX_RATE_CREATED_EVENT,
  TAX_REGION_CREATED_EVENT,
  TaxService,
} from "../services";

export const taxExtensionPoints = {
  providerCalculators: "tax.provider-calculators",
  rateResolvers: "tax.rate-resolvers",
  taxLineConsumers: "tax.tax-line-consumers",
} as const;

export const taxModule = defineCommerceModule({
  contributions: {
    adminSurfaces: taxAdminSurfaces,
    apiFragments: [],
    eventTypes: [
      TAX_CATEGORY_CREATED_EVENT,
      TAX_PROVIDER_CONFIGURED_EVENT,
      TAX_REGION_CREATED_EVENT,
      TAX_RATE_CREATED_EVENT,
      TAX_CALCULATED_EVENT,
    ],
    permissions: taxPermissionList,
  },
  dependencies: [],
  key: "tax",
  providedServices: [{ key: "tax-service", service: TaxService }],
});
