import type { Effect as EffectValue } from "effect/Effect";

import type { OrderExpectedError } from "./order.errors";
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
  OrderLineItemIdSchema,
  OrderLineItemRecordSchema,
  OrderMetadataSchema,
  OrderPaymentReferenceSchema,
  OrderPostPurchaseOperationRecordSchema,
  OrderRecordSchema,
  OrderStateTransitionRecordSchema,
  OrderStatusSchema,
  OrderTotalsSnapshotSchema,
  OrderTransactionApiRecordSchema,
  OrderTransactionIdSchema,
  OrderTransactionRecordSchema,
  OrderTransactionTypeSchema,
  OrderIdSchema,
  RecordOrderTransactionInputSchema,
  TransitionOrderStatusInputSchema,
} from "./order.schema";

export type OrderId = typeof OrderIdSchema.Type;
export type OrderLineItemId = typeof OrderLineItemIdSchema.Type;
export type OrderTransactionId = typeof OrderTransactionIdSchema.Type;
export type OrderMetadata = typeof OrderMetadataSchema.Type;
export type OrderAddressSnapshot = typeof OrderAddressSnapshotSchema.Type;
export type OrderTotalsSnapshot = typeof OrderTotalsSnapshotSchema.Type;
export type OrderItemSnapshot = typeof OrderItemSnapshotSchema.Type;
export type OrderPaymentReference = typeof OrderPaymentReferenceSchema.Type;
export type OrderFulfillmentReference =
  typeof OrderFulfillmentReferenceSchema.Type;
export type OrderStatus = typeof OrderStatusSchema.Type;
export type OrderTransactionType = typeof OrderTransactionTypeSchema.Type;
export type OrderRecord = typeof OrderRecordSchema.Type;
export type OrderLineItemRecord = typeof OrderLineItemRecordSchema.Type;
export type OrderTransactionRecord = typeof OrderTransactionRecordSchema.Type;
export type OrderStateTransitionRecord =
  typeof OrderStateTransitionRecordSchema.Type;
export type OrderPostPurchaseOperationRecord =
  typeof OrderPostPurchaseOperationRecordSchema.Type;
export type OrderAggregate = typeof OrderAggregateSchema.Type;
export type CreateOrderLineItemInput =
  typeof CreateOrderLineItemInputSchema.Type;
export type CreateOrderFromCheckoutInput =
  typeof CreateOrderFromCheckoutInputSchema.Type;
export type TransitionOrderStatusInput =
  typeof TransitionOrderStatusInputSchema.Type;
export type RecordOrderTransactionInput =
  typeof RecordOrderTransactionInputSchema.Type;
export type OrderIdentifierInput = typeof OrderIdentifierSchema.Type;
export type OrderApiRecord = typeof OrderApiRecordSchema.Type;
export type OrderLineItemApiRecord = typeof OrderLineItemApiRecordSchema.Type;
export type OrderTransactionApiRecord =
  typeof OrderTransactionApiRecordSchema.Type;
export type OrderAggregateApiRecord = typeof OrderAggregateApiSchema.Type;
export type OrderApiList = typeof OrderApiListSchema.Type;

export interface OrderRepository {
  readonly findOrderById: (
    orderId: OrderId
  ) => EffectValue<OrderRecord | null, OrderExpectedError>;
  readonly findOrderByIdempotencyKey: (
    idempotencyKey: string
  ) => EffectValue<OrderRecord | null, OrderExpectedError>;
  readonly findStateTransitionByIdempotencyKey: (
    idempotencyKey: string
  ) => EffectValue<OrderStateTransitionRecord | null, OrderExpectedError>;
  readonly getOrderAggregate: (
    orderId: OrderId
  ) => EffectValue<OrderAggregate | null, OrderExpectedError>;
  readonly listOrders: EffectValue<readonly OrderRecord[], OrderExpectedError>;
  readonly saveOrderAggregate: (
    aggregate: OrderAggregate,
    idempotencyKey: string
  ) => EffectValue<OrderAggregate, OrderExpectedError>;
  readonly saveOrderTransaction: (
    transaction: OrderTransactionRecord,
    idempotencyKey: string
  ) => EffectValue<OrderTransactionRecord, OrderExpectedError>;
  readonly saveStateTransition: (
    transition: OrderStateTransitionRecord,
    idempotencyKey: string
  ) => EffectValue<OrderStateTransitionRecord, OrderExpectedError>;
  readonly updateOrder: (
    order: OrderRecord
  ) => EffectValue<OrderRecord, OrderExpectedError>;
}
