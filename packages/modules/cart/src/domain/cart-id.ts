import { Effect, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import { CartInvalidIdentifier } from "./cart.errors";
import {
  CartAdjustmentIdSchema,
  CartIdSchema,
  CartLineItemIdSchema,
} from "./cart.schema";
import type { CartAdjustmentId, CartId, CartLineItemId } from "./cart.types";

export const CART_ID_PREFIX = "cart_" as const;
export const CART_LINE_ITEM_ID_PREFIX = "clitem_" as const;
export const CART_ADJUSTMENT_ID_PREFIX = "cadj_" as const;

const toInvalidIdentifier = (
  expectedPrefix: string,
  value: string
): CartInvalidIdentifier =>
  new CartInvalidIdentifier({ expectedPrefix, value });

export const createCartId = (value: string): CartId => value as CartId;
export const createCartIdEffect = (
  value: string
): EffectValue<CartId, CartInvalidIdentifier> =>
  Schema.decodeUnknownEffect(CartIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(CART_ID_PREFIX, value))
  );
export const serializeCartId = (id: CartId): string => id;

export const createCartLineItemId = (value: string): CartLineItemId =>
  value as CartLineItemId;
export const createCartLineItemIdEffect = (
  value: string
): EffectValue<CartLineItemId, CartInvalidIdentifier> =>
  Schema.decodeUnknownEffect(CartLineItemIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(CART_LINE_ITEM_ID_PREFIX, value))
  );
export const serializeCartLineItemId = (id: CartLineItemId): string => id;

export const createCartAdjustmentId = (value: string): CartAdjustmentId =>
  value as CartAdjustmentId;
export const createCartAdjustmentIdEffect = (
  value: string
): EffectValue<CartAdjustmentId, CartInvalidIdentifier> =>
  Schema.decodeUnknownEffect(CartAdjustmentIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(CART_ADJUSTMENT_ID_PREFIX, value))
  );
export const serializeCartAdjustmentId = (id: CartAdjustmentId): string => id;
