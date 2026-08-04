import {
  CartAdjustmentRecordSchema,
  CartLineItemRecordSchema,
  CartRecordSchema,
  CartRepositoryService,
  createCartAdjustmentIdEffect,
  createCartIdEffect,
  createCartLineItemIdEffect,
} from "@ecommerce/cart";
import type {
  CartAdjustmentRecord,
  CartExpectedError,
  CartLineItemRecord,
  CartRecord,
  CartRepository,
} from "@ecommerce/cart";
import {
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import { and, desc, eq } from "drizzle-orm";
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
  CartAdjustmentPostgresInsertSchema,
  CartAdjustmentPostgresRowSchema,
  CartLineItemPostgresInsertSchema,
  CartLineItemPostgresRowSchema,
  CartPostgresInsertSchema,
  CartPostgresRowSchema,
  postgresCart,
  postgresCartAdjustment,
  postgresCartLineItem,
} from "./schema";
import type {
  CartAdjustmentPostgresInsert,
  CartAdjustmentPostgresRow,
  CartLineItemPostgresInsert,
  CartLineItemPostgresRow,
  CartPostgresInsert,
  CartPostgresRow,
} from "./schema";

type CartPostgresExecutor =
  | PostgresDrizzleDatabase
  | PostgresDrizzleTransaction;

const cartRepositoryName = "CartRepository";

const toRepositoryUnavailable =
  (operation: "delete" | "read" | "write") => (): RepositoryUnavailable =>
    new RepositoryUnavailable({
      adapter: "effect-postgres",
      operation,
      repository: cartRepositoryName,
    });

const toRepositoryDecodeFailure = (
  entity: "cart" | "cart-adjustment" | "cart-line-item",
  operation: "read" | "write"
): RepositoryDecodeFailure =>
  new RepositoryDecodeFailure({
    entity,
    operation,
    repository: cartRepositoryName,
  });

const getCartExecutor = (
  service: PostgresDrizzleServiceShape
): EffectValue<CartPostgresExecutor> =>
  Effect.map(
    Effect.serviceOption(CurrentPostgresTransactionService),
    Option.getOrElse(() => service.database)
  );

export const toCartPostgresInsert = (
  cart: CartRecord
): EffectValue<CartPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(CartPostgresInsertSchema)({
    billingAddressJson: cart.billingAddress,
    completedAt: cart.completedAt,
    createdAt: cart.createdAt,
    currencyCode: cart.currencyCode,
    customerId: cart.customerId,
    email: cart.email,
    id: cart.id,
    metadataJson: cart.metadata,
    paymentCollectionId: cart.paymentCollectionId,
    regionId: cart.regionId,
    salesChannelId: cart.salesChannelId,
    shippingAddressJson: cart.shippingAddress,
    shippingOptionId: cart.shippingOptionId,
    status: cart.status,
    totalsJson: cart.totals,
    updatedAt: cart.updatedAt,
  }).pipe(
    Effect.map((insert) => insert as CartPostgresInsert),
    Effect.mapError(() => toRepositoryDecodeFailure("cart", "write"))
  );

export const toCartLineItemPostgresInsert = ({
  idempotencyKey,
  item,
}: {
  readonly idempotencyKey?: string;
  readonly item: CartLineItemRecord;
}): EffectValue<CartLineItemPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(CartLineItemPostgresInsertSchema)({
    cartId: item.cartId,
    createdAt: item.createdAt,
    id: item.id,
    idempotencyKey: idempotencyKey ?? null,
    metadataJson: item.metadata,
    productId: item.productId,
    quantity: item.quantity,
    title: item.title,
    unitPrice: item.unitPrice,
    updatedAt: item.updatedAt,
    variantId: item.variantId,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("cart-line-item", "write"))
  );

export const toCartAdjustmentPostgresInsert = ({
  adjustment,
  idempotencyKey,
}: {
  readonly adjustment: CartAdjustmentRecord;
  readonly idempotencyKey: string;
}): EffectValue<CartAdjustmentPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(CartAdjustmentPostgresInsertSchema)({
    amount: adjustment.amount,
    cartId: adjustment.cartId,
    createdAt: adjustment.createdAt,
    id: adjustment.id,
    idempotencyKey,
    lineItemId: adjustment.lineItemId,
    metadataJson: adjustment.metadata,
    source: adjustment.source,
    type: adjustment.type,
    updatedAt: adjustment.updatedAt,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("cart-adjustment", "write"))
  );

const toCartRecord = (
  row: CartPostgresRow
): EffectValue<CartRecord, CartExpectedError> =>
  Effect.gen(function* toCartRecordEffect() {
    const id = yield* createCartIdEffect(row.id);

    return yield* Schema.decodeUnknownEffect(CartRecordSchema)({
      billingAddress: row.billingAddressJson,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      currencyCode: row.currencyCode,
      customerId: row.customerId,
      email: row.email,
      id,
      metadata: row.metadataJson,
      paymentCollectionId: row.paymentCollectionId,
      regionId: row.regionId,
      salesChannelId: row.salesChannelId,
      shippingAddress: row.shippingAddressJson,
      shippingOptionId: row.shippingOptionId,
      status: row.status,
      totals: row.totalsJson,
      updatedAt: row.updatedAt,
    }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("cart", "read")));
  });

const toCartLineItemRecord = (
  row: CartLineItemPostgresRow
): EffectValue<CartLineItemRecord, CartExpectedError> =>
  Effect.gen(function* toCartLineItemRecordEffect() {
    const cartId = yield* createCartIdEffect(row.cartId);
    const id = yield* createCartLineItemIdEffect(row.id);

    return yield* Schema.decodeUnknownEffect(CartLineItemRecordSchema)({
      cartId,
      createdAt: row.createdAt,
      id,
      metadata: row.metadataJson,
      productId: row.productId,
      quantity: row.quantity,
      title: row.title,
      unitPrice: row.unitPrice,
      updatedAt: row.updatedAt,
      variantId: row.variantId,
    }).pipe(
      Effect.mapError(() => toRepositoryDecodeFailure("cart-line-item", "read"))
    );
  });

const toCartAdjustmentRecord = (
  row: CartAdjustmentPostgresRow
): EffectValue<CartAdjustmentRecord, CartExpectedError> =>
  Effect.gen(function* toCartAdjustmentRecordEffect() {
    const cartId = yield* createCartIdEffect(row.cartId);
    const id = yield* createCartAdjustmentIdEffect(row.id);
    const lineItemId = row.lineItemId
      ? yield* createCartLineItemIdEffect(row.lineItemId)
      : null;

    return yield* Schema.decodeUnknownEffect(CartAdjustmentRecordSchema)({
      amount: row.amount,
      cartId,
      createdAt: row.createdAt,
      id,
      lineItemId,
      metadata: row.metadataJson,
      source: row.source,
      type: row.type,
      updatedAt: row.updatedAt,
    }).pipe(
      Effect.mapError(() =>
        toRepositoryDecodeFailure("cart-adjustment", "read")
      )
    );
  });

const decodeCartRow = (
  row: unknown
): EffectValue<CartRecord, CartExpectedError> =>
  Schema.decodeUnknownEffect(CartPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("cart", "read")),
    Effect.map((decoded) => decoded as CartPostgresRow),
    Effect.flatMap(toCartRecord)
  );

const decodeCartLineItemRow = (
  row: unknown
): EffectValue<CartLineItemRecord, CartExpectedError> =>
  Schema.decodeUnknownEffect(CartLineItemPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("cart-line-item", "read")),
    Effect.map((decoded) => decoded as CartLineItemPostgresRow),
    Effect.flatMap(toCartLineItemRecord)
  );

const decodeCartAdjustmentRow = (
  row: unknown
): EffectValue<CartAdjustmentRecord, CartExpectedError> =>
  Schema.decodeUnknownEffect(CartAdjustmentPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("cart-adjustment", "read")),
    Effect.map((decoded) => decoded as CartAdjustmentPostgresRow),
    Effect.flatMap(toCartAdjustmentRecord)
  );

/** Creates the PostgreSQL-backed cart repository contract implementation. */
export const createPostgresCartRepository = (
  service: PostgresDrizzleServiceShape
): CartRepository =>
  CartRepositoryService.of({
    findAdjustmentByIdempotencyKey: (idempotencyKey) =>
      Effect.gen(function* findAdjustmentByIdempotencyKeyEffect() {
        const executor = yield* getCartExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresCartAdjustment)
          .where(eq(postgresCartAdjustment.idempotencyKey, idempotencyKey))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeCartAdjustmentRow(row) : null;
      }),
    findCartById: (id) =>
      Effect.gen(function* findCartByIdEffect() {
        const executor = yield* getCartExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresCart)
          .where(eq(postgresCart.id, id))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeCartRow(row) : null;
      }),
    findLineItemById: (id, cartId) =>
      Effect.gen(function* findLineItemByIdEffect() {
        const executor = yield* getCartExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresCartLineItem)
          .where(
            cartId
              ? and(
                  eq(postgresCartLineItem.id, id),
                  eq(postgresCartLineItem.cartId, cartId)
                )
              : eq(postgresCartLineItem.id, id)
          )
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeCartLineItemRow(row) : null;
      }),
    findLineItemByIdempotencyKey: (idempotencyKey) =>
      Effect.gen(function* findLineItemByIdempotencyKeyEffect() {
        const executor = yield* getCartExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresCartLineItem)
          .where(eq(postgresCartLineItem.idempotencyKey, idempotencyKey))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeCartLineItemRow(row) : null;
      }),
    getCartAggregate: (id) =>
      Effect.gen(function* getCartAggregateEffect() {
        const executor = yield* getCartExecutor(service);
        const [cartRow] = yield* executor
          .select()
          .from(postgresCart)
          .where(eq(postgresCart.id, id))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        if (!cartRow) {
          return null;
        }

        const lineItemRows = yield* executor
          .select()
          .from(postgresCartLineItem)
          .where(eq(postgresCartLineItem.cartId, id))
          .orderBy(desc(postgresCartLineItem.createdAt))
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));
        const adjustmentRows = yield* executor
          .select()
          .from(postgresCartAdjustment)
          .where(eq(postgresCartAdjustment.cartId, id))
          .orderBy(desc(postgresCartAdjustment.createdAt))
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return {
          adjustments: yield* Effect.all(
            adjustmentRows.map(decodeCartAdjustmentRow)
          ),
          cart: yield* decodeCartRow(cartRow),
          lineItems: yield* Effect.all(lineItemRows.map(decodeCartLineItemRow)),
        };
      }),
    listCarts: Effect.gen(function* listCartsEffect() {
      const executor = yield* getCartExecutor(service);
      const rows = yield* executor
        .select()
        .from(postgresCart)
        .orderBy(desc(postgresCart.createdAt))
        .pipe(Effect.mapError(toRepositoryUnavailable("read")));

      return yield* Effect.all(rows.map(decodeCartRow));
    }),
    removeLineItem: (id, cartId) =>
      Effect.gen(function* removeLineItemEffect() {
        const executor = yield* getCartExecutor(service);
        yield* executor
          .delete(postgresCartLineItem)
          .where(
            cartId
              ? and(
                  eq(postgresCartLineItem.id, id),
                  eq(postgresCartLineItem.cartId, cartId)
                )
              : eq(postgresCartLineItem.id, id)
          )
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("delete"))
          );
      }),
    saveAdjustment: (adjustment, idempotencyKey) =>
      Effect.gen(function* saveAdjustmentEffect() {
        const duplicate =
          yield* createPostgresCartRepository(
            service
          ).findAdjustmentByIdempotencyKey(idempotencyKey);

        if (duplicate) {
          return duplicate;
        }

        const executor = yield* getCartExecutor(service);
        const insert = yield* toCartAdjustmentPostgresInsert({
          adjustment,
          idempotencyKey,
        });
        yield* executor
          .insert(postgresCartAdjustment)
          .values(insert)
          .onConflictDoUpdate({
            set: insert,
            target: postgresCartAdjustment.id,
          })
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return adjustment;
      }),
    saveCart: (cart) =>
      Effect.gen(function* saveCartEffect() {
        const executor = yield* getCartExecutor(service);
        const insert = yield* toCartPostgresInsert(cart);
        yield* executor
          .insert(postgresCart)
          .values(insert)
          .onConflictDoUpdate({
            set: insert,
            target: postgresCart.id,
          })
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return cart;
      }),
    saveLineItem: (item, idempotencyKey) =>
      Effect.gen(function* saveLineItemEffect() {
        if (idempotencyKey) {
          const duplicate =
            yield* createPostgresCartRepository(
              service
            ).findLineItemByIdempotencyKey(idempotencyKey);

          if (duplicate) {
            return duplicate;
          }
        }

        const executor = yield* getCartExecutor(service);
        const insert = yield* toCartLineItemPostgresInsert({
          idempotencyKey,
          item,
        });

        if (!idempotencyKey) {
          yield* executor
            .update(postgresCartLineItem)
            .set({
              cartId: insert.cartId,
              metadataJson: insert.metadataJson,
              productId: insert.productId,
              quantity: insert.quantity,
              title: insert.title,
              unitPrice: insert.unitPrice,
              updatedAt: insert.updatedAt,
              variantId: insert.variantId,
            })
            .where(eq(postgresCartLineItem.id, item.id))
            .pipe(
              Effect.asVoid,
              Effect.mapError(toRepositoryUnavailable("write"))
            );

          return item;
        }

        yield* executor
          .insert(postgresCartLineItem)
          .values(insert)
          .onConflictDoUpdate({
            set: insert,
            target: postgresCartLineItem.id,
          })
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return item;
      }),
  });

export const createPostgresCartRepositoryLayer = () =>
  Layer.effect(
    CartRepositoryService,
    PostgresDrizzleService.use((service) =>
      Effect.succeed(createPostgresCartRepository(service))
    )
  );

/** Production PostgreSQL cart repository Layer. */
export const PostgresCartRepositoryLayer = createPostgresCartRepositoryLayer();

/** Runs a cart repository Effect inside the current PostgreSQL transaction. */
export const withPostgresCartTransaction = <A, E, R>(
  effect: EffectValue<A, E, R>
): EffectValue<A, E | SqlError, R | PostgresDrizzleService> =>
  PostgresDrizzleService.use((service) =>
    service.withTransaction(() => effect)
  );
