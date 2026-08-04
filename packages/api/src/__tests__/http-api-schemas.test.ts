import { describe, expect, it } from "bun:test";

import { Exit, Schema } from "effect";

import {
  ApiPaginationRequest,
  SerializedApiError,
  createApiPaginatedSuccessSchema,
  createApiSuccessSchema,
} from "../http-api-schemas";

const ProductSummary = Schema.Struct({
  id: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
});

const request = {
  correlationId: "corr_1",
  requestId: "req_1",
  traceId: "trace_1",
};

describe("shared Effect HTTP API schemas", () => {
  it("decodes bounded offset pagination requests", () => {
    const pagination = Schema.decodeUnknownSync(ApiPaginationRequest)({
      limit: 20,
      offset: 40,
    });

    expect(pagination).toEqual({ limit: 20, offset: 40 });
  });

  it("rejects invalid pagination bounds before handlers run", () => {
    const zeroLimit = Schema.decodeUnknownExit(ApiPaginationRequest)({
      limit: 0,
      offset: 0,
    });
    const overLimit = Schema.decodeUnknownExit(ApiPaginationRequest)({
      limit: 101,
      offset: 0,
    });
    const negativeOffset = Schema.decodeUnknownExit(ApiPaginationRequest)({
      limit: 20,
      offset: -1,
    });

    expect(Exit.isFailure(zeroLimit)).toBe(true);
    expect(Exit.isFailure(overLimit)).toBe(true);
    expect(Exit.isFailure(negativeOffset)).toBe(true);
  });

  it("creates standard success envelopes around concrete payload schemas", () => {
    const ProductSuccess = createApiSuccessSchema(ProductSummary);

    const response = Schema.decodeUnknownSync(ProductSuccess)({
      data: {
        id: "prod_1",
        title: "Thermal Mug",
      },
      meta: { request },
      success: true,
    });

    expect(response.data.title).toBe("Thermal Mug");
    expect(response.meta.request.requestId).toBe("req_1");
  });

  it("creates paginated success envelopes with shared pagination metadata", () => {
    const ProductListSuccess = createApiPaginatedSuccessSchema(ProductSummary);

    const response = Schema.decodeUnknownSync(ProductListSuccess)({
      data: [
        {
          id: "prod_1",
          title: "Thermal Mug",
        },
      ],
      meta: {
        pagination: {
          hasMore: false,
          limit: 20,
          offset: 0,
          total: 1,
        },
        request,
      },
      success: true,
    });

    expect(response.data).toHaveLength(1);
    expect(response.meta.pagination.total).toBe(1);
  });

  it("decodes sanitized serialized error envelopes", () => {
    const error = Schema.decodeUnknownSync(SerializedApiError)({
      error: {
        code: "StoreNotFound",
        details: {
          retryable: false,
          storeId: "store_missing",
        },
        message: "Store was not found.",
        request,
      },
      success: false,
    });

    expect(error.error.code).toBe("StoreNotFound");
    expect(error.error.details?.storeId).toBe("store_missing");
  });

  it("rejects non-scalar serialized error details", () => {
    const result = Schema.decodeUnknownExit(SerializedApiError)({
      error: {
        code: "ProviderFailure",
        details: {
          providerBody: { raw: "not public" },
        },
        message: "Provider failed.",
        request,
      },
      success: false,
    });

    expect(Exit.isFailure(result)).toBe(true);
  });
});
