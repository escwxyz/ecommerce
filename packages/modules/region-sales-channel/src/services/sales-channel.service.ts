import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import { Context, Layer } from "effect";
import { nanoid } from "nanoid";

import type {
  CheckPublishabilityInput,
  CreateSalesChannelInput,
  PublishProductInput,
  SalesChannelId,
  SalesChannelPublishabilityResult,
  SalesChannelRecord,
  SalesChannelRepository,
  SalesChannelStatus,
} from "../domain";
import { SALES_CHANNEL_ID_PREFIX, createSalesChannelId } from "../domain";
import { defaultRegionSalesChannelRepository } from "../repositories";

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

export interface SalesChannelServiceShape {
  createSalesChannel(
    input: CreateSalesChannelInput
  ): Promise<SalesChannelRecord>;
  getSalesChannelById(id: SalesChannelId): Promise<SalesChannelRecord | null>;
  listSalesChannels(): Promise<readonly SalesChannelRecord[]>;
  publishProductToSalesChannel(
    input: PublishProductInput
  ): Promise<SalesChannelRecord>;
  checkProductPublishability(
    input: CheckPublishabilityInput
  ): Promise<SalesChannelPublishabilityResult>;
}

export const SalesChannelService = Context.Service<SalesChannelServiceShape>(
  "@ecommerce/region-sales-channel/SalesChannelService"
);

export interface CreateSalesChannelServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly eventPublisher?: EventPublisherServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly repository?: SalesChannelRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => `${SALES_CHANNEL_ID_PREFIX}${nanoid()}`,
});

const createNoopEventPublisher = (): EventPublisherServiceShape => ({
  publish: () => {
    // Sales-channel events are optional until a runtime event bus is composed.
  },
});

const normalizeStatus = (
  status: SalesChannelStatus | undefined
): SalesChannelStatus => status ?? "draft";

export const createSalesChannelService = ({
  clock = createDefaultClock(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  repository = defaultRegionSalesChannelRepository,
}: CreateSalesChannelServiceOptions = {}): SalesChannelServiceShape => ({
  checkProductPublishability: async (input) => {
    const channel = await repository.findSalesChannelById(
      createSalesChannelId(input.salesChannelId)
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
  },
  createSalesChannel: async (input) => {
    const name = input.name.trim();

    if (!name) {
      throw new Error("Sales channel name is required.");
    }

    const now = clock.now();
    const channel: SalesChannelRecord = {
      createdAt: now,
      description: input.description?.trim() || null,
      id: createSalesChannelId(idGenerator.nextId()),
      metadata: input.metadata ?? {},
      name,
      productIds: [],
      status: normalizeStatus(input.status),
      updatedAt: now,
    };
    const saved = await repository.saveSalesChannel(channel);

    await eventPublisher.publish(
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
    );

    return saved;
  },
  getSalesChannelById: (id) => repository.findSalesChannelById(id),
  listSalesChannels: () => repository.listSalesChannels(),
  publishProductToSalesChannel: async (input) => {
    const channel = await repository.findSalesChannelById(
      createSalesChannelId(input.salesChannelId)
    );

    if (!channel) {
      throw new Error(`Sales channel "${input.salesChannelId}" was not found.`);
    }

    if (channel.productIds.includes(input.productId)) {
      return channel;
    }

    const updated: SalesChannelRecord = {
      ...channel,
      productIds: [...channel.productIds, input.productId],
      updatedAt: clock.now(),
    };
    const saved = await repository.saveSalesChannel(updated);

    await eventPublisher.publish(
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
    );

    return saved;
  },
});

export const createSalesChannelServiceLayer = (
  service: SalesChannelServiceShape
) => Layer.succeed(SalesChannelService, service);

export const defaultSalesChannelService = createSalesChannelService({
  repository: defaultRegionSalesChannelRepository,
});
