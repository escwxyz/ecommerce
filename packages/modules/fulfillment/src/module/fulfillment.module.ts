import { defineCommerceModule } from "@ecommerce/core";
import { Effect } from "effect";

import { fulfillmentAdminSurfaces } from "../admin";
import { fulfillmentPermissionList } from "../permissions";
import { fulfillmentApiFragment } from "../router";
import {
  FULFILLMENT_CANCELED_EVENT,
  FULFILLMENT_CREATED_EVENT,
  FULFILLMENT_SET_CREATED_EVENT,
  FulfillmentService,
  SHIPMENT_TRACKED_EVENT,
  SHIPPING_OPTION_CREATED_EVENT,
} from "../services";

export const fulfillmentExtensionPoints = {
  providerRegistered: "fulfillment.provider-registered",
  rateResolved: "fulfillment.rate-resolved",
  shipmentTracked: "fulfillment.shipment-tracked",
} as const;

export const fulfillmentModule = defineCommerceModule({
  contributions: {
    adminSurfaces: fulfillmentAdminSurfaces,
    apiFragments: [fulfillmentApiFragment],
    eventTypes: [
      FULFILLMENT_SET_CREATED_EVENT,
      SHIPPING_OPTION_CREATED_EVENT,
      FULFILLMENT_CREATED_EVENT,
      FULFILLMENT_CANCELED_EVENT,
      SHIPMENT_TRACKED_EVENT,
    ],
    permissions: fulfillmentPermissionList,
    workflowSteps: [
      {
        name: "fulfillment.list-shipping-options",
        run: () => Effect.succeed({ output: null }),
      },
      {
        name: "fulfillment.create",
        run: () => Effect.succeed({ output: null }),
      },
      {
        name: "fulfillment.cancel",
        run: () => Effect.succeed({ output: null }),
      },
      {
        name: "fulfillment.track-shipment",
        run: () => Effect.succeed({ output: null }),
      },
    ],
  },
  key: "fulfillment",
  providedServices: [
    { key: "fulfillment-service", service: FulfillmentService },
  ],
  schema: {
    tables: [
      "fulfillment_provider",
      "fulfillment_set",
      "shipping_profile",
      "service_zone",
      "shipping_option",
      "fulfillment",
      "shipment",
      "return_shipment_link",
    ],
  },
});
