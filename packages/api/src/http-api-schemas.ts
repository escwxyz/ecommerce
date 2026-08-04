import { Schema } from "effect";

const MAX_PAGE_LIMIT = 100;

/**
 * Public API pagination limit. Endpoints may choose a lower default, but shared
 * HTTP schemas keep the platform-wide upper bound stable for OpenAPI and SDKs.
 */
export const ApiPageLimit = Schema.Int.check(
  Schema.isBetween({ maximum: MAX_PAGE_LIMIT, minimum: 1 })
).annotate({
  description: "Requested page size, bounded to protect shared API surfaces.",
  examples: [20],
});

/** Zero-based item offset used by list endpoints. */
export const ApiPageOffset = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0)
).annotate({
  description: "Zero-based offset into a list response.",
  examples: [0],
});

/** Common query object for offset-based list endpoints. */
export const ApiPaginationRequest = Schema.Struct({
  limit: ApiPageLimit,
  offset: ApiPageOffset,
}).annotate({
  description: "Shared offset pagination query contract.",
});

/** Response metadata emitted by offset-paginated list endpoints. */
export const ApiPaginationMeta = Schema.Struct({
  hasMore: Schema.Boolean,
  limit: ApiPageLimit,
  offset: ApiPageOffset,
  total: ApiPageOffset,
}).annotate({
  description: "Shared pagination metadata for list responses.",
});

/** Correlation fields propagated across HTTP, Service Bindings, SQL, workflows, and telemetry. */
export const ApiRequestIdentity = Schema.Struct({
  actorId: Schema.optional(Schema.NonEmptyString),
  correlationId: Schema.NonEmptyString,
  requestId: Schema.NonEmptyString,
  sessionId: Schema.optional(Schema.NonEmptyString),
  traceId: Schema.optional(Schema.NonEmptyString),
}).annotate({
  description:
    "Serialized request identity visible at API boundaries before auth-specific contracts are applied.",
});

/** Minimal success metadata shared by ordinary and paginated success envelopes. */
export const ApiSuccessMeta = Schema.Struct({
  request: ApiRequestIdentity,
}).annotate({
  description: "Shared metadata included with successful API responses.",
});

/** JSON scalar vocabulary allowed in sanitized serialized error details. */
export const ApiErrorDetailValue = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
]).annotate({
  description:
    "Bounded JSON scalar value for public error details; raw causes and nested provider payloads are not serialized.",
});

/** Sanitized field-level or machine-readable details for expected API failures. */
export const ApiErrorDetails = Schema.Record(
  Schema.String,
  ApiErrorDetailValue
).annotate({
  description: "Sanitized public details for a serialized API error.",
});

/** Serialized expected failure body used by HTTP and SDK transports. */
export const SerializedApiError = Schema.Struct({
  error: Schema.Struct({
    code: Schema.NonEmptyString,
    details: Schema.optional(ApiErrorDetails),
    message: Schema.NonEmptyString,
    request: ApiRequestIdentity,
  }),
  success: Schema.Literal(false),
}).annotate({
  description: "Shared sanitized API error envelope.",
});

/** Creates the standard success envelope for a concrete API response payload schema. */
export const createApiSuccessSchema = <const TData extends Schema.Constraint>(
  data: TData
) =>
  Schema.Struct({
    data,
    meta: ApiSuccessMeta,
    success: Schema.Literal(true),
  }).annotate({
    description: "Shared successful API response envelope.",
  });

/** Creates the standard list success envelope for an item API response schema. */
export const createApiPaginatedSuccessSchema = <
  const TItem extends Schema.Constraint,
>(
  item: TItem
) =>
  Schema.Struct({
    data: Schema.Array(item),
    meta: Schema.Struct({
      pagination: ApiPaginationMeta,
      request: ApiRequestIdentity,
    }),
    success: Schema.Literal(true),
  }).annotate({
    description: "Shared paginated successful API response envelope.",
  });
