import {
  AddCartLineItemInputSchema,
  ApplyCartAdjustmentInputSchema,
  CartAggregateApiSchema,
  CartCacheOwnershipError,
  CartIdentifierSchema,
  CartInvalidIdentifier,
  CartLineItemNotFound,
  CartNotActive,
  CartNotFound,
  CartValidationFailure,
  CreateCartInputSchema,
  SetCartAddressesInputSchema,
  SetCartCheckoutReferencesInputSchema,
  SetCartRegionChannelInputSchema,
  UpdateCartLineItemInputSchema,
  UpdateCartTotalsInputSchema,
} from "@ecommerce/cart";
import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
  TransactionalMutationFailure,
} from "@ecommerce/core";
import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import {
  EffectHttpAuthMiddleware,
  EffectHttpExecutionMiddleware,
  EffectHttpForbidden,
  EffectHttpRequestContextMiddleware,
} from "./effect-http-middleware";
import { createApiSuccessSchema } from "./http-api-schemas";

const cartDomainErrors = [
  CartCacheOwnershipError.pipe(HttpApiSchema.status(403)),
  CartInvalidIdentifier.pipe(HttpApiSchema.status(400)),
  CartLineItemNotFound.pipe(HttpApiSchema.status(404)),
  CartNotActive.pipe(HttpApiSchema.status(409)),
  CartNotFound.pipe(HttpApiSchema.status(404)),
  CartValidationFailure.pipe(HttpApiSchema.status(400)),
] as const;

const cartPersistenceErrors = [
  RepositoryConflict.pipe(HttpApiSchema.status(409)),
  RepositoryDecodeFailure.pipe(HttpApiSchema.status(503)),
  RepositoryUnavailable.pipe(HttpApiSchema.status(503)),
  TransactionalMutationFailure.pipe(HttpApiSchema.status(503)),
] as const;

export const cartReadErrors = [
  EffectHttpForbidden,
  ...cartDomainErrors,
  ...cartPersistenceErrors,
] as const;

export const cartWriteErrors = [
  EffectHttpForbidden,
  ...cartDomainErrors,
  ...cartPersistenceErrors,
] as const;

export const CartAggregateApiSuccessSchema = createApiSuccessSchema(
  CartAggregateApiSchema
);
export const CartAggregateNullableApiSuccessSchema = createApiSuccessSchema(
  Schema.NullOr(CartAggregateApiSchema)
);

const cartAdminGroupIdentifier = "cartAdmin";

/**
 * Cart admin Effect HTTP contract for cart aggregate creation and mutation.
 * This is the canonical cart API surface; the legacy oRPC cart fragment is no
 * longer assembled after task 8.1.
 */
export const cartAdminHttpApiGroup = HttpApiGroup.make(cartAdminGroupIdentifier)
  .add(
    HttpApiEndpoint.post("cartCreate", "/admin/carts", {
      error: cartWriteErrors,
      payload: CreateCartInputSchema,
      success: CartAggregateApiSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("cartGet", "/admin/carts/get", {
      error: cartReadErrors,
      payload: CartIdentifierSchema,
      success: CartAggregateNullableApiSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("cartAddLineItem", "/admin/carts/line-items", {
      error: cartWriteErrors,
      payload: AddCartLineItemInputSchema,
      success: CartAggregateApiSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.patch("cartLineItemUpdate", "/admin/carts/line-items", {
      error: cartWriteErrors,
      payload: UpdateCartLineItemInputSchema,
      success: CartAggregateApiSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.patch("cartAddressesSet", "/admin/carts/addresses", {
      error: cartWriteErrors,
      payload: SetCartAddressesInputSchema,
      success: CartAggregateApiSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.patch(
      "cartRegionChannelSet",
      "/admin/carts/region-channel",
      {
        error: cartWriteErrors,
        payload: SetCartRegionChannelInputSchema,
        success: CartAggregateApiSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.patch(
      "cartCheckoutReferencesSet",
      "/admin/carts/checkout-references",
      {
        error: cartWriteErrors,
        payload: SetCartCheckoutReferencesInputSchema,
        success: CartAggregateApiSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post("cartAdjustmentApply", "/admin/carts/adjustments", {
      error: cartWriteErrors,
      payload: ApplyCartAdjustmentInputSchema,
      success: CartAggregateApiSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.patch("cartTotalsUpdate", "/admin/carts/totals", {
      error: cartWriteErrors,
      payload: UpdateCartTotalsInputSchema,
      success: CartAggregateApiSuccessSchema,
    })
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);
