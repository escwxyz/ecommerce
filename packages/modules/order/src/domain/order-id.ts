import { z } from "zod";

export const ORDER_ID_PREFIX = "ord_" as const;
export const ORDER_LINE_ITEM_ID_PREFIX = "ordli_" as const;
export const ORDER_TRANSACTION_ID_PREFIX = "ordtxn_" as const;

export type OrderId = `${typeof ORDER_ID_PREFIX}${string}`;
export type OrderLineItemId = `${typeof ORDER_LINE_ITEM_ID_PREFIX}${string}`;
export type OrderTransactionId =
  `${typeof ORDER_TRANSACTION_ID_PREFIX}${string}`;

const createPrefixedIdFactory =
  <TPrefix extends string>(prefix: TPrefix) =>
  (value: string): `${TPrefix}${string}` => {
    const parsed = z.string().min(1).startsWith(prefix).parse(value);

    return parsed as `${TPrefix}${string}`;
  };

export const createOrderId = createPrefixedIdFactory(ORDER_ID_PREFIX);
export const createOrderLineItemId = createPrefixedIdFactory(
  ORDER_LINE_ITEM_ID_PREFIX
);
export const createOrderTransactionId = createPrefixedIdFactory(
  ORDER_TRANSACTION_ID_PREFIX
);
