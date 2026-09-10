import {
  defineCommerceModule,
  defineCommerceModuleServiceContribution,
} from "@ecommerce/core";
import { Effect } from "effect";

import { customerAdminSurfaces } from "../admin";
import { customerPermissionList } from "../permissions";
import {
  CUSTOMER_AUTH_LINKED_EVENT,
  CUSTOMER_CREATED_EVENT,
  CUSTOMER_UPDATED_EVENT,
  CustomerService,
  createCustomerServiceFromDependenciesLayer,
} from "../services";

export const customerExtensionPoints = {
  paymentIdentity: "customer.payment-identity",
  profileResolved: "customer.profile-resolved",
} as const;

export const customerModule = defineCommerceModule({
  contributions: {
    adminSurfaces: customerAdminSurfaces,
    eventTypes: [
      CUSTOMER_CREATED_EVENT,
      CUSTOMER_UPDATED_EVENT,
      CUSTOMER_AUTH_LINKED_EVENT,
    ],
    permissions: customerPermissionList,
    services: [
      defineCommerceModuleServiceContribution({
        key: "customer:service",
        layer: createCustomerServiceFromDependenciesLayer(),
        service: CustomerService,
      }),
    ],
    workflowSteps: [
      {
        name: "customer.resolve-for-checkout",
        run: () => Effect.succeed({ output: null }),
      },
    ],
  },
  key: "customer",
  schema: {
    tables: [
      "customer",
      "customer_address",
      "customer_group",
      "customer_group_customer",
    ],
  },
});
