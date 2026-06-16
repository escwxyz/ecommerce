import type { z } from "zod";

import type {
  CreateOrderFromCheckoutInputSchema,
  CreateOrderLineItemInputSchema,
  OrderAddressSnapshotSchema,
  OrderAggregateApiSchema,
  OrderAggregateSchema,
  OrderApiListSchema,
  OrderApiRecordSchema,
  OrderFulfillmentReferenceSchema,
  OrderIdentifierSchema,
  OrderItemSnapshotSchema,
  OrderLineItemApiRecordSchema,
  OrderLineItemRecordSchema,
  OrderPaymentReferenceSchema,
  OrderPostPurchaseOperationRecordSchema,
  OrderRecordSchema,
  OrderStateTransitionRecordSchema,
  OrderStatusSchema,
  OrderTotalsSnapshotSchema,
  OrderTransactionApiRecordSchema,
  OrderTransactionRecordSchema,
  OrderTransactionTypeSchema,
  RecordOrderTransactionInputSchema,
  TransitionOrderStatusInputSchema,
} from "./order.schema";

export type OrderAddressSnapshot = z.infer<typeof OrderAddressSnapshotSchema>;
export type OrderTotalsSnapshot = z.infer<typeof OrderTotalsSnapshotSchema>;
export type OrderItemSnapshot = z.infer<typeof OrderItemSnapshotSchema>;
export type OrderPaymentReference = z.infer<typeof OrderPaymentReferenceSchema>;
export type OrderFulfillmentReference = z.infer<
  typeof OrderFulfillmentReferenceSchema
>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderTransactionType = z.infer<typeof OrderTransactionTypeSchema>;
export type OrderRecord = z.infer<typeof OrderRecordSchema>;
export type OrderLineItemRecord = z.infer<typeof OrderLineItemRecordSchema>;
export type OrderTransactionRecord = z.infer<
  typeof OrderTransactionRecordSchema
>;
export type OrderStateTransitionRecord = z.infer<
  typeof OrderStateTransitionRecordSchema
>;
export type OrderPostPurchaseOperationRecord = z.infer<
  typeof OrderPostPurchaseOperationRecordSchema
>;
export type OrderAggregate = z.infer<typeof OrderAggregateSchema>;
export type CreateOrderLineItemInput = z.infer<
  typeof CreateOrderLineItemInputSchema
>;
export type CreateOrderFromCheckoutInput = z.infer<
  typeof CreateOrderFromCheckoutInputSchema
>;
export type TransitionOrderStatusInput = z.infer<
  typeof TransitionOrderStatusInputSchema
>;
export type RecordOrderTransactionInput = z.infer<
  typeof RecordOrderTransactionInputSchema
>;
export type OrderIdentifierInput = z.infer<typeof OrderIdentifierSchema>;
export type OrderApiRecord = z.infer<typeof OrderApiRecordSchema>;
export type OrderLineItemApiRecord = z.infer<
  typeof OrderLineItemApiRecordSchema
>;
export type OrderTransactionApiRecord = z.infer<
  typeof OrderTransactionApiRecordSchema
>;
export type OrderAggregateApiRecord = z.infer<typeof OrderAggregateApiSchema>;
export type OrderApiList = z.infer<typeof OrderApiListSchema>;

export interface OrderRepository {
  findOrderById(orderId: string): Promise<OrderRecord | null>;
  findOrderByIdempotencyKey(
    idempotencyKey: string
  ): Promise<OrderRecord | null>;
  getOrderAggregate(orderId: string): Promise<OrderAggregate | null>;
  listOrders(): Promise<readonly OrderRecord[]>;
  saveOrderAggregate(
    aggregate: OrderAggregate,
    idempotencyKey: string
  ): Promise<OrderAggregate>;
  saveOrderTransaction(
    transaction: OrderTransactionRecord,
    idempotencyKey: string
  ): Promise<OrderTransactionRecord>;
  saveStateTransition(
    transition: OrderStateTransitionRecord,
    idempotencyKey: string
  ): Promise<OrderStateTransitionRecord>;
  updateOrder(order: OrderRecord): Promise<OrderRecord>;
}
