import type { Insertable, Kysely, Selectable } from "kysely";

import type {
  OrderAggregate,
  OrderDatabase,
  OrderLineItemRecord,
  OrderPostPurchaseOperationRecord,
  OrderRecord,
  OrderRepository,
  OrderStateTransitionRecord,
  OrderTransactionRecord,
} from "../../domain";
import {
  createOrderId,
  createOrderLineItemId,
  createOrderTransactionId,
} from "../../domain";

export type OrderD1Database = Kysely<OrderDatabase>;

export interface CreateD1OrderRepositoryOptions {
  readonly db: OrderD1Database;
}

type OrderRow = Selectable<OrderDatabase["order_record"]>;
type OrderLineItemRow = Selectable<OrderDatabase["order_line_item"]>;
type OrderTransactionRow = Selectable<OrderDatabase["order_transaction"]>;
type OrderStateTransitionRow = Selectable<
  OrderDatabase["order_state_transition"]
>;
type OrderOperationRow = Selectable<
  OrderDatabase["order_post_purchase_operation"]
>;

const parseJsonColumn = <Value>(value: string): Value => JSON.parse(value);
const toJsonColumn = (value: unknown): string => JSON.stringify(value);

const toOrder = (row: OrderRow): OrderRecord => ({
  billingAddress: row.billing_address
    ? parseJsonColumn(row.billing_address)
    : null,
  cartId: row.cart_id,
  completedAt: row.completed_at === null ? null : new Date(row.completed_at),
  createdAt: new Date(row.created_at),
  currencyCode: row.currency_code,
  customerId: row.customer_id,
  email: row.email,
  fulfillmentReferences: parseJsonColumn(row.fulfillment_references),
  id: createOrderId(row.id),
  metadata: parseJsonColumn(row.metadata),
  paymentReferences: parseJsonColumn(row.payment_references),
  shippingAddress: row.shipping_address
    ? parseJsonColumn(row.shipping_address)
    : null,
  status: row.status as OrderRecord["status"],
  totals: parseJsonColumn(row.totals),
  updatedAt: new Date(row.updated_at),
});

const toLineItem = (row: OrderLineItemRow): OrderLineItemRecord => ({
  createdAt: new Date(row.created_at),
  id: createOrderLineItemId(row.id),
  itemSnapshot: parseJsonColumn(row.item_snapshot),
  metadata: parseJsonColumn(row.metadata),
  orderId: createOrderId(row.order_id),
  quantity: row.quantity,
  taxTotal: row.tax_total,
  title: row.title,
  total: row.total,
  unitPrice: row.unit_price,
  updatedAt: new Date(row.updated_at),
});

const toTransaction = (row: OrderTransactionRow): OrderTransactionRecord => ({
  amount: row.amount,
  createdAt: new Date(row.created_at),
  currencyCode: row.currency_code,
  id: createOrderTransactionId(row.id),
  metadata: parseJsonColumn(row.metadata),
  orderId: createOrderId(row.order_id),
  referenceId: row.reference_id,
  type: row.type as OrderTransactionRecord["type"],
  updatedAt: new Date(row.updated_at),
});

const toStateTransition = (
  row: OrderStateTransitionRow
): OrderStateTransitionRecord => ({
  changedAt: new Date(row.changed_at),
  fromStatus: row.from_status as OrderStateTransitionRecord["fromStatus"],
  metadata: parseJsonColumn(row.metadata),
  orderId: createOrderId(row.order_id),
  toStatus: row.to_status as OrderStateTransitionRecord["toStatus"],
});

const toOperation = (
  row: OrderOperationRow
): OrderPostPurchaseOperationRecord => ({
  createdAt: new Date(row.created_at),
  id: row.id,
  metadata: parseJsonColumn(row.metadata),
  orderId: createOrderId(row.order_id),
  status: row.status,
  type: row.type as OrderPostPurchaseOperationRecord["type"],
  updatedAt: new Date(row.updated_at),
});

const toOrderInsert = (
  order: OrderRecord,
  idempotencyKey: string
): Insertable<OrderDatabase["order_record"]> => ({
  billing_address: order.billingAddress
    ? toJsonColumn(order.billingAddress)
    : null,
  cart_id: order.cartId,
  completed_at: order.completedAt?.getTime() ?? null,
  created_at: order.createdAt.getTime(),
  currency_code: order.currencyCode,
  customer_id: order.customerId,
  email: order.email,
  fulfillment_references: toJsonColumn(order.fulfillmentReferences),
  id: order.id,
  idempotency_key: idempotencyKey,
  metadata: toJsonColumn(order.metadata),
  payment_references: toJsonColumn(order.paymentReferences),
  shipping_address: order.shippingAddress
    ? toJsonColumn(order.shippingAddress)
    : null,
  status: order.status,
  totals: toJsonColumn(order.totals),
  updated_at: order.updatedAt.getTime(),
});

const toLineItemInsert = (
  lineItem: OrderLineItemRecord
): Insertable<OrderDatabase["order_line_item"]> => ({
  created_at: lineItem.createdAt.getTime(),
  id: lineItem.id,
  item_snapshot: toJsonColumn(lineItem.itemSnapshot),
  metadata: toJsonColumn(lineItem.metadata),
  order_id: lineItem.orderId,
  quantity: lineItem.quantity,
  tax_total: lineItem.taxTotal,
  title: lineItem.title,
  total: lineItem.total,
  unit_price: lineItem.unitPrice,
  updated_at: lineItem.updatedAt.getTime(),
});

const toTransactionInsert = (
  transaction: OrderTransactionRecord,
  idempotencyKey: string
): Insertable<OrderDatabase["order_transaction"]> => ({
  amount: transaction.amount,
  created_at: transaction.createdAt.getTime(),
  currency_code: transaction.currencyCode,
  id: transaction.id,
  idempotency_key: idempotencyKey,
  metadata: toJsonColumn(transaction.metadata),
  order_id: transaction.orderId,
  reference_id: transaction.referenceId,
  type: transaction.type,
  updated_at: transaction.updatedAt.getTime(),
});

const toTransitionInsert = (
  transition: OrderStateTransitionRecord,
  idempotencyKey: string
): Insertable<OrderDatabase["order_state_transition"]> => ({
  changed_at: transition.changedAt.getTime(),
  from_status: transition.fromStatus,
  idempotency_key: idempotencyKey,
  metadata: toJsonColumn(transition.metadata),
  order_id: transition.orderId,
  to_status: transition.toStatus,
});

const toOperationInsert = (
  operation: OrderPostPurchaseOperationRecord
): Insertable<OrderDatabase["order_post_purchase_operation"]> => ({
  created_at: operation.createdAt.getTime(),
  id: operation.id,
  metadata: toJsonColumn(operation.metadata),
  order_id: operation.orderId,
  status: operation.status,
  type: operation.type,
  updated_at: operation.updatedAt.getTime(),
});

const getOrderAggregate = async (
  db: OrderD1Database,
  orderId: string
): Promise<OrderAggregate | null> => {
  const orderRow = await db
    .selectFrom("order_record")
    .selectAll()
    .where("id", "=", orderId)
    .executeTakeFirst();

  if (!orderRow) {
    return null;
  }

  const [lineItems, transactions, stateTransitions, operations] =
    await Promise.all([
      db
        .selectFrom("order_line_item")
        .selectAll()
        .where("order_id", "=", orderId)
        .orderBy("created_at", "asc")
        .execute(),
      db
        .selectFrom("order_transaction")
        .selectAll()
        .where("order_id", "=", orderId)
        .orderBy("created_at", "asc")
        .execute(),
      db
        .selectFrom("order_state_transition")
        .selectAll()
        .where("order_id", "=", orderId)
        .orderBy("changed_at", "asc")
        .execute(),
      db
        .selectFrom("order_post_purchase_operation")
        .selectAll()
        .where("order_id", "=", orderId)
        .orderBy("created_at", "asc")
        .execute(),
    ]);

  return {
    lineItems: lineItems.map(toLineItem),
    operations: operations.map(toOperation),
    order: toOrder(orderRow),
    stateTransitions: stateTransitions.map(toStateTransition),
    transactions: transactions.map(toTransaction),
  };
};

/**
 * Creates the order-owned D1 persistence adapter used by server composition.
 * Cross-module records remain references or snapshots; this adapter only
 * reads and writes tables owned by the order module.
 */
export const createD1OrderRepository = ({
  db,
}: CreateD1OrderRepositoryOptions): OrderRepository => ({
  findOrderById: async (orderId) => {
    const row = await db
      .selectFrom("order_record")
      .selectAll()
      .where("id", "=", orderId)
      .executeTakeFirst();
    return row ? toOrder(row) : null;
  },
  findOrderByIdempotencyKey: async (idempotencyKey) => {
    const row = await db
      .selectFrom("order_record")
      .selectAll()
      .where("idempotency_key", "=", idempotencyKey)
      .executeTakeFirst();
    return row ? toOrder(row) : null;
  },
  findStateTransitionByIdempotencyKey: async (idempotencyKey) => {
    const row = await db
      .selectFrom("order_state_transition")
      .selectAll()
      .where("idempotency_key", "=", idempotencyKey)
      .executeTakeFirst();
    return row ? toStateTransition(row) : null;
  },
  getOrderAggregate: (orderId) => getOrderAggregate(db, orderId),
  listOrders: async () => {
    const rows = await db
      .selectFrom("order_record")
      .selectAll()
      .orderBy("created_at", "asc")
      .execute();
    return rows.map(toOrder);
  },
  saveOrderAggregate: async (aggregate, idempotencyKey) => {
    const existing = await db
      .selectFrom("order_record")
      .select("id")
      .where("idempotency_key", "=", idempotencyKey)
      .executeTakeFirst();

    if (existing) {
      const stored = await getOrderAggregate(db, existing.id);
      if (!stored) {
        throw new Error(`Order "${existing.id}" was not found.`);
      }
      return stored;
    }

    let insertedOrderRecord = false;

    try {
      await db
        .insertInto("order_record")
        .values(toOrderInsert(aggregate.order, idempotencyKey))
        .execute();
      insertedOrderRecord = true;

      if (aggregate.lineItems.length > 0) {
        await db
          .insertInto("order_line_item")
          .values(aggregate.lineItems.map(toLineItemInsert))
          .execute();
      }

      if (aggregate.transactions.length > 0) {
        await db
          .insertInto("order_transaction")
          .values(
            aggregate.transactions.map((record) =>
              toTransactionInsert(
                record,
                `${idempotencyKey}:transaction:${record.id}`
              )
            )
          )
          .execute();
      }

      if (aggregate.stateTransitions.length > 0) {
        await db
          .insertInto("order_state_transition")
          .values(
            aggregate.stateTransitions.map((record, index) =>
              toTransitionInsert(
                record,
                `${idempotencyKey}:transition:${index}`
              )
            )
          )
          .execute();
      }

      if (aggregate.operations.length > 0) {
        await db
          .insertInto("order_post_purchase_operation")
          .values(aggregate.operations.map(toOperationInsert))
          .execute();
      }
    } catch (error) {
      // kysely-d1 does not expose transactions. Removing the parent record
      // cascades any children written before a failed aggregate operation.
      if (insertedOrderRecord) {
        await db
          .deleteFrom("order_record")
          .where("id", "=", aggregate.order.id)
          .execute();
      }
      throw error;
    }

    const stored = await getOrderAggregate(db, aggregate.order.id);
    if (!stored) {
      throw new Error(`Order "${aggregate.order.id}" was not found.`);
    }
    return stored;
  },
  saveOrderTransaction: async (transaction, idempotencyKey) => {
    const existing = await db
      .selectFrom("order_transaction")
      .selectAll()
      .where("idempotency_key", "=", idempotencyKey)
      .executeTakeFirst();

    if (existing) {
      return toTransaction(existing);
    }

    await db
      .insertInto("order_transaction")
      .values(toTransactionInsert(transaction, idempotencyKey))
      .execute();
    return transaction;
  },
  saveStateTransition: async (transition, idempotencyKey) => {
    const existing = await db
      .selectFrom("order_state_transition")
      .selectAll()
      .where("idempotency_key", "=", idempotencyKey)
      .executeTakeFirst();

    if (existing) {
      return toStateTransition(existing);
    }

    await db
      .insertInto("order_state_transition")
      .values(toTransitionInsert(transition, idempotencyKey))
      .execute();
    return transition;
  },
  updateOrder: async (order) => {
    await db
      .updateTable("order_record")
      .set({
        billing_address: order.billingAddress
          ? toJsonColumn(order.billingAddress)
          : null,
        completed_at: order.completedAt?.getTime() ?? null,
        currency_code: order.currencyCode,
        customer_id: order.customerId,
        email: order.email,
        fulfillment_references: toJsonColumn(order.fulfillmentReferences),
        metadata: toJsonColumn(order.metadata),
        payment_references: toJsonColumn(order.paymentReferences),
        shipping_address: order.shippingAddress
          ? toJsonColumn(order.shippingAddress)
          : null,
        status: order.status,
        totals: toJsonColumn(order.totals),
        updated_at: order.updatedAt.getTime(),
      })
      .where("id", "=", order.id)
      .executeTakeFirstOrThrow();
    return order;
  },
});
