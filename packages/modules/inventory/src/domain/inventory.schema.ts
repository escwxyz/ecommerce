import { Schema } from "effect";

const isCanonicalIsoDateTime = (value: string): boolean => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const createPrefixedIdentifierSchema = (prefix: string, brand: string) =>
  Schema.NonEmptyString.pipe(
    Schema.check(Schema.isStartsWith(prefix)),
    Schema.brand(brand)
  );

const createSerializedIdentifierSchema = (prefix: string) =>
  Schema.NonEmptyString.pipe(Schema.check(Schema.isStartsWith(prefix)));

export const InventoryTrimmedStringSchema = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(1))
);

export const InventoryIsoDateTimeStringSchema =
  InventoryTrimmedStringSchema.pipe(
    Schema.check(Schema.makeFilter(isCanonicalIsoDateTime))
  );

export const InventoryMetadataSchema = Schema.Record(
  Schema.String,
  Schema.Unknown
);

export const InventoryItemIdSchema = createPrefixedIdentifierSchema(
  "iitem_",
  "InventoryItemId"
);
export const InventoryItemSerializedIdSchema =
  createSerializedIdentifierSchema("iitem_");
export const StockLocationIdSchema = createPrefixedIdentifierSchema(
  "sloc_",
  "StockLocationId"
);
export const StockLocationSerializedIdSchema =
  createSerializedIdentifierSchema("sloc_");
export const InventoryLevelIdSchema = createPrefixedIdentifierSchema(
  "ilvl_",
  "InventoryLevelId"
);
export const InventoryLevelSerializedIdSchema =
  createSerializedIdentifierSchema("ilvl_");
export const InventoryReservationIdSchema = createPrefixedIdentifierSchema(
  "ires_",
  "InventoryReservationId"
);
export const InventoryReservationSerializedIdSchema =
  createSerializedIdentifierSchema("ires_");
export const InventoryAdjustmentEventIdSchema = createPrefixedIdentifierSchema(
  "iadj_",
  "InventoryAdjustmentEventId"
);
export const InventoryAdjustmentEventSerializedIdSchema =
  createSerializedIdentifierSchema("iadj_");

export const InventoryQuantitySchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
);

export const InventoryPositiveQuantitySchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0))
);

export const InventoryScopeSchema = Schema.Struct({
  salesChannelId: Schema.optional(InventoryTrimmedStringSchema),
  stockLocationId: Schema.optional(StockLocationIdSchema),
});

export const InventoryApiScopeSchema = Schema.Struct({
  salesChannelId: Schema.optional(InventoryTrimmedStringSchema),
  stockLocationId: Schema.optional(StockLocationSerializedIdSchema),
});

export const InventoryCoordinationMetadataSchema = Schema.Struct({
  causationId: Schema.optional(InventoryTrimmedStringSchema),
  correlationId: InventoryTrimmedStringSchema,
  idempotencyKey: InventoryTrimmedStringSchema,
  workflowRunId: Schema.optional(InventoryTrimmedStringSchema),
});

export const InventoryItemRecordSchema = Schema.Struct({
  createdAt: Schema.Date,
  id: InventoryItemIdSchema,
  metadata: InventoryMetadataSchema,
  sku: InventoryTrimmedStringSchema,
  title: InventoryTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const CreateInventoryItemInputSchema = Schema.Struct({
  metadata: Schema.optional(InventoryMetadataSchema),
  sku: InventoryTrimmedStringSchema,
  title: InventoryTrimmedStringSchema,
});

export const StockLocationRecordSchema = Schema.Struct({
  createdAt: Schema.Date,
  id: StockLocationIdSchema,
  metadata: InventoryMetadataSchema,
  name: InventoryTrimmedStringSchema,
  salesChannelIds: Schema.Array(InventoryTrimmedStringSchema),
  updatedAt: Schema.Date,
});

export const CreateStockLocationInputSchema = Schema.Struct({
  metadata: Schema.optional(InventoryMetadataSchema),
  name: InventoryTrimmedStringSchema,
  salesChannelIds: Schema.optional(Schema.Array(InventoryTrimmedStringSchema)),
});

export const InventoryLevelRecordSchema = Schema.Struct({
  createdAt: Schema.Date,
  id: InventoryLevelIdSchema,
  inventoryItemId: InventoryItemIdSchema,
  reservedQuantity: InventoryQuantitySchema,
  stockLocationId: StockLocationIdSchema,
  stockedQuantity: InventoryQuantitySchema,
  updatedAt: Schema.Date,
});

export const SetInventoryLevelInputSchema = Schema.Struct({
  inventoryItemId: InventoryItemIdSchema,
  stockLocationId: StockLocationIdSchema,
  stockedQuantity: InventoryQuantitySchema,
});

export const InventoryReservationStatusSchema = Schema.Literals([
  "active",
  "released",
]);

export const InventoryReservationRecordSchema = Schema.Struct({
  causationId: Schema.NullOr(InventoryTrimmedStringSchema),
  correlationId: InventoryTrimmedStringSchema,
  createdAt: Schema.Date,
  id: InventoryReservationIdSchema,
  idempotencyKey: InventoryTrimmedStringSchema,
  inventoryItemId: InventoryItemIdSchema,
  quantity: InventoryPositiveQuantitySchema,
  releasedAt: Schema.NullOr(Schema.Date),
  salesChannelId: Schema.NullOr(InventoryTrimmedStringSchema),
  status: InventoryReservationStatusSchema,
  stockLocationId: StockLocationIdSchema,
  updatedAt: Schema.Date,
  workflowRunId: Schema.NullOr(InventoryTrimmedStringSchema),
});

export const ReserveInventoryInputSchema = Schema.Struct({
  causationId: Schema.optional(InventoryTrimmedStringSchema),
  correlationId: InventoryTrimmedStringSchema,
  idempotencyKey: InventoryTrimmedStringSchema,
  inventoryItemId: InventoryItemIdSchema,
  quantity: InventoryPositiveQuantitySchema,
  salesChannelId: Schema.optional(InventoryTrimmedStringSchema),
  stockLocationId: StockLocationIdSchema,
  workflowRunId: Schema.optional(InventoryTrimmedStringSchema),
});

export const InventoryAvailabilityInputSchema = Schema.Struct({
  inventoryItemId: InventoryItemIdSchema,
  salesChannelId: Schema.optional(InventoryTrimmedStringSchema),
  stockLocationId: Schema.optional(StockLocationIdSchema),
});

export const InventoryAvailabilitySchema = Schema.Struct({
  availableQuantity: InventoryQuantitySchema,
  inventoryItemId: InventoryItemIdSchema,
  reservedQuantity: InventoryQuantitySchema,
  scopedBy: InventoryScopeSchema,
  stockedQuantity: InventoryQuantitySchema,
});

export const InventoryAdjustmentReasonSchema = Schema.Literals([
  "correction",
  "restock",
  "shrinkage",
  "return",
]);

export const InventoryAdjustmentEventRecordSchema = Schema.Struct({
  adjustment: Schema.Number.pipe(Schema.check(Schema.isInt())),
  causationId: Schema.NullOr(InventoryTrimmedStringSchema),
  correlationId: InventoryTrimmedStringSchema,
  createdAt: Schema.Date,
  id: InventoryAdjustmentEventIdSchema,
  idempotencyKey: InventoryTrimmedStringSchema,
  inventoryItemId: InventoryItemIdSchema,
  reason: InventoryAdjustmentReasonSchema,
  stockLocationId: StockLocationIdSchema,
  updatedStockedQuantity: InventoryQuantitySchema,
  workflowRunId: Schema.NullOr(InventoryTrimmedStringSchema),
});

export const AdjustInventoryInputSchema = Schema.Struct({
  adjustment: Schema.Number.pipe(Schema.check(Schema.isInt())),
  causationId: Schema.optional(InventoryTrimmedStringSchema),
  correlationId: InventoryTrimmedStringSchema,
  idempotencyKey: InventoryTrimmedStringSchema,
  inventoryItemId: InventoryItemIdSchema,
  reason: Schema.optional(InventoryAdjustmentReasonSchema),
  stockLocationId: StockLocationIdSchema,
  workflowRunId: Schema.optional(InventoryTrimmedStringSchema),
});

export const ReservationResultSchema = Schema.Struct({
  availability: InventoryAvailabilitySchema,
  duplicate: Schema.Boolean,
  reservation: InventoryReservationRecordSchema,
});

export const InventoryItemApiRecordSchema = Schema.Struct({
  createdAt: InventoryIsoDateTimeStringSchema,
  id: InventoryItemSerializedIdSchema,
  metadata: InventoryMetadataSchema,
  sku: InventoryTrimmedStringSchema,
  title: InventoryTrimmedStringSchema,
  updatedAt: InventoryIsoDateTimeStringSchema,
});

export const StockLocationApiRecordSchema = Schema.Struct({
  createdAt: InventoryIsoDateTimeStringSchema,
  id: StockLocationSerializedIdSchema,
  metadata: InventoryMetadataSchema,
  name: InventoryTrimmedStringSchema,
  salesChannelIds: Schema.Array(InventoryTrimmedStringSchema),
  updatedAt: InventoryIsoDateTimeStringSchema,
});

export const InventoryLevelApiRecordSchema = Schema.Struct({
  createdAt: InventoryIsoDateTimeStringSchema,
  id: InventoryLevelSerializedIdSchema,
  inventoryItemId: InventoryItemSerializedIdSchema,
  reservedQuantity: InventoryQuantitySchema,
  stockLocationId: StockLocationSerializedIdSchema,
  stockedQuantity: InventoryQuantitySchema,
  updatedAt: InventoryIsoDateTimeStringSchema,
});

export const InventoryReservationApiRecordSchema = Schema.Struct({
  causationId: Schema.NullOr(InventoryTrimmedStringSchema),
  correlationId: InventoryTrimmedStringSchema,
  createdAt: InventoryIsoDateTimeStringSchema,
  id: InventoryReservationSerializedIdSchema,
  idempotencyKey: InventoryTrimmedStringSchema,
  inventoryItemId: InventoryItemSerializedIdSchema,
  quantity: InventoryPositiveQuantitySchema,
  releasedAt: Schema.NullOr(InventoryIsoDateTimeStringSchema),
  salesChannelId: Schema.NullOr(InventoryTrimmedStringSchema),
  status: InventoryReservationStatusSchema,
  stockLocationId: StockLocationSerializedIdSchema,
  updatedAt: InventoryIsoDateTimeStringSchema,
  workflowRunId: Schema.NullOr(InventoryTrimmedStringSchema),
});

export const InventoryAvailabilityApiSchema = Schema.Struct({
  availableQuantity: InventoryQuantitySchema,
  inventoryItemId: InventoryItemSerializedIdSchema,
  reservedQuantity: InventoryQuantitySchema,
  scopedBy: InventoryApiScopeSchema,
  stockedQuantity: InventoryQuantitySchema,
});

export const InventoryAdjustmentEventApiRecordSchema = Schema.Struct({
  adjustment: Schema.Number.pipe(Schema.check(Schema.isInt())),
  causationId: Schema.NullOr(InventoryTrimmedStringSchema),
  correlationId: InventoryTrimmedStringSchema,
  createdAt: InventoryIsoDateTimeStringSchema,
  id: InventoryAdjustmentEventSerializedIdSchema,
  idempotencyKey: InventoryTrimmedStringSchema,
  inventoryItemId: InventoryItemSerializedIdSchema,
  reason: InventoryAdjustmentReasonSchema,
  stockLocationId: StockLocationSerializedIdSchema,
  updatedStockedQuantity: InventoryQuantitySchema,
  workflowRunId: Schema.NullOr(InventoryTrimmedStringSchema),
});

export const ReservationResultApiSchema = Schema.Struct({
  availability: InventoryAvailabilityApiSchema,
  duplicate: Schema.Boolean,
  reservation: InventoryReservationApiRecordSchema,
});
