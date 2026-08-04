import {
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  CampaignRecordSchema,
  PromotionRecordSchema,
  PromotionRedemptionRecordSchema,
  PromotionRepositoryService,
  PromotionRuleRecordSchema,
  PromotionUsageLimitRecordSchema,
  createCampaignIdEffect,
  createPromotionAdjustmentIdEffect,
  createPromotionIdEffect,
  createPromotionRedemptionIdEffect,
  createPromotionRuleIdEffect,
  createPromotionUsageLimitIdEffect,
} from "@ecommerce/promotion";
import type {
  CampaignRecord,
  PromotionExpectedError,
  PromotionRecord,
  PromotionRedemptionRecord,
  PromotionRepository,
  PromotionRuleRecord,
  PromotionUsageLimitRecord,
} from "@ecommerce/promotion";
import { count, desc, eq, isNull } from "drizzle-orm";
import { Effect, Layer, Option, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import type { SqlError } from "effect/unstable/sql/SqlError";

import {
  CurrentPostgresTransactionService,
  PostgresDrizzleService,
} from "../../postgres-drizzle";
import type {
  PostgresDrizzleDatabase,
  PostgresDrizzleService as PostgresDrizzleServiceShape,
  PostgresDrizzleTransaction,
} from "../../postgres-drizzle";
import {
  PromotionCampaignPostgresInsertSchema,
  PromotionCampaignPostgresRowSchema,
  PromotionPostgresInsertSchema,
  PromotionPostgresRowSchema,
  PromotionRedemptionPostgresInsertSchema,
  PromotionRedemptionPostgresRowSchema,
  PromotionRulePostgresInsertSchema,
  PromotionRulePostgresRowSchema,
  PromotionUsageLimitPostgresInsertSchema,
  PromotionUsageLimitPostgresRowSchema,
  postgresPromotion,
  postgresPromotionCampaign,
  postgresPromotionRedemption,
  postgresPromotionRule,
  postgresPromotionUsageLimit,
} from "./schema";
import type {
  PromotionCampaignPostgresInsert,
  PromotionCampaignPostgresRow,
  PromotionPostgresInsert,
  PromotionPostgresRow,
  PromotionRedemptionPostgresInsert,
  PromotionRedemptionPostgresRow,
  PromotionRulePostgresInsert,
  PromotionRulePostgresRow,
  PromotionUsageLimitPostgresInsert,
  PromotionUsageLimitPostgresRow,
} from "./schema";

type PromotionPostgresExecutor =
  | PostgresDrizzleDatabase
  | PostgresDrizzleTransaction;

const promotionRepositoryName = "PromotionRepository";

const toRepositoryUnavailable =
  (operation: "read" | "write") => (): RepositoryUnavailable =>
    new RepositoryUnavailable({
      adapter: "effect-postgres",
      operation,
      repository: promotionRepositoryName,
    });

const toRepositoryDecodeFailure = (
  entity:
    | "promotion"
    | "promotion-campaign"
    | "promotion-redemption"
    | "promotion-rule"
    | "promotion-usage-limit",
  operation: "read" | "write"
): RepositoryDecodeFailure =>
  new RepositoryDecodeFailure({
    entity,
    operation,
    repository: promotionRepositoryName,
  });

const getPromotionExecutor = (
  service: PostgresDrizzleServiceShape
): EffectValue<PromotionPostgresExecutor> =>
  Effect.map(
    Effect.serviceOption(CurrentPostgresTransactionService),
    Option.getOrElse(() => service.database)
  );

export const toPromotionCampaignPostgresInsert = (
  campaign: CampaignRecord
): EffectValue<PromotionCampaignPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(PromotionCampaignPostgresInsertSchema)({
    createdAt: campaign.createdAt,
    description: campaign.description,
    id: campaign.id,
    metadataJson: campaign.metadata,
    name: campaign.name,
    updatedAt: campaign.updatedAt,
  }).pipe(
    Effect.map((insert) => insert as PromotionCampaignPostgresInsert),
    Effect.mapError(() =>
      toRepositoryDecodeFailure("promotion-campaign", "write")
    )
  );

export const toPromotionPostgresInsert = (
  promotion: PromotionRecord
): EffectValue<PromotionPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(PromotionPostgresInsertSchema)({
    applicationMethodJson: promotion.applicationMethod,
    campaignId: promotion.campaignId,
    code: promotion.code,
    createdAt: promotion.createdAt,
    endsAt: promotion.endsAt,
    id: promotion.id,
    metadataJson: promotion.metadata,
    startsAt: promotion.startsAt,
    status: promotion.status,
    title: promotion.title,
    updatedAt: promotion.updatedAt,
  }).pipe(
    Effect.map((insert) => insert as PromotionPostgresInsert),
    Effect.mapError(() => toRepositoryDecodeFailure("promotion", "write"))
  );

export const toPromotionRulePostgresInsert = (
  rule: PromotionRuleRecord
): EffectValue<PromotionRulePostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(PromotionRulePostgresInsertSchema)({
    attribute: rule.attribute,
    createdAt: rule.createdAt,
    id: rule.id,
    promotionId: rule.promotionId,
    updatedAt: rule.updatedAt,
    value: rule.value,
  }).pipe(
    Effect.map((insert) => insert as PromotionRulePostgresInsert),
    Effect.mapError(() => toRepositoryDecodeFailure("promotion-rule", "write"))
  );

export const toPromotionUsageLimitPostgresInsert = (
  usageLimit: PromotionUsageLimitRecord
): EffectValue<PromotionUsageLimitPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(PromotionUsageLimitPostgresInsertSchema)({
    createdAt: usageLimit.createdAt,
    id: usageLimit.id,
    limit: usageLimit.limit,
    promotionId: usageLimit.promotionId,
    scope: usageLimit.scope,
    updatedAt: usageLimit.updatedAt,
  }).pipe(
    Effect.map((insert) => insert as PromotionUsageLimitPostgresInsert),
    Effect.mapError(() =>
      toRepositoryDecodeFailure("promotion-usage-limit", "write")
    )
  );

export const toPromotionRedemptionPostgresInsert = (
  redemption: PromotionRedemptionRecord
): EffectValue<PromotionRedemptionPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(PromotionRedemptionPostgresInsertSchema)({
    adjustmentIdsJson: redemption.adjustmentIds,
    cartId: redemption.cartId,
    createdAt: redemption.createdAt,
    id: redemption.id,
    promotionId: redemption.promotionId,
  }).pipe(
    Effect.map((insert) => insert as PromotionRedemptionPostgresInsert),
    Effect.mapError(() =>
      toRepositoryDecodeFailure("promotion-redemption", "write")
    )
  );

const toCampaignRecord = (
  row: PromotionCampaignPostgresRow
): EffectValue<CampaignRecord, PromotionExpectedError> =>
  Effect.gen(function* toCampaignRecordEffect() {
    const id = yield* createCampaignIdEffect(row.id);

    return yield* Schema.decodeUnknownEffect(CampaignRecordSchema)({
      createdAt: row.createdAt,
      description: row.description,
      id,
      metadata: row.metadataJson,
      name: row.name,
      updatedAt: row.updatedAt,
    }).pipe(
      Effect.mapError(() =>
        toRepositoryDecodeFailure("promotion-campaign", "read")
      )
    );
  });

const toPromotionRecord = (
  row: PromotionPostgresRow
): EffectValue<PromotionRecord, PromotionExpectedError> =>
  Effect.gen(function* toPromotionRecordEffect() {
    const id = yield* createPromotionIdEffect(row.id);
    const campaignId = row.campaignId
      ? yield* createCampaignIdEffect(row.campaignId)
      : null;

    return yield* Schema.decodeUnknownEffect(PromotionRecordSchema)({
      applicationMethod: row.applicationMethodJson,
      campaignId,
      code: row.code,
      createdAt: row.createdAt,
      endsAt: row.endsAt,
      id,
      metadata: row.metadataJson,
      startsAt: row.startsAt,
      status: row.status,
      title: row.title,
      updatedAt: row.updatedAt,
    }).pipe(
      Effect.mapError(() => toRepositoryDecodeFailure("promotion", "read"))
    );
  });

const toRuleRecord = (
  row: PromotionRulePostgresRow
): EffectValue<PromotionRuleRecord, PromotionExpectedError> =>
  Effect.gen(function* toRuleRecordEffect() {
    const id = yield* createPromotionRuleIdEffect(row.id);
    const promotionId = yield* createPromotionIdEffect(row.promotionId);

    return yield* Schema.decodeUnknownEffect(PromotionRuleRecordSchema)({
      attribute: row.attribute,
      createdAt: row.createdAt,
      id,
      promotionId,
      updatedAt: row.updatedAt,
      value: row.value,
    }).pipe(
      Effect.mapError(() => toRepositoryDecodeFailure("promotion-rule", "read"))
    );
  });

const toUsageLimitRecord = (
  row: PromotionUsageLimitPostgresRow
): EffectValue<PromotionUsageLimitRecord, PromotionExpectedError> =>
  Effect.gen(function* toUsageLimitRecordEffect() {
    const id = yield* createPromotionUsageLimitIdEffect(row.id);
    const promotionId = yield* createPromotionIdEffect(row.promotionId);

    return yield* Schema.decodeUnknownEffect(PromotionUsageLimitRecordSchema)({
      createdAt: row.createdAt,
      id,
      limit: row.limit,
      promotionId,
      scope: row.scope,
      updatedAt: row.updatedAt,
    }).pipe(
      Effect.mapError(() =>
        toRepositoryDecodeFailure("promotion-usage-limit", "read")
      )
    );
  });

const toRedemptionRecord = (
  row: PromotionRedemptionPostgresRow
): EffectValue<PromotionRedemptionRecord, PromotionExpectedError> =>
  Effect.gen(function* toRedemptionRecordEffect() {
    const id = yield* createPromotionRedemptionIdEffect(row.id);
    const promotionId = yield* createPromotionIdEffect(row.promotionId);
    const adjustmentIds = yield* Effect.all(
      row.adjustmentIdsJson.map(createPromotionAdjustmentIdEffect)
    );

    return yield* Schema.decodeUnknownEffect(PromotionRedemptionRecordSchema)({
      adjustmentIds,
      cartId: row.cartId,
      createdAt: row.createdAt,
      id,
      promotionId,
    }).pipe(
      Effect.mapError(() =>
        toRepositoryDecodeFailure("promotion-redemption", "read")
      )
    );
  });

const decodeCampaignRow = (
  row: unknown
): EffectValue<CampaignRecord, PromotionExpectedError> =>
  Schema.decodeUnknownEffect(PromotionCampaignPostgresRowSchema)(row).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("promotion-campaign", "read")
    ),
    Effect.map((decoded) => decoded as PromotionCampaignPostgresRow),
    Effect.flatMap(toCampaignRecord)
  );

const decodePromotionRow = (
  row: unknown
): EffectValue<PromotionRecord, PromotionExpectedError> =>
  Schema.decodeUnknownEffect(PromotionPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("promotion", "read")),
    Effect.map((decoded) => decoded as PromotionPostgresRow),
    Effect.flatMap(toPromotionRecord)
  );

const decodeRuleRow = (
  row: unknown
): EffectValue<PromotionRuleRecord, PromotionExpectedError> =>
  Schema.decodeUnknownEffect(PromotionRulePostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("promotion-rule", "read")),
    Effect.map((decoded) => decoded as PromotionRulePostgresRow),
    Effect.flatMap(toRuleRecord)
  );

const decodeUsageLimitRow = (
  row: unknown
): EffectValue<PromotionUsageLimitRecord, PromotionExpectedError> =>
  Schema.decodeUnknownEffect(PromotionUsageLimitPostgresRowSchema)(row).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("promotion-usage-limit", "read")
    ),
    Effect.map((decoded) => decoded as PromotionUsageLimitPostgresRow),
    Effect.flatMap(toUsageLimitRecord)
  );

const decodeRedemptionRow = (
  row: unknown
): EffectValue<PromotionRedemptionRecord, PromotionExpectedError> =>
  Schema.decodeUnknownEffect(PromotionRedemptionPostgresRowSchema)(row).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("promotion-redemption", "read")
    ),
    Effect.map((decoded) => decoded as PromotionRedemptionPostgresRow),
    Effect.flatMap(toRedemptionRecord)
  );

/** Creates the PostgreSQL-backed promotion repository contract implementation. */
export const createPostgresPromotionRepository = (
  service: PostgresDrizzleServiceShape
): PromotionRepository => {
  const readRows = <TRow>(
    operation: (
      executor: PromotionPostgresExecutor
    ) => EffectValue<TRow[], unknown>
  ) =>
    Effect.gen(function* readPromotionRowsEffect() {
      const executor = yield* getPromotionExecutor(service);
      return yield* operation(executor).pipe(
        Effect.mapError(toRepositoryUnavailable("read"))
      );
    });

  const writeReturning = <TRow>(
    operation: (
      executor: PromotionPostgresExecutor
    ) => EffectValue<TRow[], unknown>
  ) =>
    Effect.gen(function* writePromotionRowsEffect() {
      const executor = yield* getPromotionExecutor(service);
      const rows = yield* operation(executor).pipe(
        Effect.mapError(toRepositoryUnavailable("write"))
      );
      const [row] = rows;

      if (!row) {
        return yield* toRepositoryDecodeFailure("promotion", "write");
      }

      return row;
    });

  return {
    countRedemptions: (promotionId) =>
      Effect.gen(function* countRedemptionsEffect() {
        const rows = yield* readRows((executor) =>
          executor
            .select({ value: count() })
            .from(postgresPromotionRedemption)
            .where(eq(postgresPromotionRedemption.promotionId, promotionId))
        );
        return rows[0]?.value ?? 0;
      }),
    findCampaignById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPromotionCampaign)
          .where(eq(postgresPromotionCampaign.id, id))
          .limit(1)
      ).pipe(
        Effect.flatMap((rows) =>
          rows[0] ? decodeCampaignRow(rows[0]) : Effect.succeed(null)
        )
      ),
    findPromotionByCode: (code) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPromotion)
          .where(eq(postgresPromotion.code, code.trim().toUpperCase()))
          .limit(1)
      ).pipe(
        Effect.flatMap((rows) =>
          rows[0] ? decodePromotionRow(rows[0]) : Effect.succeed(null)
        )
      ),
    findPromotionById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPromotion)
          .where(eq(postgresPromotion.id, id))
          .limit(1)
      ).pipe(
        Effect.flatMap((rows) =>
          rows[0] ? decodePromotionRow(rows[0]) : Effect.succeed(null)
        )
      ),
    findRulesByPromotionId: (promotionId) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPromotionRule)
          .where(eq(postgresPromotionRule.promotionId, promotionId))
          .orderBy(desc(postgresPromotionRule.createdAt))
      ).pipe(Effect.flatMap((rows) => Effect.all(rows.map(decodeRuleRow)))),
    findUsageLimitsByPromotionId: (promotionId) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPromotionUsageLimit)
          .where(eq(postgresPromotionUsageLimit.promotionId, promotionId))
          .orderBy(desc(postgresPromotionUsageLimit.createdAt))
      ).pipe(
        Effect.flatMap((rows) => Effect.all(rows.map(decodeUsageLimitRow)))
      ),
    get listAutomaticPromotions() {
      return readRows((executor) =>
        executor
          .select()
          .from(postgresPromotion)
          .where(isNull(postgresPromotion.code))
          .orderBy(desc(postgresPromotion.createdAt))
      ).pipe(
        Effect.flatMap((rows) => Effect.all(rows.map(decodePromotionRow)))
      );
    },
    listRedemptions: (promotionId) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresPromotionRedemption)
          .where(eq(postgresPromotionRedemption.promotionId, promotionId))
          .orderBy(desc(postgresPromotionRedemption.createdAt))
      ).pipe(
        Effect.flatMap((rows) => Effect.all(rows.map(decodeRedemptionRow)))
      ),
    saveCampaign: (campaign) =>
      Effect.gen(function* saveCampaignEffect() {
        const insert = yield* toPromotionCampaignPostgresInsert(campaign);
        const row = yield* writeReturning((executor) =>
          executor
            .insert(postgresPromotionCampaign)
            .values(insert)
            .onConflictDoUpdate({
              set: insert,
              target: postgresPromotionCampaign.id,
            })
            .returning()
        );
        return yield* decodeCampaignRow(row);
      }),
    savePromotion: (promotion) =>
      Effect.gen(function* savePromotionEffect() {
        const insert = yield* toPromotionPostgresInsert(promotion);
        const row = yield* writeReturning((executor) =>
          executor
            .insert(postgresPromotion)
            .values(insert)
            .onConflictDoUpdate({
              set: insert,
              target: postgresPromotion.id,
            })
            .returning()
        );
        return yield* decodePromotionRow(row);
      }),
    saveRedemption: (redemption) =>
      Effect.gen(function* saveRedemptionEffect() {
        const insert = yield* toPromotionRedemptionPostgresInsert(redemption);
        const row = yield* writeReturning((executor) =>
          executor
            .insert(postgresPromotionRedemption)
            .values(insert)
            .onConflictDoUpdate({
              set: insert,
              target: postgresPromotionRedemption.id,
            })
            .returning()
        );
        return yield* decodeRedemptionRow(row);
      }),
    saveRule: (rule) =>
      Effect.gen(function* saveRuleEffect() {
        const insert = yield* toPromotionRulePostgresInsert(rule);
        const row = yield* writeReturning((executor) =>
          executor
            .insert(postgresPromotionRule)
            .values(insert)
            .onConflictDoUpdate({
              set: insert,
              target: postgresPromotionRule.id,
            })
            .returning()
        );
        return yield* decodeRuleRow(row);
      }),
    saveUsageLimit: (usageLimit) =>
      Effect.gen(function* saveUsageLimitEffect() {
        const insert = yield* toPromotionUsageLimitPostgresInsert(usageLimit);
        const row = yield* writeReturning((executor) =>
          executor
            .insert(postgresPromotionUsageLimit)
            .values(insert)
            .onConflictDoUpdate({
              set: insert,
              target: postgresPromotionUsageLimit.id,
            })
            .returning()
        );
        return yield* decodeUsageLimitRow(row);
      }),
  };
};

export const createPostgresPromotionRepositoryLayer = () =>
  Layer.effect(
    PromotionRepositoryService,
    PostgresDrizzleService.use((service) =>
      Effect.succeed(createPostgresPromotionRepository(service))
    )
  );

/** Production PostgreSQL promotion repository Layer. */
export const PostgresPromotionRepositoryLayer =
  createPostgresPromotionRepositoryLayer();

/** Runs a promotion repository Effect inside the current PostgreSQL transaction. */
export const withPostgresPromotionTransaction = <A, E, R>(
  effect: EffectValue<A, E, R>
): EffectValue<A, E | SqlError, R | PostgresDrizzleService> =>
  PostgresDrizzleService.use((service) =>
    service.withTransaction(() => effect)
  );
