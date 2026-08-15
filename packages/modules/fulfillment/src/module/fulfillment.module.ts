import {
  ClockService,
  IdGeneratorService,
  OutboxWriterService,
  TransactionBoundaryService,
  defineCommerceModule,
  defineCommerceModuleServiceContribution,
} from "@ecommerce/core";
import { Effect, Layer } from "effect";

import { fulfillmentAdminSurfaces } from "../admin";
import { FulfillmentRepositoryService } from "../domain";
import { fulfillmentPermissionList } from "../permissions";
import { createFulfillmentProviderRegistry } from "../providers";
import {
  FULFILLMENT_CANCELED_EVENT,
  FULFILLMENT_CREATED_EVENT,
  FULFILLMENT_SET_CREATED_EVENT,
  FulfillmentService,
  SHIPMENT_TRACKED_EVENT,
  SHIPPING_OPTION_CREATED_EVENT,
  createFulfillmentService,
} from "../services";

const fulfillmentServiceLayer = Layer.effect(
  FulfillmentService,
  Effect.gen(function* createModuleFulfillmentService() {
    return createFulfillmentService({
      clock: yield* ClockService,
      idGenerator: yield* IdGeneratorService,
      outboxWriter: yield* OutboxWriterService,
      providerRegistry: createFulfillmentProviderRegistry([]),
      repository: yield* FulfillmentRepositoryService,
      transactionBoundary: yield* TransactionBoundaryService,
    });
  })
);

export const fulfillmentExtensionPoints = {
  providerRegistered: "fulfillment.provider-registered",
  rateResolved: "fulfillment.rate-resolved",
  shipmentTracked: "fulfillment.shipment-tracked",
} as const;

export const fulfillmentModule = defineCommerceModule({
  contributions: {
    adminSurfaces: fulfillmentAdminSurfaces,
    eventTypes: [
      FULFILLMENT_SET_CREATED_EVENT,
      SHIPPING_OPTION_CREATED_EVENT,
      FULFILLMENT_CREATED_EVENT,
      FULFILLMENT_CANCELED_EVENT,
      SHIPMENT_TRACKED_EVENT,
    ],
    permissions: fulfillmentPermissionList,
    services: [
      defineCommerceModuleServiceContribution({
        key: "fulfillment:service",
        layer: fulfillmentServiceLayer,
        service: FulfillmentService,
      }),
    ],
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
  dependencies: [],
  key: "fulfillment",
});
