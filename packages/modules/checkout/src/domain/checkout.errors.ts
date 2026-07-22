/* eslint-disable max-classes-per-file -- checkout expected failures form one schema-backed domain vocabulary */
import { Schema } from "effect";

import { CheckoutTrimmedStringSchema } from "./checkout.schema";

export class CheckoutCompletionFailure extends Schema.TaggedErrorClass<CheckoutCompletionFailure>()(
  "CheckoutCompletionFailure",
  {
    message: CheckoutTrimmedStringSchema,
    workflowRunId: CheckoutTrimmedStringSchema,
  }
) {}

export type CheckoutExpectedError = CheckoutCompletionFailure;
