import { Context } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type { CartExpectedError } from "./cart.errors";
import type {
  AddCartLineItemInputSchema,
  ApplyCartAdjustmentInputSchema,
  AssociateCartCustomerInputSchema,
  CartAddressSchema,
  CartAdjustmentApiRecordSchema,
  CartAdjustmentIdSchema,
  CartAdjustmentRecordSchema,
  CartAdjustmentTypeSchema,
  CartAggregateApiSchema,
  CartAggregateSchema,
  CartApiRecordSchema,
  CartIdSchema,
  CartIdentifierSchema,
  CartLineItemApiRecordSchema,
  CartLineItemIdSchema,
  CartLineItemRecordSchema,
  CartRecordSchema,
  CartStatusSchema,
  CartTotalsSnapshotSchema,
  CreateCartInputSchema,
  SetCartAddressesInputSchema,
  SetCartCheckoutReferencesInputSchema,
  SetCartRegionChannelInputSchema,
  UpdateCartLineItemInputSchema,
  UpdateCartTotalsInputSchema,
} from "./cart.schema";

export type CartId = typeof CartIdSchema.Type;
export type CartLineItemId = typeof CartLineItemIdSchema.Type;
export type CartAdjustmentId = typeof CartAdjustmentIdSchema.Type;
export type CartStatus = typeof CartStatusSchema.Type;
export type CartAddress = typeof CartAddressSchema.Type;
export type CartTotalsSnapshot = typeof CartTotalsSnapshotSchema.Type;
export type CartAdjustmentType = typeof CartAdjustmentTypeSchema.Type;
export type CreateCartInput = typeof CreateCartInputSchema.Type;
export type AddCartLineItemInput = typeof AddCartLineItemInputSchema.Type;
export type UpdateCartLineItemInput = typeof UpdateCartLineItemInputSchema.Type;
export type AssociateCartCustomerInput =
  typeof AssociateCartCustomerInputSchema.Type;
export type SetCartAddressesInput = typeof SetCartAddressesInputSchema.Type;
export type SetCartRegionChannelInput =
  typeof SetCartRegionChannelInputSchema.Type;
export type SetCartCheckoutReferencesInput =
  typeof SetCartCheckoutReferencesInputSchema.Type;
export type ApplyCartAdjustmentInput =
  typeof ApplyCartAdjustmentInputSchema.Type;
export type UpdateCartTotalsInput = typeof UpdateCartTotalsInputSchema.Type;
export type CartIdentifierInput = typeof CartIdentifierSchema.Type;
export type CartRecord = typeof CartRecordSchema.Type;
export type CartLineItemRecord = typeof CartLineItemRecordSchema.Type;
export type CartAdjustmentRecord = typeof CartAdjustmentRecordSchema.Type;
export type CartAggregate = typeof CartAggregateSchema.Type;
export type CartApiRecord = typeof CartApiRecordSchema.Type;
export type CartLineItemApiRecord = typeof CartLineItemApiRecordSchema.Type;
export type CartAdjustmentApiRecord = typeof CartAdjustmentApiRecordSchema.Type;
export type CartAggregateApiRecord = typeof CartAggregateApiSchema.Type;

export interface CartRepository {
  /**
   * Finds the adjustment previously stored for `idempotencyKey`. The optional
   * `cartId` scopes the idempotency lookup to one cart when the adapter can
   * enforce scoped indexes; callers that require isolation must treat a record
   * for another cart as no match.
   */
  readonly findAdjustmentByIdempotencyKey: (
    idempotencyKey: string,
    cartId?: CartId
  ) => EffectValue<CartAdjustmentRecord | null, CartExpectedError>;
  readonly findCartById: (
    id: CartId
  ) => EffectValue<CartRecord | null, CartExpectedError>;
  readonly findLineItemById: (
    id: CartLineItemId,
    cartId?: CartId
  ) => EffectValue<CartLineItemRecord | null, CartExpectedError>;
  /**
   * Finds the line item previously stored for `idempotencyKey`. The optional
   * `cartId` scopes the idempotency lookup to one cart when the adapter can
   * enforce scoped indexes; callers that require isolation must treat a record
   * for another cart as no match.
   */
  readonly findLineItemByIdempotencyKey: (
    idempotencyKey: string,
    cartId?: CartId
  ) => EffectValue<CartLineItemRecord | null, CartExpectedError>;
  readonly getCartAggregate: (
    id: CartId
  ) => EffectValue<CartAggregate | null, CartExpectedError>;
  readonly listCarts: EffectValue<readonly CartRecord[], CartExpectedError>;
  readonly removeLineItem: (
    id: CartLineItemId,
    cartId?: CartId
  ) => EffectValue<void, CartExpectedError>;
  readonly saveAdjustment: (
    adjustment: CartAdjustmentRecord,
    idempotencyKey: string
  ) => EffectValue<CartAdjustmentRecord, CartExpectedError>;
  readonly saveCart: (
    cart: CartRecord
  ) => EffectValue<CartRecord, CartExpectedError>;
  readonly saveLineItem: (
    item: CartLineItemRecord,
    idempotencyKey?: string
  ) => EffectValue<CartLineItemRecord, CartExpectedError>;
}

/** Effect-native cart repository contract consumed by cart services. */
export const CartRepositoryService = Context.Service<CartRepository>(
  "@ecommerce/cart/CartRepository"
);
