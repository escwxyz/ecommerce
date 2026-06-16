import { brand } from "@ecommerce/core/brand";

import type { CartAdjustmentId, CartId, CartLineItemId } from "./cart.types";

export const CART_ID_PREFIX = "cart_";
export const CART_LINE_ITEM_ID_PREFIX = "clitem_";
export const CART_ADJUSTMENT_ID_PREFIX = "cadj_";

export const createCartId = (value: string): CartId => {
  if (!value.startsWith(CART_ID_PREFIX)) {
    throw new Error(`Cart ID must start with "${CART_ID_PREFIX}".`);
  }

  return brand<"cart", string>(value);
};

export const createCartLineItemId = (value: string): CartLineItemId => {
  if (!value.startsWith(CART_LINE_ITEM_ID_PREFIX)) {
    throw new Error(
      `Cart line item ID must start with "${CART_LINE_ITEM_ID_PREFIX}".`
    );
  }

  return brand<"cart-line-item", string>(value);
};

export const createCartAdjustmentId = (value: string): CartAdjustmentId => {
  if (!value.startsWith(CART_ADJUSTMENT_ID_PREFIX)) {
    throw new Error(
      `Cart adjustment ID must start with "${CART_ADJUSTMENT_ID_PREFIX}".`
    );
  }

  return brand<"cart-adjustment", string>(value);
};

export const serializeCartId = (id: CartId): string => id;
export const serializeCartLineItemId = (id: CartLineItemId): string => id;
export const serializeCartAdjustmentId = (id: CartAdjustmentId): string => id;
