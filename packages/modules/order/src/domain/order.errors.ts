import type {
  RepositoryFailure,
  TransactionalMutationFailure,
} from "@ecommerce/core";
/* eslint-disable max-classes-per-file -- order expected failures form one schema-backed domain vocabulary */
import { Schema } from "effect";

import { OrderIdSchema, OrderTrimmedStringSchema } from "./order.schema";

export class OrderInvalidIdentifier extends Schema.TaggedErrorClass<OrderInvalidIdentifier>()(
  "OrderInvalidIdentifier",
  {
    expectedPrefix: OrderTrimmedStringSchema,
    value: Schema.String,
  }
) {}

export class OrderNotFound extends Schema.TaggedErrorClass<OrderNotFound>()(
  "OrderNotFound",
  {
    orderId: OrderIdSchema,
  }
) {}

export class OrderValidationFailure extends Schema.TaggedErrorClass<OrderValidationFailure>()(
  "OrderValidationFailure",
  {
    message: OrderTrimmedStringSchema,
  }
) {}

export type OrderExpectedError =
  | OrderInvalidIdentifier
  | OrderNotFound
  | OrderValidationFailure
  | RepositoryFailure
  | TransactionalMutationFailure;
