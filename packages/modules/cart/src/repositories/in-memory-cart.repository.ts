import { Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type {
  CartAdjustmentRecord,
  CartExpectedError,
  CartId,
  CartLineItemId,
  CartLineItemRecord,
  CartRecord,
  CartRepository,
} from "../domain";
import { CartRepositoryService } from "../domain";

export interface ResettableCartRepository extends CartRepository {
  readonly clear: EffectValue<void, never>;
}

const sortByCreatedAtDescending = <
  TRecord extends { readonly createdAt: Date },
>(
  records: Iterable<TRecord>
): TRecord[] => {
  const sortedRecords: TRecord[] = [];

  for (const record of records) {
    const recordTimestamp = record.createdAt.getTime();
    let insertAt = 0;

    while (insertAt < sortedRecords.length) {
      const currentRecord = sortedRecords[insertAt];

      if (
        !currentRecord ||
        currentRecord.createdAt.getTime() < recordTimestamp
      ) {
        break;
      }

      insertAt += 1;
    }

    sortedRecords.splice(insertAt, 0, record);
  }

  return sortedRecords;
};

export class InMemoryCartRepository implements ResettableCartRepository {
  readonly #adjustmentIdempotency = new Map<string, CartAdjustmentRecord>();
  readonly #adjustments = new Map<string, CartAdjustmentRecord>();
  readonly #carts = new Map<string, CartRecord>();
  readonly #lineItemIdempotency = new Map<string, CartLineItemRecord>();
  readonly #lineItems = new Map<string, CartLineItemRecord>();

  readonly clear = Effect.sync(() => {
    this.#adjustmentIdempotency.clear();
    this.#adjustments.clear();
    this.#carts.clear();
    this.#lineItemIdempotency.clear();
    this.#lineItems.clear();
  });

  readonly findAdjustmentByIdempotencyKey = (
    idempotencyKey: string
  ): EffectValue<CartAdjustmentRecord | null, CartExpectedError> =>
    Effect.sync(() => this.#adjustmentIdempotency.get(idempotencyKey) ?? null);

  readonly findCartById = (
    id: CartId
  ): EffectValue<CartRecord | null, CartExpectedError> =>
    Effect.sync(() => this.#carts.get(id) ?? null);

  readonly findLineItemById = (
    id: CartLineItemId,
    cartId?: CartId
  ): EffectValue<CartLineItemRecord | null, CartExpectedError> =>
    Effect.sync(() => {
      const item = this.#lineItems.get(id) ?? null;

      if (!item || (cartId && item.cartId !== cartId)) {
        return null;
      }

      return item;
    });

  readonly findLineItemByIdempotencyKey = (
    idempotencyKey: string
  ): EffectValue<CartLineItemRecord | null, CartExpectedError> =>
    Effect.sync(() => this.#lineItemIdempotency.get(idempotencyKey) ?? null);

  readonly getCartAggregate = (
    id: CartId
  ): EffectValue<
    {
      readonly adjustments: readonly CartAdjustmentRecord[];
      readonly cart: CartRecord;
      readonly lineItems: readonly CartLineItemRecord[];
    } | null,
    CartExpectedError
  > =>
    Effect.sync(() => {
      const cart = this.#carts.get(id);

      if (!cart) {
        return null;
      }

      const lineItems: CartLineItemRecord[] = [];
      const adjustments: CartAdjustmentRecord[] = [];

      for (const item of this.#lineItems.values()) {
        if (item.cartId === id) {
          lineItems.push(item);
        }
      }

      for (const adjustment of this.#adjustments.values()) {
        if (adjustment.cartId === id) {
          adjustments.push(adjustment);
        }
      }

      return {
        adjustments: sortByCreatedAtDescending(adjustments),
        cart,
        lineItems: sortByCreatedAtDescending(lineItems),
      };
    });

  readonly listCarts: EffectValue<readonly CartRecord[], CartExpectedError> =
    Effect.sync(() => sortByCreatedAtDescending(this.#carts.values()));

  readonly removeLineItem = (
    id: CartLineItemId,
    _cartId?: CartId
  ): EffectValue<void, CartExpectedError> =>
    Effect.sync(() => {
      this.#lineItems.delete(id);
    });

  readonly saveAdjustment = (
    adjustment: CartAdjustmentRecord,
    idempotencyKey: string
  ): EffectValue<CartAdjustmentRecord, CartExpectedError> =>
    Effect.sync(() => {
      const duplicate = this.#adjustmentIdempotency.get(idempotencyKey);

      if (duplicate) {
        return duplicate;
      }

      this.#adjustments.set(adjustment.id, adjustment);
      this.#adjustmentIdempotency.set(idempotencyKey, adjustment);
      return adjustment;
    });

  readonly saveCart = (
    cart: CartRecord
  ): EffectValue<CartRecord, CartExpectedError> =>
    Effect.sync(() => {
      this.#carts.set(cart.id, cart);
      return cart;
    });

  readonly saveLineItem = (
    item: CartLineItemRecord,
    idempotencyKey?: string
  ): EffectValue<CartLineItemRecord, CartExpectedError> =>
    Effect.sync(() => {
      if (idempotencyKey) {
        const duplicate = this.#lineItemIdempotency.get(idempotencyKey);

        if (duplicate) {
          return duplicate;
        }

        this.#lineItemIdempotency.set(idempotencyKey, item);
      }

      this.#lineItems.set(item.id, item);
      return item;
    });
}

export const defaultCartRepository = new InMemoryCartRepository();

export const createInMemoryCartRepository = (): CartRepository =>
  new InMemoryCartRepository();

export const createResettableInMemoryCartRepository =
  (): ResettableCartRepository => new InMemoryCartRepository();

export const createInMemoryCartRepositoryLayer = () =>
  Layer.succeed(CartRepositoryService, createInMemoryCartRepository());
