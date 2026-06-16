import type { Brand } from "@ecommerce/core/brand";
import type { z } from "zod";

import type {
  AddCartLineItemInputSchema,
  ApplyCartAdjustmentInputSchema,
  AssociateCartCustomerInputSchema,
  CartAddressSchema,
  CartAdjustmentApiRecordSchema,
  CartAdjustmentRecordSchema,
  CartAdjustmentTypeSchema,
  CartAggregateApiSchema,
  CartAggregateSchema,
  CartApiRecordSchema,
  CartIdentifierSchema,
  CartLineItemApiRecordSchema,
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

export type CartId = Brand<string, "cart">;
export type CartLineItemId = Brand<string, "cart-line-item">;
export type CartAdjustmentId = Brand<string, "cart-adjustment">;
export type CartStatus = z.infer<typeof CartStatusSchema>;
export type CartAddress = z.infer<typeof CartAddressSchema>;
export type CartTotalsSnapshot = z.infer<typeof CartTotalsSnapshotSchema>;
export type CartAdjustmentType = z.infer<typeof CartAdjustmentTypeSchema>;
export type CreateCartInput = z.infer<typeof CreateCartInputSchema>;
export type AddCartLineItemInput = z.infer<typeof AddCartLineItemInputSchema>;
export type UpdateCartLineItemInput = z.infer<
  typeof UpdateCartLineItemInputSchema
>;
export type AssociateCartCustomerInput = z.infer<
  typeof AssociateCartCustomerInputSchema
>;
export type SetCartAddressesInput = z.infer<typeof SetCartAddressesInputSchema>;
export type SetCartRegionChannelInput = z.infer<
  typeof SetCartRegionChannelInputSchema
>;
export type SetCartCheckoutReferencesInput = z.infer<
  typeof SetCartCheckoutReferencesInputSchema
>;
export type ApplyCartAdjustmentInput = z.infer<
  typeof ApplyCartAdjustmentInputSchema
>;
export type UpdateCartTotalsInput = z.infer<typeof UpdateCartTotalsInputSchema>;
export type CartIdentifierInput = z.infer<typeof CartIdentifierSchema>;
export type CartRecord = Omit<z.infer<typeof CartRecordSchema>, "id"> & {
  readonly id: CartId;
};
export type CartLineItemRecord = Omit<
  z.infer<typeof CartLineItemRecordSchema>,
  "cartId" | "id"
> & {
  readonly cartId: CartId;
  readonly id: CartLineItemId;
};
export type CartAdjustmentRecord = Omit<
  z.infer<typeof CartAdjustmentRecordSchema>,
  "cartId" | "id" | "lineItemId"
> & {
  readonly cartId: CartId;
  readonly id: CartAdjustmentId;
  readonly lineItemId: CartLineItemId | null;
};
export type CartAggregate = Omit<
  z.infer<typeof CartAggregateSchema>,
  "adjustments" | "cart" | "lineItems"
> & {
  readonly adjustments: readonly CartAdjustmentRecord[];
  readonly cart: CartRecord;
  readonly lineItems: readonly CartLineItemRecord[];
};
export type CartApiRecord = z.infer<typeof CartApiRecordSchema>;
export type CartLineItemApiRecord = z.infer<typeof CartLineItemApiRecordSchema>;
export type CartAdjustmentApiRecord = z.infer<
  typeof CartAdjustmentApiRecordSchema
>;
export type CartAggregateApiRecord = z.infer<typeof CartAggregateApiSchema>;

export interface CartRepository {
  findAdjustmentByIdempotencyKey(
    idempotencyKey: string
  ): Promise<CartAdjustmentRecord | null>;
  findCartById(id: CartId): Promise<CartRecord | null>;
  findLineItemById(
    id: CartLineItemId,
    cartId?: CartId
  ): Promise<CartLineItemRecord | null>;
  findLineItemByIdempotencyKey(
    idempotencyKey: string
  ): Promise<CartLineItemRecord | null>;
  getCartAggregate(id: CartId): Promise<CartAggregate | null>;
  listCarts(): Promise<readonly CartRecord[]>;
  removeLineItem(id: CartLineItemId, cartId?: CartId): Promise<void>;
  saveAdjustment(
    adjustment: CartAdjustmentRecord,
    idempotencyKey: string
  ): Promise<CartAdjustmentRecord>;
  saveCart(cart: CartRecord): Promise<CartRecord>;
  saveLineItem(
    item: CartLineItemRecord,
    idempotencyKey?: string
  ): Promise<CartLineItemRecord>;
}
