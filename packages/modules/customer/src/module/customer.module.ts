import { defineCommerceModule } from "@ecommerce/core";
import { Effect } from "effect";

import { customerAdminSurfaces } from "../admin";
import { customerPermissionList } from "../permissions";
import { customerApiFragment } from "../router";
import {
  CUSTOMER_AUTH_LINKED_EVENT,
  CUSTOMER_CREATED_EVENT,
  CUSTOMER_UPDATED_EVENT,
  CustomerService,
} from "../services";

export const customerExtensionPoints = {
  paymentIdentity: "customer.payment-identity",
  profileResolved: "customer.profile-resolved",
} as const;

export const customerModule = defineCommerceModule({
  contributions: {
    adminSurfaces: customerAdminSurfaces,
    apiFragments: [customerApiFragment],
    eventTypes: [
      CUSTOMER_CREATED_EVENT,
      CUSTOMER_UPDATED_EVENT,
      CUSTOMER_AUTH_LINKED_EVENT,
    ],
    permissions: customerPermissionList,
    workflowSteps: [
      {
        name: "customer.resolve-for-checkout",
        run: () => Effect.succeed({ output: null }),
      },
    ],
  },
  key: "customer",
  providedServices: [{ key: "customer-service", service: CustomerService }],
  schema: {
    tables: [
      "customer",
      "customer_address",
      "customer_group",
      "customer_group_customer",
    ],
  },
});
