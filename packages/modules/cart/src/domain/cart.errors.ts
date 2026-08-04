import type { RepositoryFailure } from "@ecommerce/core";
/* eslint-disable max-classes-per-file -- cart expected failures form one schema-backed module vocabulary */
import { Schema } from "effect";

import {
  CartIdSchema,
  CartLineItemIdSchema,
  CartTrimmedStringSchema,
} from "./cart.schema";

export class CartInvalidIdentifier extends Schema.TaggedErrorClass<CartInvalidIdentifier>()(
  "CartInvalidIdentifier",
  {
    expectedPrefix: CartTrimmedStringSchema,
    value: Schema.String,
  }
) {}

export class CartNotFound extends Schema.TaggedErrorClass<CartNotFound>()(
  "CartNotFound",
  {
    cartId: CartIdSchema,
  }
) {}

export class CartNotActive extends Schema.TaggedErrorClass<CartNotActive>()(
  "CartNotActive",
  {
    cartId: CartIdSchema,
  }
) {}

export class CartLineItemNotFound extends Schema.TaggedErrorClass<CartLineItemNotFound>()(
  "CartLineItemNotFound",
  {
    cartId: CartIdSchema,
    lineItemId: CartLineItemIdSchema,
  }
) {}

export class CartValidationFailure extends Schema.TaggedErrorClass<CartValidationFailure>()(
  "CartValidationFailure",
  {
    message: CartTrimmedStringSchema,
  }
) {}

export class CartCacheOwnershipError extends Schema.TaggedErrorClass<CartCacheOwnershipError>()(
  "CartCacheOwnershipError",
  {
    message: CartTrimmedStringSchema,
  }
) {}

export type CartExpectedError =
  | CartCacheOwnershipError
  | CartInvalidIdentifier
  | CartLineItemNotFound
  | CartNotActive
  | CartNotFound
  | CartValidationFailure
  | RepositoryFailure;
