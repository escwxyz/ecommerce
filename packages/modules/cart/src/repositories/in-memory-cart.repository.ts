import type {
  CartAdjustmentRecord,
  CartId,
  CartLineItemId,
  CartLineItemRecord,
  CartRecord,
  CartRepository,
} from "../domain";

export interface ResettableCartRepository extends CartRepository {
  clear(): void;
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

  clear(): void {
    this.#adjustmentIdempotency.clear();
    this.#adjustments.clear();
    this.#carts.clear();
    this.#lineItemIdempotency.clear();
    this.#lineItems.clear();
  }

  findAdjustmentByIdempotencyKey(
    idempotencyKey: string
  ): Promise<CartAdjustmentRecord | null> {
    return Promise.resolve(
      this.#adjustmentIdempotency.get(idempotencyKey) ?? null
    );
  }

  findCartById(id: CartId): Promise<CartRecord | null> {
    return Promise.resolve(this.#carts.get(id) ?? null);
  }

  findLineItemById(
    id: CartLineItemId,
    _cartId?: CartId
  ): Promise<CartLineItemRecord | null> {
    return Promise.resolve(this.#lineItems.get(id) ?? null);
  }

  findLineItemByIdempotencyKey(
    idempotencyKey: string
  ): Promise<CartLineItemRecord | null> {
    return Promise.resolve(
      this.#lineItemIdempotency.get(idempotencyKey) ?? null
    );
  }

  getCartAggregate(id: CartId) {
    const cart = this.#carts.get(id);

    if (!cart) {
      return Promise.resolve(null);
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

    return Promise.resolve({
      adjustments: sortByCreatedAtDescending(adjustments),
      cart,
      lineItems: sortByCreatedAtDescending(lineItems),
    });
  }

  listCarts(): Promise<readonly CartRecord[]> {
    return Promise.resolve(sortByCreatedAtDescending(this.#carts.values()));
  }

  removeLineItem(id: CartLineItemId, _cartId?: CartId): Promise<void> {
    this.#lineItems.delete(id);
    return Promise.resolve();
  }

  saveAdjustment(
    adjustment: CartAdjustmentRecord,
    idempotencyKey: string
  ): Promise<CartAdjustmentRecord> {
    const duplicate = this.#adjustmentIdempotency.get(idempotencyKey);

    if (duplicate) {
      return Promise.resolve(duplicate);
    }

    this.#adjustments.set(adjustment.id, adjustment);
    this.#adjustmentIdempotency.set(idempotencyKey, adjustment);
    return Promise.resolve(adjustment);
  }

  saveCart(cart: CartRecord): Promise<CartRecord> {
    this.#carts.set(cart.id, cart);
    return Promise.resolve(cart);
  }

  saveLineItem(
    item: CartLineItemRecord,
    idempotencyKey?: string
  ): Promise<CartLineItemRecord> {
    if (idempotencyKey) {
      const duplicate = this.#lineItemIdempotency.get(idempotencyKey);

      if (duplicate) {
        return Promise.resolve(duplicate);
      }

      this.#lineItemIdempotency.set(idempotencyKey, item);
    }

    this.#lineItems.set(item.id, item);
    return Promise.resolve(item);
  }
}

export const defaultCartRepository = new InMemoryCartRepository();

export const createInMemoryCartRepository = (): CartRepository =>
  new InMemoryCartRepository();

export const createResettableInMemoryCartRepository =
  (): ResettableCartRepository => new InMemoryCartRepository();
