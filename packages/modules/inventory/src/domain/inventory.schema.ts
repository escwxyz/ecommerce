import { z } from "zod";

const MetadataSchema = z.record(z.string(), z.unknown());
const ScopeSchema = z.object({
  salesChannelId: z.string().min(1).optional(),
  stockLocationId: z.string().min(1).startsWith("sloc_").optional(),
});
const CoordinationMetadataSchema = z.object({
  causationId: z.string().min(1).optional(),
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  workflowRunId: z.string().min(1).optional(),
});

export const InventoryItemRecordSchema = z.object({
  createdAt: z.date(),
  id: z.string().min(1).startsWith("iitem_"),
  metadata: MetadataSchema,
  sku: z.string().min(1),
  title: z.string().min(1),
  updatedAt: z.date(),
});

export const CreateInventoryItemInputSchema = z.object({
  metadata: MetadataSchema.optional(),
  sku: z.string().min(1),
  title: z.string().min(1),
});

export const StockLocationRecordSchema = z.object({
  createdAt: z.date(),
  id: z.string().min(1).startsWith("sloc_"),
  metadata: MetadataSchema,
  name: z.string().min(1),
  salesChannelIds: z.array(z.string().min(1)),
  updatedAt: z.date(),
});

export const CreateStockLocationInputSchema = z.object({
  metadata: MetadataSchema.optional(),
  name: z.string().min(1),
  salesChannelIds: z.array(z.string().min(1)).optional(),
});

export const InventoryLevelRecordSchema = z.object({
  createdAt: z.date(),
  id: z.string().min(1).startsWith("ilvl_"),
  inventoryItemId: z.string().min(1).startsWith("iitem_"),
  reservedQuantity: z.number().int().nonnegative(),
  stockLocationId: z.string().min(1).startsWith("sloc_"),
  stockedQuantity: z.number().int().nonnegative(),
  updatedAt: z.date(),
});

export const SetInventoryLevelInputSchema = z.object({
  inventoryItemId: z.string().min(1).startsWith("iitem_"),
  stockLocationId: z.string().min(1).startsWith("sloc_"),
  stockedQuantity: z.number().int().nonnegative(),
});

export const InventoryReservationStatusSchema = z.enum(["active", "released"]);

export const InventoryReservationRecordSchema = z.object({
  causationId: z.string().nullable(),
  correlationId: z.string().min(1),
  createdAt: z.date(),
  id: z.string().min(1).startsWith("ires_"),
  idempotencyKey: z.string().min(1),
  inventoryItemId: z.string().min(1).startsWith("iitem_"),
  quantity: z.number().int().positive(),
  releasedAt: z.date().nullable(),
  salesChannelId: z.string().nullable(),
  status: InventoryReservationStatusSchema,
  stockLocationId: z.string().min(1).startsWith("sloc_"),
  updatedAt: z.date(),
  workflowRunId: z.string().nullable(),
});

export const ReserveInventoryInputSchema = CoordinationMetadataSchema.extend({
  inventoryItemId: z.string().min(1).startsWith("iitem_"),
  quantity: z.number().int().positive(),
  salesChannelId: z.string().min(1).optional(),
  stockLocationId: z.string().min(1).startsWith("sloc_"),
});

export const InventoryAvailabilityInputSchema = ScopeSchema.extend({
  inventoryItemId: z.string().min(1).startsWith("iitem_"),
});

export const InventoryAvailabilitySchema = z.object({
  availableQuantity: z.number().int().nonnegative(),
  inventoryItemId: z.string().min(1).startsWith("iitem_"),
  reservedQuantity: z.number().int().nonnegative(),
  scopedBy: ScopeSchema,
  stockedQuantity: z.number().int().nonnegative(),
});

export const InventoryAdjustmentReasonSchema = z.enum([
  "correction",
  "restock",
  "shrinkage",
  "return",
]);

export const InventoryAdjustmentEventRecordSchema = z.object({
  adjustment: z.number().int(),
  causationId: z.string().nullable(),
  correlationId: z.string().min(1),
  createdAt: z.date(),
  id: z.string().min(1).startsWith("iadj_"),
  inventoryItemId: z.string().min(1).startsWith("iitem_"),
  reason: InventoryAdjustmentReasonSchema,
  stockLocationId: z.string().min(1).startsWith("sloc_"),
  updatedStockedQuantity: z.number().int().nonnegative(),
  workflowRunId: z.string().nullable(),
});

export const AdjustInventoryInputSchema = CoordinationMetadataSchema.extend({
  adjustment: z.number().int(),
  inventoryItemId: z.string().min(1).startsWith("iitem_"),
  reason: InventoryAdjustmentReasonSchema.default("correction"),
  stockLocationId: z.string().min(1).startsWith("sloc_"),
});

export const ReservationResultSchema = z.object({
  availability: InventoryAvailabilitySchema,
  duplicate: z.boolean(),
  reservation: InventoryReservationRecordSchema,
});

export const InventoryItemApiRecordSchema = InventoryItemRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const StockLocationApiRecordSchema = StockLocationRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const InventoryLevelApiRecordSchema = InventoryLevelRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const InventoryReservationApiRecordSchema =
  InventoryReservationRecordSchema.extend({
    createdAt: z.string().min(1),
    releasedAt: z.string().min(1).nullable(),
    updatedAt: z.string().min(1),
  });

export const InventoryAvailabilityApiSchema = InventoryAvailabilitySchema;

export const InventoryAdjustmentEventApiRecordSchema =
  InventoryAdjustmentEventRecordSchema.extend({
    createdAt: z.string().min(1),
  });

export const ReservationResultApiSchema = ReservationResultSchema.extend({
  reservation: InventoryReservationApiRecordSchema,
});
