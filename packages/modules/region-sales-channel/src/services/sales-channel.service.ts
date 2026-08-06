import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import {
  ClockService,
  EventPublisherService,
  IdGeneratorService,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import { nanoid } from "nanoid";

import type {
  CheckPublishabilityInput,
  CreateSalesChannelInput,
  PublishProductInput,
  RegionSalesChannelExpectedError,
  SalesChannelId,
  SalesChannelPublishabilityResult,
  SalesChannelRecord,
  SalesChannelRepository,
  SalesChannelStatus,
} from "../domain";
import {
  SALES_CHANNEL_ID_PREFIX,
  RegionSalesChannelEventPublishFailure,
  SalesChannelNotFound,
  SalesChannelRepositoryService,
  SalesChannelValidationFailure,
  createSalesChannelIdEffect,
} from "../domain";

export const SALES_CHANNEL_CREATED_EVENT = "sales-channel.created" as const;
export const SALES_CHANNEL_PRODUCT_PUBLISHED_EVENT =
  "sales-channel.product-published" as const;

export interface SalesChannelCreatedEventPayload {
  readonly id: string;
  readonly status: SalesChannelStatus;
}

export interface SalesChannelProductPublishedEventPayload {
  readonly productId: string;
  readonly salesChannelId: string;
}

export type SalesChannelServiceFailure = RegionSalesChannelExpectedError;

export interface SalesChannelServiceShape {
  readonly checkProductPublishability: (
    input: CheckPublishabilityInput
  ) => EffectValue<
    SalesChannelPublishabilityResult,
    SalesChannelServiceFailure
  >;
  readonly createSalesChannel: (
    input: CreateSalesChannelInput
  ) => EffectValue<SalesChannelRecord, SalesChannelServiceFailure>;
  readonly getSalesChannelById: (
    id: SalesChannelId
  ) => EffectValue<SalesChannelRecord | null, SalesChannelServiceFailure>;
  readonly listSalesChannels: EffectValue<
    readonly SalesChannelRecord[],
    SalesChannelServiceFailure
  >;
  readonly publishProductToSalesChannel: (
    input: PublishProductInput
  ) => EffectValue<SalesChannelRecord, SalesChannelServiceFailure>;
}

export const SalesChannelService = Context.Service<SalesChannelServiceShape>(
  "@ecommerce/region-sales-channel/SalesChannelService"
);

export interface CreateSalesChannelServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly eventPublisher?: EventPublisherServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly repository: SalesChannelRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
});

const createNoopEventPublisher = (): EventPublisherServiceShape => ({
  publish: () => {
    // Sales-channel events are optional until a runtime event bus is composed.
  },
});

const normalizeStatus = (
  status: SalesChannelStatus | undefined
): SalesChannelStatus => status ?? "draft";

const createPrefixedId = (
  idGenerator: IdGeneratorServiceShape,
  prefix: string
): string => {
  const nextId = idGenerator.nextId();
  return nextId.startsWith(prefix) ? nextId : `${prefix}${nextId}`;
};

const toEventPublishFailure = ({
  entityId,
  eventName,
}: {
  readonly entityId: string;
  readonly eventName: string;
}): RegionSalesChannelEventPublishFailure =>
  new RegionSalesChannelEventPublishFailure({
    entityId,
    eventName,
    reason: "event-publish-failed",
  });

export const createSalesChannelService = ({
  clock = createDefaultClock(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  repository,
}: CreateSalesChannelServiceOptions): SalesChannelServiceShape => ({
  checkProductPublishability: (input) =>
    Effect.gen(function* checkProductPublishabilityEffect() {
      const channel = yield* repository.findSalesChannelById(
        input.salesChannelId
      );

      if (!channel) {
        return {
          publishable: false,
          reasons: ["sales-channel-not-found"],
        };
      }

      const reasons: string[] = [];

      if (channel.status !== "active") {
        reasons.push("sales-channel-not-active");
      }

      if (!channel.productIds.includes(input.productId)) {
        reasons.push("product-not-published-to-channel");
      }

      return {
        publishable: reasons.length === 0,
        reasons,
      };
    }),
  createSalesChannel: (input) =>
    Effect.gen(function* createSalesChannelEffect() {
      const name = input.name.trim();

      if (!name) {
        return yield* new SalesChannelValidationFailure({
          message: "Sales channel name is required.",
        });
      }

      const now = clock.now();
      const id = yield* createSalesChannelIdEffect(
        createPrefixedId(idGenerator, SALES_CHANNEL_ID_PREFIX)
      );
      const channel: SalesChannelRecord = {
        createdAt: now,
        description: input.description?.trim() || null,
        id,
        metadata: input.metadata ?? {},
        name,
        productIds: [],
        status: normalizeStatus(input.status),
        updatedAt: now,
      };
      const saved = yield* repository.saveSalesChannel(channel);

      yield* Effect.tryPromise({
        catch: () =>
          toEventPublishFailure({
            entityId: saved.id,
            eventName: SALES_CHANNEL_CREATED_EVENT,
          }),
        try: () =>
          Promise.resolve(
            eventPublisher.publish(
              createEventEnvelope({
                id: idGenerator.nextId(),
                name: SALES_CHANNEL_CREATED_EVENT,
                payload: {
                  id: saved.id,
                  status: saved.status,
                } satisfies SalesChannelCreatedEventPayload,
                sourceModule: "sales-channel",
                subject: {
                  id: saved.id,
                  type: "sales-channel",
                },
              })
            )
          ),
      });

      return saved;
    }),
  getSalesChannelById: (id) => repository.findSalesChannelById(id),
  listSalesChannels: repository.listSalesChannels,
  publishProductToSalesChannel: (input) =>
    Effect.gen(function* publishProductToSalesChannelEffect() {
      const channel = yield* repository.findSalesChannelById(
        input.salesChannelId
      );

      if (!channel) {
        return yield* new SalesChannelNotFound({
          salesChannelId: input.salesChannelId,
        });
      }

      if (channel.productIds.includes(input.productId)) {
        return channel;
      }

      const updated: SalesChannelRecord = {
        ...channel,
        productIds: [...channel.productIds, input.productId],
        updatedAt: clock.now(),
      };
      const saved = yield* repository.saveSalesChannel(updated);

      yield* Effect.tryPromise({
        catch: () =>
          toEventPublishFailure({
            entityId: saved.id,
            eventName: SALES_CHANNEL_PRODUCT_PUBLISHED_EVENT,
          }),
        try: () =>
          Promise.resolve(
            eventPublisher.publish(
              createEventEnvelope({
                id: idGenerator.nextId(),
                name: SALES_CHANNEL_PRODUCT_PUBLISHED_EVENT,
                payload: {
                  productId: input.productId,
                  salesChannelId: saved.id,
                } satisfies SalesChannelProductPublishedEventPayload,
                sourceModule: "sales-channel",
                subject: {
                  id: saved.id,
                  type: "sales-channel",
                },
              })
            )
          ),
      });

      return saved;
    }),
});

export const createSalesChannelRepositoryLayer = (
  repository: SalesChannelRepository
) => Layer.succeed(SalesChannelRepositoryService, repository);

export const createSalesChannelServiceFromDependenciesLayer = () =>
  Layer.effect(
    SalesChannelService,
    Effect.gen(function* salesChannelServiceLayerEffect() {
      const clock = yield* ClockService;
      const eventPublisher = yield* EventPublisherService;
      const idGenerator = yield* IdGeneratorService;
      const repository = yield* SalesChannelRepositoryService;

      return createSalesChannelService({
        clock,
        eventPublisher,
        idGenerator,
        repository,
      });
    })
  );

export const createSalesChannelServiceLayer = (
  service: SalesChannelServiceShape
) => Layer.succeed(SalesChannelService, service);
