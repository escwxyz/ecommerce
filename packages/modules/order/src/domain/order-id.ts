import { Effect, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import { OrderInvalidIdentifier } from "./order.errors";
import {
  OrderIdSchema,
  OrderLineItemIdSchema,
  OrderTransactionIdSchema,
} from "./order.schema";
import type { OrderId, OrderLineItemId, OrderTransactionId } from "./order.types";

export type { OrderId, OrderLineItemId, OrderTransactionId } from "./order.types";

export const ORDER_ID_PREFIX = "ord_" as const;
export const ORDER_LINE_ITEM_ID_PREFIX = "ordli_" as const;
export const ORDER_TRANSACTION_ID_PREFIX = "ordtxn_" as const;

const toOrderInvalidIdentifier = (
  value: string,
  expectedPrefix: string
): OrderInvalidIdentifier =>
  new OrderInvalidIdentifier({
    expectedPrefix,
    value,
  });

export const createOrderIdEffect = (
  value: string
): EffectValue<OrderId, OrderInvalidIdentifier> =>
  Schema.decodeUnknownEffect(OrderIdSchema)(value).pipe(
    Effect.mapError(() => toOrderInvalidIdentifier(value, ORDER_ID_PREFIX))
  );

export const createOrderLineItemIdEffect = (
  value: string
): EffectValue<OrderLineItemId, OrderInvalidIdentifier> =>
  Schema.decodeUnknownEffect(OrderLineItemIdSchema)(value).pipe(
    Effect.mapError(() =>
      toOrderInvalidIdentifier(value, ORDER_LINE_ITEM_ID_PREFIX)
    )
  );

export const createOrderTransactionIdEffect = (
  value: string
): EffectValue<OrderTransactionId, OrderInvalidIdentifier> =>
  Schema.decodeUnknownEffect(OrderTransactionIdSchema)(value).pipe(
    Effect.mapError(() =>
      toOrderInvalidIdentifier(value, ORDER_TRANSACTION_ID_PREFIX)
    )
  );

export const createOrderId = (value: string): OrderId =>
  Schema.decodeUnknownSync(OrderIdSchema)(value);
export const createOrderLineItemId = (value: string): OrderLineItemId =>
  Schema.decodeUnknownSync(OrderLineItemIdSchema)(value);
export const createOrderTransactionId = (value: string): OrderTransactionId =>
  Schema.decodeUnknownSync(OrderTransactionIdSchema)(value);

export const serializeOrderId = (id: OrderId): string => id;
export const serializeOrderLineItemId = (id: OrderLineItemId): string => id;
export const serializeOrderTransactionId = (id: OrderTransactionId): string =>
  id;
