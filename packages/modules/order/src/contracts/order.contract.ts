import { defineApiContractRoute } from "@ecommerce/module-contracts";
import { z } from "zod";

import {
  CreateOrderFromCheckoutInputSchema,
  OrderAggregateApiSchema,
  OrderApiListSchema,
  OrderIdentifierSchema,
  OrderTransactionApiRecordSchema,
  RecordOrderTransactionInputSchema,
  TransitionOrderStatusInputSchema,
} from "../domain";

export const orderContractRouter = {
  orderCreateFromCheckout: defineApiContractRoute({
    description:
      "Create an order from checkout workflow outputs without reading private cart, payment, fulfillment, pricing, tax, or inventory repositories.",
    method: "POST",
    operationId: "orderCreateFromCheckout",
    path: "/orders",
    successDescription: "Order created from checkout outputs.",
    summary: "Create order from checkout",
    tags: ["Orders"],
  })
    .input(CreateOrderFromCheckoutInputSchema)
    .output(OrderAggregateApiSchema),
  orderGet: defineApiContractRoute({
    description: "Load a placed order aggregate for admin order management.",
    method: "GET",
    operationId: "orderGet",
    path: "/orders/{id}",
    successDescription: "Order returned.",
    summary: "Get order",
    tags: ["Orders"],
  })
    .input(OrderIdentifierSchema)
    .output(OrderAggregateApiSchema.nullable()),
  orderList: defineApiContractRoute({
    description: "List placed orders for admin order management.",
    method: "GET",
    operationId: "orderList",
    path: "/orders",
    successDescription: "Orders returned.",
    summary: "List orders",
    tags: ["Orders"],
  })
    .input(z.unknown())
    .output(OrderApiListSchema),
  orderRecordTransaction: defineApiContractRoute({
    description:
      "Record an order-owned payment, refund, capture, or adjustment transaction reference.",
    method: "POST",
    operationId: "orderRecordTransaction",
    path: "/orders/{orderId}/transactions",
    successDescription: "Order transaction recorded.",
    summary: "Record order transaction",
    tags: ["Orders"],
  })
    .input(RecordOrderTransactionInputSchema)
    .output(OrderTransactionApiRecordSchema),
  orderTransitionStatus: defineApiContractRoute({
    description: "Transition an order-owned status and publish a domain event.",
    method: "POST",
    operationId: "orderTransitionStatus",
    path: "/orders/{orderId}/status",
    successDescription: "Order status transitioned.",
    summary: "Transition order status",
    tags: ["Orders"],
  })
    .input(TransitionOrderStatusInputSchema)
    .output(OrderAggregateApiSchema),
} as const;
