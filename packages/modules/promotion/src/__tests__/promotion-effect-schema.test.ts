import { describe, expect, it } from "bun:test";

import { Schema } from "effect";

import {
  PromotionApiRecordSchema,
  PromotionRecordSchema,
  createCampaignId,
  createPromotionId,
} from "../domain";

describe("promotion Effect schemas", () => {
  it("decodes valid domain and API promotion records", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    expect(
      Schema.decodeUnknownSync(PromotionRecordSchema)({
        applicationMethod: {
          allocation: "cart",
          target: "subtotal",
          type: "percentage",
          value: 10,
        },
        campaignId: createCampaignId("pcamp_schema"),
        code: "SAVE10",
        createdAt: now,
        endsAt: null,
        id: createPromotionId("promo_schema"),
        metadata: {},
        startsAt: null,
        status: "active",
        title: "Save 10",
        updatedAt: now,
      })
    ).toMatchObject({
      code: "SAVE10",
      id: "promo_schema",
    });

    expect(
      Schema.decodeUnknownSync(PromotionApiRecordSchema)({
        applicationMethod: {
          allocation: "cart",
          target: "subtotal",
          type: "percentage",
          value: 10,
        },
        campaignId: "pcamp_schema",
        code: "SAVE10",
        createdAt: "2026-01-01T00:00:00.000Z",
        endsAt: null,
        id: "promo_schema",
        metadata: {},
        startsAt: null,
        status: "active",
        title: "Save 10",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toMatchObject({
      code: "SAVE10",
      id: "promo_schema",
    });
  });

  it("rejects invalid identifiers and non-canonical API datetimes", () => {
    expect(() =>
      Schema.decodeUnknownSync(PromotionApiRecordSchema)({
        applicationMethod: {
          allocation: "cart",
          target: "subtotal",
          type: "percentage",
          value: 10,
        },
        campaignId: "campaign_schema",
        code: "SAVE10",
        createdAt: "2026-01-01",
        endsAt: null,
        id: "promotion_schema",
        metadata: {},
        startsAt: null,
        status: "active",
        title: "Save 10",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toThrow();
  });
});
