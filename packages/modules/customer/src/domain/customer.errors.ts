import type { RepositoryFailure } from "@ecommerce/core";
/* eslint-disable max-classes-per-file -- customer expected failures form one schema-backed domain vocabulary */
import { Schema } from "effect";

import {
  CustomerEmailSchema,
  CustomerGroupIdSchema,
  CustomerIdSchema,
  CustomerTrimmedStringSchema,
} from "./customer.schema";

export class CustomerInvalidIdentifier extends Schema.TaggedErrorClass<CustomerInvalidIdentifier>()(
  "CustomerInvalidIdentifier",
  {
    expectedPrefix: Schema.NonEmptyString,
    value: Schema.String,
  }
) {}

export class CustomerNotFound extends Schema.TaggedErrorClass<CustomerNotFound>()(
  "CustomerNotFound",
  {
    customerId: CustomerIdSchema,
  }
) {}

export class CustomerGroupNotFound extends Schema.TaggedErrorClass<CustomerGroupNotFound>()(
  "CustomerGroupNotFound",
  {
    groupId: CustomerGroupIdSchema,
  }
) {}

export class CustomerEmailConflict extends Schema.TaggedErrorClass<CustomerEmailConflict>()(
  "CustomerEmailConflict",
  {
    email: CustomerEmailSchema,
  }
) {}

export class CustomerAuthUserConflict extends Schema.TaggedErrorClass<CustomerAuthUserConflict>()(
  "CustomerAuthUserConflict",
  {
    authUserId: CustomerTrimmedStringSchema,
  }
) {}

export type CustomerExpectedError =
  | CustomerAuthUserConflict
  | CustomerEmailConflict
  | CustomerGroupNotFound
  | CustomerInvalidIdentifier
  | CustomerNotFound
  | RepositoryFailure;
