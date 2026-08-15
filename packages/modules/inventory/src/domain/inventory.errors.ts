import type {
  RepositoryFailure,
  TransactionalMutationFailure,
} from "@ecommerce/core";
/* eslint-disable max-classes-per-file -- inventory expected failures form one schema-backed domain vocabulary */
import { Schema } from "effect";

import {
  InventoryItemIdSchema,
  InventoryTrimmedStringSchema,
  StockLocationIdSchema,
} from "./inventory.schema";

export class InventoryInvalidIdentifier extends Schema.TaggedErrorClass<InventoryInvalidIdentifier>()(
  "InventoryInvalidIdentifier",
  {
    expectedPrefix: InventoryTrimmedStringSchema,
    value: Schema.String,
  }
) {}

export class InventoryItemNotFound extends Schema.TaggedErrorClass<InventoryItemNotFound>()(
  "InventoryItemNotFound",
  {
    inventoryItemId: InventoryItemIdSchema,
  }
) {}

export class StockLocationNotFound extends Schema.TaggedErrorClass<StockLocationNotFound>()(
  "StockLocationNotFound",
  {
    stockLocationId: StockLocationIdSchema,
  }
) {}

export class InventoryLevelNotFound extends Schema.TaggedErrorClass<InventoryLevelNotFound>()(
  "InventoryLevelNotFound",
  {
    inventoryItemId: InventoryItemIdSchema,
    stockLocationId: StockLocationIdSchema,
  }
) {}

export class InventoryInsufficientStock extends Schema.TaggedErrorClass<InventoryInsufficientStock>()(
  "InventoryInsufficientStock",
  {
    inventoryItemId: InventoryItemIdSchema,
    stockLocationId: StockLocationIdSchema,
  }
) {}

export class InventoryValidationFailure extends Schema.TaggedErrorClass<InventoryValidationFailure>()(
  "InventoryValidationFailure",
  {
    message: InventoryTrimmedStringSchema,
  }
) {}

export type InventoryExpectedError =
  | InventoryInsufficientStock
  | InventoryInvalidIdentifier
  | InventoryItemNotFound
  | InventoryLevelNotFound
  | InventoryValidationFailure
  | RepositoryFailure
  | StockLocationNotFound
  | TransactionalMutationFailure;
