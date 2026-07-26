import {
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  OrderAggregateSchema,
  OrderLineItemRecordSchema,
  OrderNotFound,
  OrderPostPurchaseOperationRecordSchema,
  OrderRecordSchema,
  OrderRepositoryService,
  OrderStateTransitionRecordSchema,
  OrderTransactionRecordSchema,
  createOrderIdEffect,
  createOrderLineItemIdEffect,
  createOrderTransactionIdEffect,
} from "@ecommerce/order";
import type {
  OrderAggregate,
  OrderExpectedError,
  OrderId,
  OrderLineItemRecord,
  OrderRecord,
  OrderRepository,
  OrderStateTransitionRecord,
  OrderTransactionRecord,
} from "@ecommerce/order";
import { asc, desc, eq } from "drizzle-orm";
import { Effect, Layer, Option, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import type { SqlError } from "effect/unstable/sql/SqlError";

import {
  CurrentPostgresTransactionService,
  PostgresDrizzleService,
} from "../../postgres-drizzle";
import type {
  PostgresDrizzleDatabase,
  PostgresDrizzleService as PostgresDrizzleServiceShape,
  PostgresDrizzleTransaction,
} from "../../postgres-drizzle";
import {
  OrderLineItemPostgresInsertSchema,
  OrderLineItemPostgresRowSchema,
  OrderPostPurchaseOperationPostgresInsertSchema,
  OrderPostPurchaseOperationPostgresRowSchema,
  OrderPostgresInsertSchema,
  OrderPostgresRowSchema,
  OrderStateTransitionPostgresInsertSchema,
  OrderStateTransitionPostgresRowSchema,
  OrderTransactionPostgresInsertSchema,
  OrderTransactionPostgresRowSchema,
  postgresOrder,
  postgresOrderLineItem,
  postgresOrderPostPurchaseOperation,
  postgresOrderStateTransition,
  postgresOrderTransaction,
} from "./schema";
import type {
  OrderLineItemPostgresInsert,
  OrderLineItemPostgresRow,
  OrderPostPurchaseOperationPostgresInsert,
  OrderPostPurchaseOperationPostgresRow,
  OrderPostgresInsert,
  OrderPostgresRow,
  OrderStateTransitionPostgresInsert,
  OrderStateTransitionPostgresRow,
  OrderTransactionPostgresInsert,
  OrderTransactionPostgresRow,
} from "./schema";

type OrderPostgresExecutor =
  | PostgresDrizzleDatabase
  | PostgresDrizzleTransaction;

const orderRepositoryName = "OrderRepository";

const toRepositoryUnavailable =
  (operation: "delete" | "read" | "write") => (): RepositoryUnavailable =>
    new RepositoryUnavailable({
      adapter: "effect-postgres",
      operation,
      repository: orderRepositoryName,
    });

const toRepositoryDecodeFailure = (
  entity:
    | "order"
    | "order-line-item"
    | "order-post-purchase-operation"
    | "order-state-transition"
    | "order-transaction",
  operation: "read" | "write"
): RepositoryDecodeFailure =>
  new RepositoryDecodeFailure({
    entity,
    operation,
    repository: orderRepositoryName,
  });

const getOrderExecutor = (
  service: PostgresDrizzleServiceShape
): EffectValue<OrderPostgresExecutor> =>
  Effect.map(
    Effect.serviceOption(CurrentPostgresTransactionService),
    Option.getOrElse(() => service.database)
  );

export const toOrderPostgresInsert = ({
  idempotencyKey,
  order,
}: {
  readonly idempotencyKey: string;
  readonly order: OrderRecord;
}): EffectValue<OrderPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(OrderPostgresInsertSchema)({
    billingAddressJson: order.billingAddress,
    cartId: order.cartId,
    completedAt: order.completedAt,
    createdAt: order.createdAt,
    currencyCode: order.currencyCode,
    customerId: order.customerId,
    email: order.email,
    fulfillmentReferencesJson: order.fulfillmentReferences,
    id: order.id,
    idempotencyKey,
    metadataJson: order.metadata,
    paymentReferencesJson: order.paymentReferences,
    shippingAddressJson: order.shippingAddress,
    status: order.status,
    totalsJson: order.totals,
    updatedAt: order.updatedAt,
  }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("order", "write")));

export const toOrderLineItemPostgresInsert = (
  item: OrderLineItemRecord
): EffectValue<OrderLineItemPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(OrderLineItemPostgresInsertSchema)({
    createdAt: item.createdAt,
    id: item.id,
    itemSnapshotJson: item.itemSnapshot,
    metadataJson: item.metadata,
    orderId: item.orderId,
    quantity: item.quantity,
    taxTotal: item.taxTotal,
    title: item.title,
    total: item.total,
    unitPrice: item.unitPrice,
    updatedAt: item.updatedAt,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("order-line-item", "write"))
  );

export const toOrderTransactionPostgresInsert = ({
  idempotencyKey,
  transaction,
}: {
  readonly idempotencyKey: string;
  readonly transaction: OrderTransactionRecord;
}): EffectValue<OrderTransactionPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(OrderTransactionPostgresInsertSchema)({
    amount: transaction.amount,
    createdAt: transaction.createdAt,
    currencyCode: transaction.currencyCode,
    id: transaction.id,
    idempotencyKey,
    metadataJson: transaction.metadata,
    orderId: transaction.orderId,
    referenceId: transaction.referenceId,
    type: transaction.type,
    updatedAt: transaction.updatedAt,
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("order-transaction", "write")
    )
  );

export const toOrderStateTransitionPostgresInsert = ({
  idempotencyKey,
  transition,
}: {
  readonly idempotencyKey: string;
  readonly transition: OrderStateTransitionRecord;
}): EffectValue<OrderStateTransitionPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(OrderStateTransitionPostgresInsertSchema)({
    changedAt: transition.changedAt,
    fromStatus: transition.fromStatus,
    idempotencyKey,
    metadataJson: transition.metadata,
    orderId: transition.orderId,
    toStatus: transition.toStatus,
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("order-state-transition", "write")
    )
  );

export const toOrderPostPurchaseOperationPostgresInsert = (
  operation: OrderAggregate["operations"][number]
): EffectValue<
  OrderPostPurchaseOperationPostgresInsert,
  RepositoryDecodeFailure
> =>
  Schema.decodeUnknownEffect(OrderPostPurchaseOperationPostgresInsertSchema)({
    createdAt: operation.createdAt,
    id: operation.id,
    metadataJson: operation.metadata,
    orderId: operation.orderId,
    status: operation.status,
    type: operation.type,
    updatedAt: operation.updatedAt,
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("order-post-purchase-operation", "write")
    )
  );

const toOrderRecord = (
  row: OrderPostgresRow
): EffectValue<OrderRecord, OrderExpectedError> =>
  Effect.gen(function* toOrderRecordEffect() {
    const id = yield* createOrderIdEffect(row.id);

    return yield* Schema.decodeUnknownEffect(OrderRecordSchema)({
      billingAddress: row.billingAddressJson,
      cartId: row.cartId,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      currencyCode: row.currencyCode,
      customerId: row.customerId,
      email: row.email,
      fulfillmentReferences: row.fulfillmentReferencesJson,
      id,
      metadata: row.metadataJson,
      paymentReferences: row.paymentReferencesJson,
      shippingAddress: row.shippingAddressJson,
      status: row.status,
      totals: row.totalsJson,
      updatedAt: row.updatedAt,
    }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("order", "read")));
  });

const toOrderLineItemRecord = (
  row: OrderLineItemPostgresRow
): EffectValue<OrderLineItemRecord, OrderExpectedError> =>
  Effect.gen(function* toOrderLineItemRecordEffect() {
    const id = yield* createOrderLineItemIdEffect(row.id);
    const orderId = yield* createOrderIdEffect(row.orderId);

    return yield* Schema.decodeUnknownEffect(OrderLineItemRecordSchema)({
      createdAt: row.createdAt,
      id,
      itemSnapshot: row.itemSnapshotJson,
      metadata: row.metadataJson,
      orderId,
      quantity: row.quantity,
      taxTotal: row.taxTotal,
      title: row.title,
      total: row.total,
      unitPrice: row.unitPrice,
      updatedAt: row.updatedAt,
    }).pipe(
      Effect.mapError(() =>
        toRepositoryDecodeFailure("order-line-item", "read")
      )
    );
  });

const toOrderTransactionRecord = (
  row: OrderTransactionPostgresRow
): EffectValue<OrderTransactionRecord, OrderExpectedError> =>
  Effect.gen(function* toOrderTransactionRecordEffect() {
    const id = yield* createOrderTransactionIdEffect(row.id);
    const orderId = yield* createOrderIdEffect(row.orderId);

    return yield* Schema.decodeUnknownEffect(OrderTransactionRecordSchema)({
      amount: row.amount,
      createdAt: row.createdAt,
      currencyCode: row.currencyCode,
      id,
      metadata: row.metadataJson,
      orderId,
      referenceId: row.referenceId,
      type: row.type,
      updatedAt: row.updatedAt,
    }).pipe(
      Effect.mapError(() =>
        toRepositoryDecodeFailure("order-transaction", "read")
      )
    );
  });

const toOrderStateTransitionRecord = (
  row: OrderStateTransitionPostgresRow
): EffectValue<OrderStateTransitionRecord, OrderExpectedError> =>
  Effect.gen(function* toOrderStateTransitionRecordEffect() {
    const orderId = yield* createOrderIdEffect(row.orderId);

    return yield* Schema.decodeUnknownEffect(OrderStateTransitionRecordSchema)({
      changedAt: row.changedAt,
      fromStatus: row.fromStatus,
      metadata: row.metadataJson,
      orderId,
      toStatus: row.toStatus,
    }).pipe(
      Effect.mapError(() =>
        toRepositoryDecodeFailure("order-state-transition", "read")
      )
    );
  });

const toOrderPostPurchaseOperationRecord = (
  row: OrderPostPurchaseOperationPostgresRow
): EffectValue<OrderAggregate["operations"][number], OrderExpectedError> =>
  Effect.gen(function* toOrderPostPurchaseOperationRecordEffect() {
    const orderId = yield* createOrderIdEffect(row.orderId);

    return {
      createdAt: row.createdAt,
      id: row.id,
      metadata: row.metadataJson,
      orderId,
      status: row.status,
      type: row.type,
      updatedAt: row.updatedAt,
    };
  }).pipe(
    Effect.flatMap((operation) =>
      Schema.decodeUnknownEffect(OrderPostPurchaseOperationRecordSchema)(
        operation
      )
    ),
    Effect.mapError(() =>
      toRepositoryDecodeFailure("order-post-purchase-operation", "read")
    )
  );

const decodeOrderRow = (
  row: unknown
): EffectValue<OrderRecord, OrderExpectedError> =>
  Schema.decodeUnknownEffect(OrderPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("order", "read")),
    Effect.map((decoded) => decoded as OrderPostgresRow),
    Effect.flatMap(toOrderRecord)
  );

const decodeOrderLineItemRow = (
  row: unknown
): EffectValue<OrderLineItemRecord, OrderExpectedError> =>
  Schema.decodeUnknownEffect(OrderLineItemPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("order-line-item", "read")),
    Effect.map((decoded) => decoded as OrderLineItemPostgresRow),
    Effect.flatMap(toOrderLineItemRecord)
  );

const decodeOrderTransactionRow = (
  row: unknown
): EffectValue<OrderTransactionRecord, OrderExpectedError> =>
  Schema.decodeUnknownEffect(OrderTransactionPostgresRowSchema)(row).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("order-transaction", "read")
    ),
    Effect.map((decoded) => decoded as OrderTransactionPostgresRow),
    Effect.flatMap(toOrderTransactionRecord)
  );

const decodeOrderStateTransitionRow = (
  row: unknown
): EffectValue<OrderStateTransitionRecord, OrderExpectedError> =>
  Schema.decodeUnknownEffect(OrderStateTransitionPostgresRowSchema)(row).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("order-state-transition", "read")
    ),
    Effect.map((decoded) => decoded as OrderStateTransitionPostgresRow),
    Effect.flatMap(toOrderStateTransitionRecord)
  );

const decodeOrderPostPurchaseOperationRow = (
  row: unknown
): EffectValue<OrderAggregate["operations"][number], OrderExpectedError> =>
  Schema.decodeUnknownEffect(OrderPostPurchaseOperationPostgresRowSchema)(
    row
  ).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("order-post-purchase-operation", "read")
    ),
    Effect.map((decoded) => decoded as OrderPostPurchaseOperationPostgresRow),
    Effect.flatMap(toOrderPostPurchaseOperationRecord)
  );

const getOrderAggregateById = (
  service: PostgresDrizzleServiceShape,
  orderId: OrderId
): EffectValue<OrderAggregate | null, OrderExpectedError> =>
  Effect.gen(function* getOrderAggregateByIdEffect() {
    const executor = yield* getOrderExecutor(service);
    const [orderRow] = yield* executor
      .select()
      .from(postgresOrder)
      .where(eq(postgresOrder.id, orderId))
      .limit(1)
      .pipe(Effect.mapError(toRepositoryUnavailable("read")));

    if (!orderRow) {
      return null;
    }

    const lineItemRows = yield* executor
      .select()
      .from(postgresOrderLineItem)
      .where(eq(postgresOrderLineItem.orderId, orderId))
      .orderBy(
        asc(postgresOrderLineItem.createdAt),
        asc(postgresOrderLineItem.id)
      )
      .pipe(Effect.mapError(toRepositoryUnavailable("read")));
    const transactionRows = yield* executor
      .select()
      .from(postgresOrderTransaction)
      .where(eq(postgresOrderTransaction.orderId, orderId))
      .orderBy(
        asc(postgresOrderTransaction.createdAt),
        asc(postgresOrderTransaction.id)
      )
      .pipe(Effect.mapError(toRepositoryUnavailable("read")));
    const transitionRows = yield* executor
      .select()
      .from(postgresOrderStateTransition)
      .where(eq(postgresOrderStateTransition.orderId, orderId))
      .orderBy(asc(postgresOrderStateTransition.changedAt))
      .pipe(Effect.mapError(toRepositoryUnavailable("read")));
    const operationRows = yield* executor
      .select()
      .from(postgresOrderPostPurchaseOperation)
      .where(eq(postgresOrderPostPurchaseOperation.orderId, orderId))
      .orderBy(
        asc(postgresOrderPostPurchaseOperation.createdAt),
        asc(postgresOrderPostPurchaseOperation.id)
      )
      .pipe(Effect.mapError(toRepositoryUnavailable("read")));

    return yield* Schema.decodeUnknownEffect(OrderAggregateSchema)({
      lineItems: yield* Effect.all(lineItemRows.map(decodeOrderLineItemRow)),
      operations: yield* Effect.all(
        operationRows.map(decodeOrderPostPurchaseOperationRow)
      ),
      order: yield* decodeOrderRow(orderRow),
      stateTransitions: yield* Effect.all(
        transitionRows.map(decodeOrderStateTransitionRow)
      ),
      transactions: yield* Effect.all(
        transactionRows.map(decodeOrderTransactionRow)
      ),
    }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("order", "read")));
  });

/** Creates the PostgreSQL-backed order repository contract implementation. */
export const createPostgresOrderRepository = (
  service: PostgresDrizzleServiceShape
): OrderRepository =>
  OrderRepositoryService.of({
    findOrderById: (orderId) =>
      Effect.gen(function* findOrderByIdEffect() {
        const executor = yield* getOrderExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresOrder)
          .where(eq(postgresOrder.id, orderId))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeOrderRow(row) : null;
      }),
    findOrderByIdempotencyKey: (idempotencyKey) =>
      Effect.gen(function* findOrderByIdempotencyKeyEffect() {
        const executor = yield* getOrderExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresOrder)
          .where(eq(postgresOrder.idempotencyKey, idempotencyKey))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeOrderRow(row) : null;
      }),
    findStateTransitionByIdempotencyKey: (idempotencyKey) =>
      Effect.gen(function* findStateTransitionByIdempotencyKeyEffect() {
        const executor = yield* getOrderExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresOrderStateTransition)
          .where(
            eq(postgresOrderStateTransition.idempotencyKey, idempotencyKey)
          )
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeOrderStateTransitionRow(row) : null;
      }),
    getOrderAggregate: (orderId) => getOrderAggregateById(service, orderId),
    listOrders: Effect.gen(function* listOrdersEffect() {
      const executor = yield* getOrderExecutor(service);
      const rows = yield* executor
        .select()
        .from(postgresOrder)
        .orderBy(desc(postgresOrder.createdAt), desc(postgresOrder.id))
        .pipe(Effect.mapError(toRepositoryUnavailable("read")));

      return yield* Effect.all(rows.map(decodeOrderRow));
    }),
    saveOrderAggregate: (aggregate, idempotencyKey) =>
      Effect.gen(function* saveOrderAggregateEffect() {
        const duplicate = yield* createPostgresOrderRepository(
          service
        ).getOrderAggregate(aggregate.order.id);

        if (duplicate) {
          return duplicate;
        }

        const idempotentDuplicate =
          yield* createPostgresOrderRepository(
            service
          ).findOrderByIdempotencyKey(idempotencyKey);

        if (idempotentDuplicate) {
          const existingAggregate = yield* getOrderAggregateById(
            service,
            idempotentDuplicate.id
          );

          if (existingAggregate) {
            return existingAggregate;
          }
        }

        const executor = yield* getOrderExecutor(service);
        const orderInsert = yield* toOrderPostgresInsert({
          idempotencyKey,
          order: aggregate.order,
        });
        yield* executor
          .insert(postgresOrder)
          .values(orderInsert)
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        const lineItemInserts = yield* Effect.all(
          aggregate.lineItems.map(toOrderLineItemPostgresInsert)
        );
        if (lineItemInserts.length > 0) {
          yield* executor
            .insert(postgresOrderLineItem)
            .values(lineItemInserts)
            .pipe(
              Effect.asVoid,
              Effect.mapError(toRepositoryUnavailable("write"))
            );
        }

        const transactionInserts = yield* Effect.all(
          aggregate.transactions.map((transaction) =>
            toOrderTransactionPostgresInsert({
              idempotencyKey: `${idempotencyKey}:${transaction.id}`,
              transaction,
            })
          )
        );
        if (transactionInserts.length > 0) {
          yield* executor
            .insert(postgresOrderTransaction)
            .values(transactionInserts)
            .pipe(
              Effect.asVoid,
              Effect.mapError(toRepositoryUnavailable("write"))
            );
        }

        const transitionInserts = yield* Effect.all(
          aggregate.stateTransitions.map((transition, index) =>
            toOrderStateTransitionPostgresInsert({
              idempotencyKey: `${idempotencyKey}:transition:${index}`,
              transition,
            })
          )
        );
        if (transitionInserts.length > 0) {
          yield* executor
            .insert(postgresOrderStateTransition)
            .values(transitionInserts)
            .pipe(
              Effect.asVoid,
              Effect.mapError(toRepositoryUnavailable("write"))
            );
        }

        const operationInserts = yield* Effect.all(
          aggregate.operations.map(toOrderPostPurchaseOperationPostgresInsert)
        );
        if (operationInserts.length > 0) {
          yield* executor
            .insert(postgresOrderPostPurchaseOperation)
            .values(operationInserts)
            .pipe(
              Effect.asVoid,
              Effect.mapError(toRepositoryUnavailable("write"))
            );
        }

        return aggregate;
      }),
    saveOrderTransaction: (transaction, idempotencyKey) =>
      Effect.gen(function* saveOrderTransactionEffect() {
        const executor = yield* getOrderExecutor(service);
        const [duplicate] = yield* executor
          .select()
          .from(postgresOrderTransaction)
          .where(eq(postgresOrderTransaction.idempotencyKey, idempotencyKey))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        if (duplicate) {
          return yield* decodeOrderTransactionRow(duplicate);
        }

        const existingOrder = yield* createPostgresOrderRepository(
          service
        ).findOrderById(transaction.orderId);

        if (!existingOrder) {
          return yield* new OrderNotFound({ orderId: transaction.orderId });
        }

        const insert = yield* toOrderTransactionPostgresInsert({
          idempotencyKey,
          transaction,
        });
        yield* executor
          .insert(postgresOrderTransaction)
          .values(insert)
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return transaction;
      }),
    saveStateTransition: (transition, idempotencyKey) =>
      Effect.gen(function* saveStateTransitionEffect() {
        const duplicate =
          yield* createPostgresOrderRepository(
            service
          ).findStateTransitionByIdempotencyKey(idempotencyKey);

        if (duplicate) {
          return duplicate;
        }

        const existingOrder = yield* createPostgresOrderRepository(
          service
        ).findOrderById(transition.orderId);

        if (!existingOrder) {
          return yield* new OrderNotFound({ orderId: transition.orderId });
        }

        const executor = yield* getOrderExecutor(service);
        const insert = yield* toOrderStateTransitionPostgresInsert({
          idempotencyKey,
          transition,
        });
        yield* executor
          .insert(postgresOrderStateTransition)
          .values(insert)
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return transition;
      }),
    updateOrder: (order) =>
      Effect.gen(function* updateOrderEffect() {
        const existing = yield* createPostgresOrderRepository(
          service
        ).findOrderById(order.id);

        if (!existing) {
          return yield* new OrderNotFound({ orderId: order.id });
        }

        const executor = yield* getOrderExecutor(service);
        const insert = yield* toOrderPostgresInsert({
          idempotencyKey: "preserve-existing-idempotency-key",
          order,
        });
        yield* executor
          .update(postgresOrder)
          .set({
            billingAddressJson: insert.billingAddressJson,
            cartId: insert.cartId,
            completedAt: insert.completedAt,
            currencyCode: insert.currencyCode,
            customerId: insert.customerId,
            email: insert.email,
            fulfillmentReferencesJson: insert.fulfillmentReferencesJson,
            metadataJson: insert.metadataJson,
            paymentReferencesJson: insert.paymentReferencesJson,
            shippingAddressJson: insert.shippingAddressJson,
            status: insert.status,
            totalsJson: insert.totalsJson,
            updatedAt: insert.updatedAt,
          })
          .where(eq(postgresOrder.id, order.id))
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return order;
      }),
  });

export const createPostgresOrderRepositoryLayer = () =>
  Layer.effect(
    OrderRepositoryService,
    PostgresDrizzleService.use((service) =>
      Effect.succeed(createPostgresOrderRepository(service))
    )
  );

/** Production PostgreSQL order repository Layer. */
export const PostgresOrderRepositoryLayer =
  createPostgresOrderRepositoryLayer();

/** Runs an order repository Effect inside the current PostgreSQL transaction. */
export const withPostgresOrderTransaction = <A, E, R>(
  effect: EffectValue<A, E, R>
): EffectValue<A, E | SqlError, R | PostgresDrizzleService> =>
  PostgresDrizzleService.use((service) =>
    service.withTransaction(() => effect)
  );
