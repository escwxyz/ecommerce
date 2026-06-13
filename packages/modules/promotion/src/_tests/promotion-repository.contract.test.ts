import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";

import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import { createD1PromotionRepository } from "../adapters/d1";
import {
  createCampaignId,
  createPromotionId,
  createPromotionRedemptionId,
  createPromotionRuleId,
  createPromotionUsageLimitId,
  promotionMigration,
  type PromotionDatabase,
  type PromotionRepository,
} from "../domain";
import { createResettableInMemoryPromotionRepository } from "../repositories";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

const createCampaign = () => ({
  createdAt,
  description: null,
  id: createCampaignId("pcamp_contract"),
  metadata: {},
  name: "Contract campaign",
  updatedAt: createdAt,
});

const createPromotion = (
  campaignId: ReturnType<typeof createCampaign>["id"]
) => ({
  applicationMethod: {
    allocation: "cart" as const,
    target: "subtotal" as const,
    type: "fixed" as const,
    value: 500,
  },
  campaignId,
  code: "SAVE500",
  createdAt,
  endsAt: null,
  id: createPromotionId("promo_contract"),
  metadata: {},
  startsAt: null,
  status: "active" as const,
  title: "Save 500",
  updatedAt: createdAt,
});

interface RepositoryTestContext {
  readonly cleanup?: () => void;
  readonly repository: PromotionRepository;
}

const runPromotionRepositoryContract = (
  name: string,
  createContext: () => Promise<RepositoryTestContext> | RepositoryTestContext
) => {
  describe(name, () => {
    let cleanup: (() => void) | undefined;

    afterEach(() => {
      cleanup?.();
      cleanup = undefined;
    });

    const setup = async () => {
      const context = await createContext();
      cleanup = context.cleanup;
      return context.repository;
    };

    it("saves and reads campaigns and promotions by id and code", async () => {
      const repository = await setup();
      const campaign = createCampaign();
      const promotion = createPromotion(campaign.id);

      await repository.saveCampaign(campaign);
      await expect(repository.savePromotion(promotion)).resolves.toEqual(
        promotion
      );
      await expect(repository.findCampaignById(campaign.id)).resolves.toEqual(
        campaign
      );
      await expect(repository.findPromotionByCode("save500")).resolves.toEqual(
        promotion
      );
      await expect(repository.findPromotionById(promotion.id)).resolves.toEqual(
        promotion
      );
    });

    it("saves rules, usage limits, and automatic promotions", async () => {
      const repository = await setup();
      const campaign = createCampaign();
      const promotion = createPromotion(campaign.id);
      const automaticPromotion = {
        ...createPromotion(campaign.id),
        code: null,
        id: createPromotionId("promo_automatic"),
      };
      const rule = {
        attribute: "region",
        createdAt,
        id: createPromotionRuleId("prule_contract"),
        promotionId: promotion.id,
        updatedAt: createdAt,
        value: "EU",
      };
      const usageLimit = {
        createdAt,
        id: createPromotionUsageLimitId("plimit_contract"),
        limit: 1,
        promotionId: promotion.id,
        scope: "total" as const,
        updatedAt: createdAt,
      };

      await repository.saveCampaign(campaign);
      await repository.savePromotion(promotion);
      await repository.savePromotion(automaticPromotion);
      await expect(repository.saveRule(rule)).resolves.toEqual(rule);
      await expect(repository.saveUsageLimit(usageLimit)).resolves.toEqual(
        usageLimit
      );
      await expect(
        repository.findRulesByPromotionId(promotion.id)
      ).resolves.toEqual([rule]);
      await expect(
        repository.findUsageLimitsByPromotionId(promotion.id)
      ).resolves.toEqual([usageLimit]);
      await expect(repository.listAutomaticPromotions()).resolves.toEqual([
        automaticPromotion,
      ]);
    });

    it("counts redemptions for promotion usage limits", async () => {
      const repository = await setup();
      const promotionId = createPromotionId("promo_contract");
      const redemption = {
        adjustmentIds: ["padj_contract"],
        cartId: "cart_contract",
        createdAt,
        id: createPromotionRedemptionId("pred_contract"),
        promotionId,
      };

      await expect(repository.countRedemptions(promotionId)).resolves.toBe(0);
      await repository.saveRedemption(redemption);
      await expect(repository.countRedemptions(promotionId)).resolves.toBe(1);
      await expect(repository.listRedemptions(promotionId)).resolves.toEqual([
        redemption,
      ]);
    });
  });
};

const createFakeD1Binding = (sqlite: Database) => ({
  batch: async (statements: readonly FakeD1PreparedStatement[]) =>
    Promise.all(statements.map((statement) => statement.all())),
  exec: async (query: string) => {
    sqlite.exec(query);
    return { count: 0, duration: 0 };
  },
  prepare: (query: string) => new FakeD1PreparedStatement(sqlite, query),
});

type FakeD1Binding = ConstructorParameters<typeof D1Dialect>[0]["database"];

const createKyselyD1PromotionDatabase = (sqlite: Database) =>
  new Kysely<PromotionDatabase>({
    dialect: new D1Dialect({
      database: createFakeD1Binding(sqlite) as unknown as FakeD1Binding,
    }),
  });

class FakeD1PreparedStatement {
  readonly #query: string;
  readonly #sqlite: Database;
  readonly #values: readonly SQLQueryBindings[];

  constructor(
    sqlite: Database,
    query: string,
    values: readonly SQLQueryBindings[] = []
  ) {
    this.#query = query;
    this.#sqlite = sqlite;
    this.#values = values;
  }

  bind(...values: readonly SQLQueryBindings[]): FakeD1PreparedStatement {
    return new FakeD1PreparedStatement(this.#sqlite, this.#query, values);
  }

  all() {
    const normalizedQuery = this.#query.trim().toLowerCase();
    const statement = this.#sqlite.query(this.#query);

    if (
      normalizedQuery.startsWith("select") ||
      normalizedQuery.startsWith("pragma")
    ) {
      return Promise.resolve({
        meta: { changes: 0, last_row_id: 0 },
        results: statement.all(...this.#values),
        success: true,
      });
    }

    const result = statement.run(...this.#values);
    return Promise.resolve({
      meta: {
        changes: result.changes,
        last_row_id: Number(result.lastInsertRowid),
      },
      results: [],
      success: true,
    });
  }
}

runPromotionRepositoryContract("in-memory promotion repository", () => ({
  repository: createResettableInMemoryPromotionRepository(),
}));

runPromotionRepositoryContract("D1 promotion repository", async () => {
  const sqlite = new Database(":memory:");
  const db = createKyselyD1PromotionDatabase(sqlite);
  await promotionMigration.up(db);

  return {
    cleanup: () => sqlite.close(),
    repository: createD1PromotionRepository({ db }),
  };
});

describe("promotion schema contribution", () => {
  it("creates promotion tables through the Kysely migration", async () => {
    const sqlite = new Database(":memory:");
    const db = createKyselyD1PromotionDatabase(sqlite);

    await promotionMigration.up(db);

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "promotion_campaign",
        "promotion_promotion",
        "promotion_rule",
        "promotion_usage_limit",
        "promotion_redemption",
      ])
    );

    sqlite.close();
  });
});
