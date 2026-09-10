import {
  defineCommerceModule,
  defineCommerceModuleServiceContribution,
} from "@ecommerce/core";

import { orderAdminSurfaces } from "../admin";
import { orderPermissionList } from "../permissions";
import {
  ORDER_PLACED_EVENT,
  ORDER_STATUS_TRANSITIONED_EVENT,
  ORDER_TRANSACTION_RECORDED_EVENT,
  OrderService,
  orderServiceFromRepositoryLayer,
} from "../services";
import { createOrderFromCheckoutWorkflowStep } from "../workflows";

export const orderExtensionPoints = {
  postPurchaseOperationHandlers: "order.post-purchase-operation-handlers",
  statusTransitionValidators: "order.status-transition-validators",
  transactionRecorders: "order.transaction-recorders",
} as const;

export const orderModule = defineCommerceModule({
  contributions: {
    adminSurfaces: orderAdminSurfaces,
    eventTypes: [
      ORDER_PLACED_EVENT,
      ORDER_STATUS_TRANSITIONED_EVENT,
      ORDER_TRANSACTION_RECORDED_EVENT,
    ],
    permissions: orderPermissionList,
    services: [
      defineCommerceModuleServiceContribution({
        key: "order:service",
        layer: orderServiceFromRepositoryLayer,
        service: OrderService,
      }),
    ],
    workflowSteps: [createOrderFromCheckoutWorkflowStep],
  },
  dependencies: [
    "cart",
    "customer",
    "fulfillment",
    "inventory",
    "payment",
    "pricing",
    "product",
    "promotion",
    "region-sales-channel",
    "store",
    "tax",
  ],
  key: "order",
  schema: {
    tables: [
      "order_record",
      "order_line_item",
      "order_transaction",
      "order_state_transition",
      "order_post_purchase_operation",
    ],
  },
});
