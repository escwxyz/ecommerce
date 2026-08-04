import { describe, expect, it, spyOn } from "bun:test";

import {
  createCustomerCartScope,
  createSystemCartScope,
  createVisitorCartScope,
} from "@ecommerce/cart/cache";
import { CartValidationFailure, createCartId } from "@ecommerce/cart/domain";
import { createResettableInMemoryCartRepository } from "@ecommerce/cart/repository";
import { createCartService } from "@ecommerce/cart/service";
import {
  defineQueueMessage,
  defineSandboxPlugin,
  defineWorkflow,
  createEventCollector,
  createInMemoryWorkflowStateStore,
  createInMemoryWorkflowMetadataStore,
  createSequenceIdGenerator,
  createStaticClock,
  QueuePublisherService,
  WorkflowRuntimeService,
} from "@ecommerce/core";
import {
  KeyedActorCommandSchema,
  KeyedActorService,
} from "@ecommerce/core/stateful";
import {
  createFakeNotificationProvider,
  createNotificationEventService,
} from "@ecommerce/notification-event";
import { createInMemoryNotificationEventRepository } from "@ecommerce/notification-event/repository";
import { Effect, Schema } from "effect";

import {
  activateSandboxPlugin,
  createCloudflareQueuePublisher,
  createCloudflareQueuePublisherLayer,
  createCloudflareQueuedNotificationProvider,
  CloudflareQueuePublishFailure,
  createCartCacheDurableObjectName,
  createCloudflareCartCacheRepository,
  composeSandboxPluginDispatch,
  createCloudflareSandboxPluginRunner,
  createCloudflareKeyedActorLayer,
  createCloudflareWorkflowRuntime,
  createCloudflareWorkflowRuntimeLayer,
  CloudflareWorkflowRuntimeFailure,
  createInMemorySandboxPluginMetadataStore,
  createInMemorySandboxStorage,
  createNotificationEventQueuePublisher,
  createNotificationEventRealtimePublisher,
  processNotificationEventQueueBatch,
  createSandboxBridge,
  createSandboxPluginUpgradePlan,
  createSandboxPluginCacheId,
  filterActiveSandboxPlugins,
  processNotificationEventQueueMessage,
} from "./index";
import type {
  CloudflareWorkerCode,
  CloudflareWorkerLoaderBinding,
  NotificationEventQueueMessage,
  SandboxBridge,
} from "./index";

const createFakeWorkflowBinding = () => {
  const instances = new Map<string, WorkflowInstance>();
  const statuses = new Map<string, InstanceStatus>();

  const createInstance = (
    id: string,
    status: InstanceStatus
  ): WorkflowInstance => ({
    id,
    pause: async () => undefined,
    restart: async () => undefined,
    resume: async () => undefined,
    sendEvent: async () => undefined,
    status: async () => statuses.get(id) ?? status,
    terminate: async () => undefined,
  });

  return {
    binding: {
      create: async ({
        id,
      }: WorkflowInstanceCreateOptions = {}): Promise<WorkflowInstance> => {
        const instanceId = id ?? `wf_${instances.size + 1}`;
        const instance = createInstance(instanceId, { status: "queued" });
        instances.set(instanceId, instance);
        statuses.set(instanceId, { status: "queued" });
        return instance;
      },
      createBatch: async (): Promise<WorkflowInstance[]> => [],
      get: async (id: string): Promise<WorkflowInstance> => {
        const existing = instances.get(id);
        if (existing) {
          return existing;
        }

        const instance = createInstance(id, {
          status: "complete",
          output: "ok",
        });
        instances.set(id, instance);
        statuses.set(id, { output: "ok", status: "complete" });
        return instance;
      },
    } as unknown as Workflow<unknown>,
    setStatus: (id: string, status: InstanceStatus) => {
      statuses.set(id, status);
    },
  };
};

const createFakeQueue = () => {
  const messages: unknown[] = [];

  return {
    messages,
    queue: {
      metrics: async () => ({
        backlogBytes: 0,
        backlogCount: messages.length,
      }),
      send: async (message: unknown) => {
        messages.push(message);
      },
      sendBatch: async (batch: readonly { body: unknown }[]) => {
        for (const message of batch) {
          messages.push(message.body);
        }
      },
    } as unknown as Queue<never>,
  };
};

const createFakeDurableObjectNamespace = () => {
  const idempotencyKeys = new Set<string>();
  const requests: unknown[] = [];
  const fetches: Request[] = [];

  return {
    fetches,
    idempotencyKeys,
    requests,
    namespace: {
      getByName: () => ({
        fetch: async (request: Request) => {
          fetches.push(request);
          const body = (await request.json()) as {
            readonly command?: {
              readonly actor: {
                readonly key: string;
                readonly type: string;
              };
              readonly causationId?: string;
              readonly commandId: string;
              readonly commandName: string;
              readonly correlationId: string;
              readonly idempotencyKey: string;
              readonly schemaVersion: number;
              readonly subject?: {
                readonly id: string;
                readonly type: string;
              };
              readonly workflowRunId?: string;
            };
            readonly idempotencyKey?: string;
            readonly operation?: string;
          };
          requests.push(body);

          const key = body.command?.idempotencyKey ?? body.idempotencyKey;
          const duplicate = key ? idempotencyKeys.has(key) : false;

          if (key) {
            idempotencyKeys.add(key);
          }

          if (body.operation === "dispatch" && body.command) {
            return Response.json({
              operation: "dispatch-result",
              result: {
                actor: body.command.actor,
                causationId: body.command.causationId,
                commandId: body.command.commandId,
                commandName: body.command.commandName,
                completedAt: "2026-06-06T12:00:00.000Z",
                correlationId: body.command.correlationId,
                duplicate,
                idempotencyKey: body.command.idempotencyKey,
                output: {
                  mutationCount: idempotencyKeys.size,
                },
                schemaVersion: body.command.schemaVersion,
                stateVersion: 0,
                subject: body.command.subject,
                workflowRunId: body.command.workflowRunId,
              },
            });
          }

          return Response.json({
            duplicate,
            output: {
              mutationCount: idempotencyKeys.size,
            },
          });
        },
      }),
    } as unknown as DurableObjectNamespace,
  };
};

const createFakeCartCacheNamespace = () => {
  const fetches: { readonly name: string; readonly operation: unknown }[] = [];
  const failures: unknown[] = [];
  const objects = new Map<
    string,
    {
      aggregate: {
        adjustments: { readonly id: string }[];
        cart: { readonly customerId: string | null } | null;
        lineItems: { readonly id: string }[];
      };
      adjustmentIdempotency: Map<string, unknown>;
      lineItemIdempotency: Map<string, unknown>;
      owner: { readonly id: string; readonly type: string } | null;
    }
  >();

  const getObject = (name: string) => {
    const existing = objects.get(name);

    if (existing) {
      return existing;
    }

    const created = {
      adjustmentIdempotency: new Map<string, unknown>(),
      aggregate: {
        adjustments: [] as { readonly id: string }[],
        cart: null,
        lineItems: [] as { readonly id: string }[],
      },
      lineItemIdempotency: new Map<string, unknown>(),
      owner: null,
    };
    objects.set(name, created);

    return created;
  };

  const canRead = (
    owner: { readonly id: string; readonly type: string } | null,
    scope: { readonly id: string; readonly type: string }
  ) =>
    !owner ||
    scope.type === "system" ||
    (owner.id === scope.id && owner.type === scope.type);

  return {
    failures,
    fetches,
    namespace: {
      getByName: (name: string) => ({
        fetch: async (request: Request) => {
          const operation = (await request.json()) as {
            readonly adjustment?: { readonly id: string };
            readonly aggregate?: {
              readonly adjustments: readonly { readonly id: string }[];
              readonly cart: { readonly customerId: string | null };
              readonly lineItems: readonly {
                readonly id: string;
              }[];
            };
            readonly cart?: { readonly customerId: string | null };
            readonly cartId?: string;
            readonly failedAt?: string;
            readonly id?: string;
            readonly idempotencyKey?: string;
            readonly item?: { readonly id: string };
            readonly reason?: string;
            readonly scope: { readonly id: string; readonly type: string };
            readonly type: string;
          };
          const object = getObject(name);
          fetches.push({ name, operation });

          if (!canRead(object.owner, operation.scope)) {
            return Response.json(
              { error: "denied", output: null },
              { status: 403 }
            );
          }

          switch (operation.type) {
            case "findCartById":
              return Response.json({
                output: object.aggregate.cart,
              });
            case "getCartAggregate":
              return Response.json({
                output: object.aggregate.cart ? object.aggregate : null,
              });
            case "findLineItemById":
              return Response.json({
                output:
                  object.aggregate.lineItems.find(
                    (lineItem: { readonly id: string }) =>
                      operation.id === lineItem.id
                  ) ?? null,
              });
            case "hydrateCartAggregate":
              if (
                operation.aggregate &&
                operation.aggregate.cart.customerId &&
                !(
                  operation.scope.type === "system" ||
                  (operation.scope.type === "customer" &&
                    operation.scope.id === operation.aggregate.cart.customerId)
                )
              ) {
                return Response.json(
                  { error: "denied", output: null },
                  { status: 403 }
                );
              }

              if (operation.aggregate) {
                object.aggregate = {
                  adjustments: [...operation.aggregate.adjustments],
                  cart: operation.aggregate.cart,
                  lineItems: [...operation.aggregate.lineItems],
                };
                object.owner = operation.scope;
              }
              return Response.json({ output: null });
            case "recordProjectionSyncFailure":
              failures.push(operation);
              return Response.json({ output: null });
            case "saveAdjustment": {
              const adjustment = operation.adjustment;

              if (!adjustment) {
                return Response.json(
                  { error: "missing adjustment", output: null },
                  { status: 400 }
                );
              }

              if (
                operation.idempotencyKey &&
                object.adjustmentIdempotency.has(operation.idempotencyKey)
              ) {
                return Response.json({
                  output: object.adjustmentIdempotency.get(
                    operation.idempotencyKey
                  ),
                });
              }

              object.aggregate.adjustments.push(adjustment);

              if (operation.idempotencyKey) {
                object.adjustmentIdempotency.set(
                  operation.idempotencyKey,
                  adjustment
                );
              }

              return Response.json({ output: adjustment });
            }
            case "saveCart":
              object.aggregate.cart = operation.cart ?? null;
              object.owner =
                operation.scope.type === "system" && operation.cart?.customerId
                  ? { id: operation.cart.customerId, type: "customer" }
                  : operation.scope;
              return Response.json({ output: operation.cart });
            case "saveLineItem":
              const item = operation.item;

              if (!item) {
                return Response.json(
                  { error: "missing item", output: null },
                  { status: 400 }
                );
              }

              if (
                operation.idempotencyKey &&
                object.lineItemIdempotency.has(operation.idempotencyKey)
              ) {
                return Response.json({
                  output: object.lineItemIdempotency.get(
                    operation.idempotencyKey
                  ),
                });
              }

              object.aggregate.lineItems.push(item);

              if (operation.idempotencyKey) {
                object.lineItemIdempotency.set(operation.idempotencyKey, item);
              }

              return Response.json({ output: item });
            default:
              return Response.json({ output: null });
          }
        },
      }),
    } as unknown as DurableObjectNamespace,
  };
};

describe("cloudflare cart cache adapter", () => {
  it("routes active cart mutations through deterministic cart Durable Object names and syncs the projection repository", async () => {
    const cartCache = createFakeCartCacheNamespace();
    const projectionRepository = createResettableInMemoryCartRepository();
    const repository = createCloudflareCartCacheRepository({
      namespace: cartCache.namespace,
      projectionRepository,
      scope: createVisitorCartScope("visitor_1"),
    });
    const service = createCartService({
      clock: createStaticClock(new Date("2026-06-16T10:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "cart_cf",
        "evt_cart_cf",
        "clitem_cf",
        "evt_line_cf",
      ]),
      repository,
    });

    const cart = await Effect.runPromise(
      service.createCart({ currencyCode: "USD" })
    );
    const aggregate = await Effect.runPromise(
      service.addLineItem({
        cartId: cart.id,
        correlationId: "cart_cf_line",
        idempotencyKey: "cart_cf_line",
        productId: "prod_hat",
        quantity: 1,
        title: "Hat",
        unitPrice: 1200,
        variantId: "variant_hat",
      })
    );
    const duplicate = await Effect.runPromise(
      service.addLineItem({
        cartId: cart.id,
        correlationId: "cart_cf_line",
        idempotencyKey: "cart_cf_line",
        productId: "prod_hat",
        quantity: 1,
        title: "Hat",
        unitPrice: 1200,
        variantId: "variant_hat",
      })
    );

    expect(cartCache.fetches.map(({ name }) => name)).toContain(
      createCartCacheDurableObjectName(cart.id)
    );
    await expect(
      Effect.runPromise(projectionRepository.getCartAggregate(cart.id))
    ).resolves.toMatchObject({
      lineItems: [
        {
          id: aggregate.lineItems[0]?.id,
        },
      ],
    });
    expect(duplicate.lineItems).toHaveLength(1);
  });

  it("hydrates cache misses from projection and records projection sync failures", async () => {
    const cartCache = createFakeCartCacheNamespace();
    const projectionRepository = createResettableInMemoryCartRepository();
    const seedRepository = createCloudflareCartCacheRepository({
      namespace: cartCache.namespace,
      projectionRepository,
      scope: createVisitorCartScope("visitor_1"),
    });
    const seedService = createCartService({
      clock: createStaticClock(new Date("2026-06-16T10:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["cart_seed", "evt_seed"]),
      repository: seedRepository,
    });
    const cart = await Effect.runPromise(
      seedService.createCart({ currencyCode: "USD" })
    );
    const emptyCache = createFakeCartCacheNamespace();
    const hydratedRepository = createCloudflareCartCacheRepository({
      namespace: emptyCache.namespace,
      projectionRepository,
      scope: createVisitorCartScope("visitor_1"),
    });

    await expect(
      Effect.runPromise(hydratedRepository.getCartAggregate(cart.id))
    ).resolves.toMatchObject({
      cart: {
        id: cart.id,
      },
    });

    const failingProjection = {
      ...createResettableInMemoryCartRepository(),
      saveCart: () =>
        Effect.fail(
          new CartValidationFailure({ message: "projection offline" })
        ),
    };
    const failuresCache = createFakeCartCacheNamespace();
    const failingRepository = createCloudflareCartCacheRepository({
      namespace: failuresCache.namespace,
      projectionRepository: failingProjection,
      scope: createVisitorCartScope("visitor_2"),
    });
    const failingService = createCartService({
      clock: createStaticClock(new Date("2026-06-16T10:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["cart_fail", "evt_fail"]),
      repository: failingRepository,
    });

    await Effect.runPromise(failingService.createCart({ currencyCode: "USD" }));

    expect(failuresCache.failures).toEqual([
      expect.objectContaining({
        reason: "projection offline",
      }),
    ]);
  });

  it("enforces visitor and customer scope isolation in the Cloudflare cache adapter", async () => {
    const cartCache = createFakeCartCacheNamespace();
    const projectionRepository = createResettableInMemoryCartRepository();
    const visitorRepository = createCloudflareCartCacheRepository({
      namespace: cartCache.namespace,
      projectionRepository,
      scope: createVisitorCartScope("visitor_1"),
    });
    const customerRepository = createCloudflareCartCacheRepository({
      namespace: cartCache.namespace,
      projectionRepository,
      scope: createCustomerCartScope("cus_1"),
    });
    const systemRepository = createCloudflareCartCacheRepository({
      namespace: cartCache.namespace,
      projectionRepository,
      scope: createSystemCartScope(),
    });
    const visitorService = createCartService({
      clock: createStaticClock(new Date("2026-06-16T10:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["cart_owner", "evt_owner"]),
      repository: visitorRepository,
    });
    const cart = await Effect.runPromise(
      visitorService.createCart({ currencyCode: "USD" })
    );

    await expect(
      Effect.runPromise(customerRepository.getCartAggregate(cart.id))
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(systemRepository.getCartAggregate(cart.id))
    ).resolves.toMatchObject({
      cart: {
        id: cart.id,
      },
    });
  });

  it("rejects mismatched customer scope when hydrating a projected customer cart", async () => {
    const cartCache = createFakeCartCacheNamespace();
    const projectionRepository = createResettableInMemoryCartRepository();
    const customerCart = await Effect.runPromise(
      projectionRepository.saveCart({
        billingAddress: null,
        completedAt: null,
        createdAt: new Date("2026-06-16T10:00:00.000Z"),
        currencyCode: "USD",
        customerId: "cus_1",
        email: null,
        id: createCartId("cart_projection"),
        metadata: {},
        paymentCollectionId: null,
        regionId: null,
        salesChannelId: null,
        shippingAddress: null,
        shippingOptionId: null,
        status: "active",
        totals: {
          adjustmentTotal: 0,
          currencyCode: "USD",
          discountTotal: 0,
          giftCardTotal: 0,
          itemSubtotal: 0,
          shippingTotal: 0,
          subtotal: 0,
          taxTotal: 0,
          total: 0,
        },
        updatedAt: new Date("2026-06-16T10:00:00.000Z"),
      })
    );
    const mismatchedRepository = createCloudflareCartCacheRepository({
      namespace: cartCache.namespace,
      projectionRepository,
      scope: createCustomerCartScope("cus_2"),
    });

    await expect(
      Effect.runPromise(mismatchedRepository.getCartAggregate(customerCart.id))
    ).rejects.toThrow(/denied/);

    await expect(
      Effect.runPromise(
        createCloudflareCartCacheRepository({
          namespace: cartCache.namespace,
          projectionRepository,
          scope: createVisitorCartScope("visitor_2"),
        }).getCartAggregate(customerCart.id)
      )
    ).rejects.toThrow(/denied/);
  });

  it("reads active line items from the Durable Object when projection sync fails", async () => {
    const cartCache = createFakeCartCacheNamespace();
    const projectionRepository = {
      ...createResettableInMemoryCartRepository(),
      saveLineItem: () =>
        Effect.fail(
          new CartValidationFailure({ message: "projection unavailable" })
        ),
    };
    const repository = createCloudflareCartCacheRepository({
      namespace: cartCache.namespace,
      projectionRepository,
      scope: createVisitorCartScope("visitor_3"),
    });
    const service = createCartService({
      clock: createStaticClock(new Date("2026-06-16T10:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "cart_line_do",
        "evt_cart_line_do",
        "clitem_line_do",
        "evt_line_do",
      ]),
      repository,
    });

    const cart = await Effect.runPromise(
      service.createCart({ currencyCode: "USD" })
    );
    const withLineItem = await Effect.runPromise(
      service.addLineItem({
        cartId: cart.id,
        correlationId: "cart_line_do",
        idempotencyKey: "cart_line_do",
        productId: "prod_hat",
        quantity: 1,
        title: "Hat",
        unitPrice: 1200,
        variantId: "variant_hat",
      })
    );
    const lineItem = withLineItem.lineItems[0];

    if (!lineItem) {
      throw new Error("Expected an active line item in the cart cache.");
    }

    await expect(
      Effect.runPromise(repository.findLineItemById(lineItem.id, cart.id))
    ).resolves.toMatchObject({
      id: lineItem.id,
      cartId: cart.id,
    });
  });
});

describe("cloudflare workflow runtime adapter", () => {
  it("starts workflows through bindings and projects metadata", async () => {
    const workflowBinding = createFakeWorkflowBinding();
    const sentMessages: unknown[] = [];
    const { publisher } = createEventCollector();
    const metadata = createInMemoryWorkflowMetadataStore();

    const runtime = createCloudflareWorkflowRuntime({
      bindings: {
        dispatchQueue: {
          metrics: async () => ({
            backlogBytes: 0,
            backlogCount: 0,
          }),
          send: async (message) => {
            sentMessages.push(message);
            return {
              metadata: {
                metrics: {
                  backlogBytes: 0,
                  backlogCount: sentMessages.length,
                },
              },
            };
          },
          sendBatch: async () => ({
            metadata: {
              metrics: {
                backlogBytes: 0,
                backlogCount: sentMessages.length,
              },
            },
          }),
        },
        workflow: workflowBinding.binding,
      },
      clock: createStaticClock(new Date("2026-06-03T10:00:00.000Z")),
      ids: createSequenceIdGenerator(["run_cf_1", "evt_cf_1", "evt_cf_2"]),
      metadataStore: metadata.store,
      publisher,
    });

    const workflow = defineWorkflow({
      key: "plugin.sync",
      version: 1,
      steps: [],
    });

    const run = await runtime.start({
      workflow,
      input: { pluginId: "plg_1" },
      correlationId: "corr_cf_1",
      idempotencyKey: "plugin:plg_1",
    });

    expect(run.historyReference).toBe("cloudflare:run_cf_1");
    expect(sentMessages).toHaveLength(1);
    expect(metadata.records.get(run.runId)?.workflowKey).toBe("plugin.sync");
  });

  it("queues notification-event outbox work after module state is persisted", async () => {
    const fakeQueue = createFakeQueue();
    const repository = createInMemoryNotificationEventRepository();
    const service = createNotificationEventService({
      clock: createStaticClock(new Date("2026-06-07T12:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["evt_cf_notify_1"]),
      repository,
      runtime: createNotificationEventQueuePublisher({
        clock: createStaticClock(new Date("2026-06-07T12:00:00.000Z")),
        queue: fakeQueue.queue as Queue<NotificationEventQueueMessage>,
      }),
    });

    const published = await Effect.runPromise(
      service.publishEvent({
        correlationId: "corr_notify_1",
        name: "order.placed",
        payload: { orderId: "order_1" },
        sourceModule: "order",
        workflowRunId: "wf_notify_1",
      })
    );

    await expect(
      Effect.runPromise(repository.findOutboxById(published.outbox.id))
    ).resolves.toMatchObject({
      id: "evt_cf_notify_1",
      status: "pending",
    });
    expect(fakeQueue.messages).toMatchObject([
      {
        kind: "event-outbox",
        metadata: {
          correlationId: "corr_notify_1",
          idempotencyKey: "evt_cf_notify_1",
          workflowRunId: "wf_notify_1",
        },
        payload: {
          eventId: "evt_cf_notify_1",
          eventName: "order.placed",
          outboxId: "evt_cf_notify_1",
          sourceModule: "order",
        },
      },
    ]);
  });

  it("queues notification dispatches and lets consumers deliver idempotently", async () => {
    const fakeQueue = createFakeQueue();
    const repository = createInMemoryNotificationEventRepository();
    const clock = createStaticClock(new Date("2026-06-07T12:00:00.000Z"));
    const service = createNotificationEventService({
      clock,
      idGenerator: createSequenceIdGenerator(["ndsp_cf_notify_1"]),
      notificationProviders: [
        createCloudflareQueuedNotificationProvider({
          clock,
          providerKey: "email",
          queue: fakeQueue.queue as Queue<NotificationEventQueueMessage>,
        }),
      ],
      repository,
    });

    await Effect.runPromise(
      service.upsertNotificationTemplate({
        channel: "email",
        id: "ntpl_cf_notify_1",
        name: "Order placed",
        providerKey: "email",
        templateKey: "order.placed",
      })
    );

    const dispatch = await Effect.runPromise(
      service.dispatchNotification({
        channel: "email",
        correlationId: "corr_notify_2",
        idempotencyKey: "notify_order_1",
        payload: { orderId: "order_1" },
        recipient: { address: "ada@example.com", type: "email" },
        templateKey: "order.placed",
      })
    );
    const provider = createFakeNotificationProvider("email");
    const message = fakeQueue.messages[0] as NotificationEventQueueMessage;

    expect(dispatch.status).toBe("queued");
    expect(message).toMatchObject({
      kind: "notification-dispatch",
      metadata: {
        correlationId: "corr_notify_2",
        idempotencyKey: "notify_order_1",
      },
      payload: {
        providerKey: "email",
      },
    });

    await processNotificationEventQueueMessage(message, {
      clock,
      notificationProviders: [provider],
      repository,
      retryPolicy: { maxAttempts: 3 },
    });
    await processNotificationEventQueueMessage(message, {
      clock,
      notificationProviders: [provider],
      repository,
      retryPolicy: { maxAttempts: 3 },
    });

    expect(provider.deliveries).toHaveLength(1);
    await expect(
      Effect.runPromise(repository.listDispatches)
    ).resolves.toMatchObject([
      {
        id: "ndsp_cf_notify_1",
        status: "delivered",
      },
    ]);
  });

  it("retries queue messages when provider delivery returns failed status", async () => {
    const fakeQueue = createFakeQueue();
    const repository = createInMemoryNotificationEventRepository();
    const clock = createStaticClock(new Date("2026-06-07T12:00:00.000Z"));
    const service = createNotificationEventService({
      clock,
      idGenerator: createSequenceIdGenerator(["ndsp_cf_notify_failed"]),
      notificationProviders: [
        createCloudflareQueuedNotificationProvider({
          clock,
          providerKey: "email",
          queue: fakeQueue.queue as Queue<NotificationEventQueueMessage>,
        }),
      ],
      repository,
    });

    await Effect.runPromise(
      service.upsertNotificationTemplate({
        channel: "email",
        id: "ntpl_cf_notify_failed",
        name: "Order placed",
        providerKey: "email",
        templateKey: "order.placed",
      })
    );
    await Effect.runPromise(
      service.dispatchNotification({
        channel: "email",
        correlationId: "corr_notify_failed",
        idempotencyKey: "notify_order_failed",
        payload: { orderId: "order_1" },
        recipient: { address: "ada@example.com", type: "email" },
        templateKey: "order.placed",
      })
    );

    const message = fakeQueue.messages[0] as NotificationEventQueueMessage;
    const queueMessage = {
      ack: () => {
        throw new Error("failed provider results must not ack");
      },
      body: message,
      retry: () => undefined,
    };
    const retrySpy = spyOn(queueMessage, "retry");
    const failedProvider = {
      key: "email",
      deliver: async () => ({
        error: "temporary provider failure",
        messageId: "provider:failed",
        status: "failed" as const,
      }),
    };
    await processNotificationEventQueueBatch(
      { messages: [queueMessage] },
      {
        clock,
        notificationProviders: [failedProvider],
        repository,
        retryPolicy: { maxAttempts: 3 },
      }
    );

    expect(retrySpy).toHaveBeenCalledTimes(1);
    await expect(
      Effect.runPromise(repository.listDispatches)
    ).resolves.toMatchObject([
      {
        id: "ndsp_cf_notify_failed",
        lastError: "temporary provider failure",
        status: "failed",
      },
    ]);
  });

  it("does not redeliver when thrown provider delivery errors trigger queue retry", async () => {
    const fakeQueue = createFakeQueue();
    const repository = createInMemoryNotificationEventRepository();
    const clock = createStaticClock(new Date("2026-06-07T12:00:00.000Z"));
    const service = createNotificationEventService({
      clock,
      idGenerator: createSequenceIdGenerator(["ndsp_cf_notify_thrown"]),
      notificationProviders: [
        createCloudflareQueuedNotificationProvider({
          clock,
          providerKey: "email",
          queue: fakeQueue.queue as Queue<NotificationEventQueueMessage>,
        }),
      ],
      repository,
    });

    await Effect.runPromise(
      service.upsertNotificationTemplate({
        channel: "email",
        id: "ntpl_cf_notify_thrown",
        name: "Order placed",
        providerKey: "email",
        templateKey: "order.placed",
      })
    );
    await Effect.runPromise(
      service.dispatchNotification({
        channel: "email",
        correlationId: "corr_notify_thrown",
        idempotencyKey: "notify_order_thrown",
        payload: { orderId: "order_1" },
        recipient: { address: "ada@example.com", type: "email" },
        templateKey: "order.placed",
      })
    );

    const message = fakeQueue.messages[0] as NotificationEventQueueMessage;
    const queueMessage = {
      ack: () => {
        throw new Error("thrown provider errors must not ack");
      },
      body: message,
      retry: () => undefined,
    };
    const retrySpy = spyOn(queueMessage, "retry");
    let deliveries = 0;
    const throwingProvider = {
      key: "email",
      deliver: async () => {
        deliveries += 1;
        throw new Error("provider timeout");
      },
    };

    await processNotificationEventQueueBatch(
      { messages: [queueMessage] },
      {
        clock,
        notificationProviders: [throwingProvider],
        repository,
        retryPolicy: { maxAttempts: 3 },
      }
    );

    expect(deliveries).toBe(1);
    expect(retrySpy).toHaveBeenCalledTimes(1);
    await expect(
      Effect.runPromise(repository.listDispatches)
    ).resolves.toMatchObject([
      {
        id: "ndsp_cf_notify_thrown",
        lastError: "provider timeout",
        status: "failed",
      },
    ]);
  });

  it("routes realtime updates to deterministic Durable Object scopes", async () => {
    const broadcasts: unknown[] = [];
    const scopes: string[] = [];
    const realtime = createNotificationEventRealtimePublisher({
      namespace: {
        getByName: (scope) => {
          scopes.push(scope);
          return {
            broadcast: async (update) => {
              broadcasts.push(update);
            },
            fetch: async () => new Response("ok"),
          };
        },
      },
    });

    await realtime.publish("tenant:store_1", {
      id: "evt_realtime_1",
      occurredAt: "2026-06-07T12:00:00.000Z",
      payload: { outboxId: "evt_1" },
      type: "event-dispatched",
    });

    expect(scopes).toEqual(["tenant:store_1"]);
    expect(broadcasts).toMatchObject([
      {
        id: "evt_realtime_1",
        type: "event-dispatched",
      },
    ]);
  });

  it("preserves queue and keyed actor metadata through platform adapters", async () => {
    const fakeQueue = createFakeQueue();
    const fakeNamespace = createFakeDurableObjectNamespace();
    const clock = createStaticClock(new Date("2026-06-06T12:00:00.000Z"));
    const queuePublisher = createCloudflareQueuePublisher({
      clock,
      queue: fakeQueue.queue as Queue<never>,
    });
    const actorLayer = createCloudflareKeyedActorLayer({
      namespace: fakeNamespace.namespace,
    });

    const message = defineQueueMessage({
      causationId: "evt_checkout_started",
      correlationId: "corr_runtime_1",
      id: "msg_runtime_1",
      idempotencyKey: "checkout:cart_1",
      payload: {
        cartId: "cart_1",
      },
      queueName: "commerce-work",
      subject: {
        id: "cart_1",
        type: "cart",
      },
      type: "checkout.reserve-inventory",
      workflowRunId: "run_runtime_1",
    });

    const queued = await queuePublisher.publish(message);
    const command = Schema.decodeUnknownSync(KeyedActorCommandSchema)({
      actor: {
        key: "cart_1",
        type: "cart",
      },
      causationId: message.id,
      commandId: message.idempotencyKey,
      commandName: "cart.reserve",
      correlationId: message.correlationId,
      idempotencyKey: message.idempotencyKey,
      payload: message.payload,
      issuedAt: clock.now().toISOString(),
      schemaVersion: 1,
      subject: message.subject,
      workflowRunId: message.workflowRunId,
    });
    const coordinated = await Effect.runPromise(
      Effect.gen(function* dispatchKeyedActorCommand() {
        const actor = yield* KeyedActorService;
        return yield* actor.dispatch(command);
      }).pipe(Effect.provide(actorLayer))
    );

    expect(queued).toEqual({
      messageId: "msg_runtime_1",
      queuedAt: new Date("2026-06-06T12:00:00.000Z"),
    });
    expect(fakeQueue.messages).toEqual([message]);
    expect(coordinated).toMatchObject({
      actor: {
        key: "cart_1",
        type: "cart",
      },
      causationId: "msg_runtime_1",
      commandName: "cart.reserve",
      correlationId: "corr_runtime_1",
      duplicate: false,
      idempotencyKey: "checkout:cart_1",
      subject: {
        id: "cart_1",
        type: "cart",
      },
      workflowRunId: "run_runtime_1",
    });
  });

  it("provides Cloudflare queue publishers through Effect Layers and typed failures", async () => {
    const telemetryEvents: unknown[] = [];
    const failingQueue = {
      metrics: async () => ({
        backlogBytes: 0,
        backlogCount: 0,
      }),
      send: async () => {
        throw new Error("queue unavailable");
      },
      sendBatch: async () => undefined,
    } as unknown as Queue<never>;
    const message = defineQueueMessage({
      correlationId: "corr_queue_layer",
      id: "msg_queue_layer",
      idempotencyKey: "queue:layer",
      payload: { ok: true },
      queueName: "commerce-work",
      traceId: "trace_queue_layer",
      type: "commerce.test",
    });
    const layer = createCloudflareQueuePublisherLayer({
      clock: createStaticClock(new Date("2026-06-06T12:30:00.000Z")),
      queue: failingQueue,
      telemetry: {
        record: (event) => {
          telemetryEvents.push(event);
        },
      },
    });

    await expect(
      Effect.runPromise(
        Effect.gen(function* publishWithLayer() {
          const publisher = yield* QueuePublisherService;
          return yield* Effect.tryPromise({
            catch: (cause) => cause,
            try: () => publisher.publish(message),
          });
        }).pipe(Effect.provide(layer))
      )
    ).rejects.toBeInstanceOf(CloudflareQueuePublishFailure);
    expect(telemetryEvents).toMatchObject([
      {
        correlationId: "corr_queue_layer",
        kind: "queue.publish.failed",
        messageId: "msg_queue_layer",
        traceId: "trace_queue_layer",
      },
    ]);
  });

  it("does not duplicate queued or coordinated work for duplicate workflow starts", async () => {
    const workflowBinding = createFakeWorkflowBinding();
    const fakeQueue = createFakeQueue();
    const fakeNamespace = createFakeDurableObjectNamespace();
    const { publisher } = createEventCollector();

    const runtime = createCloudflareWorkflowRuntime({
      bindings: {
        coordinator: fakeNamespace.namespace,
        dispatchQueue: fakeQueue.queue as Queue<never>,
        workflow: workflowBinding.binding,
      },
      clock: createStaticClock(new Date("2026-06-06T13:00:00.000Z")),
      ids: createSequenceIdGenerator(["run_cf_dupe", "evt_cf_dupe"]),
      publisher,
    });

    const workflow = defineWorkflow({
      key: "checkout.reserve",
      version: 1,
      steps: [],
    });
    const request = {
      workflow,
      correlationId: "corr_dupe_1",
      idempotencyKey: "checkout:cart_1",
      input: { cartId: "cart_1" },
      subject: {
        id: "cart_1",
        type: "cart",
      },
    };

    const first = await runtime.start(request);
    const second = await runtime.start(request);

    expect(second.runId).toBe(first.runId);
    expect(fakeQueue.messages).toHaveLength(1);
    expect(fakeNamespace.fetches).toHaveLength(1);
  });

  it("deduplicates workflow starts across runtime instances with shared metadata", async () => {
    const workflowBinding = createFakeWorkflowBinding();
    const fakeQueue = createFakeQueue();
    const fakeNamespace = createFakeDurableObjectNamespace();
    const { publisher } = createEventCollector();
    const metadata = createInMemoryWorkflowMetadataStore();
    const clock = createStaticClock(new Date("2026-06-06T13:30:00.000Z"));
    const workflow = defineWorkflow({
      key: "checkout.reserve",
      version: 1,
      steps: [],
    });
    const request = {
      workflow,
      correlationId: "corr_dupe_2",
      idempotencyKey: "checkout:cart_2",
      input: { cartId: "cart_2" },
      subject: {
        id: "cart_2",
        type: "cart",
      },
    } as const;

    const firstRuntime = createCloudflareWorkflowRuntime({
      bindings: {
        coordinator: fakeNamespace.namespace,
        dispatchQueue: fakeQueue.queue as Queue<never>,
        workflow: workflowBinding.binding,
      },
      clock,
      ids: createSequenceIdGenerator(["run_cf_shared_1", "evt_cf_shared_1"]),
      metadataStore: metadata.store,
      publisher,
    });

    const first = await firstRuntime.start(request);

    const secondRuntime = createCloudflareWorkflowRuntime({
      bindings: {
        coordinator: fakeNamespace.namespace,
        dispatchQueue: fakeQueue.queue as Queue<never>,
        workflow: workflowBinding.binding,
      },
      clock,
      ids: createSequenceIdGenerator(["run_cf_shared_2", "evt_cf_shared_2"]),
      metadataStore: metadata.store,
      publisher,
    });

    const second = await secondRuntime.start(request);

    expect(second.runId).toBe(first.runId);
    expect(fakeQueue.messages).toHaveLength(1);
    expect(fakeNamespace.fetches).toHaveLength(1);
    expect(metadata.records.get(first.runId)?.idempotencyKey).toBe(
      "checkout:cart_2"
    );
  });

  it("deduplicates workflow starts across runtime instances with shared state", async () => {
    const workflowBinding = createFakeWorkflowBinding();
    const fakeQueue = createFakeQueue();
    const { publisher } = createEventCollector();
    const state = createInMemoryWorkflowStateStore();
    const telemetryEvents: unknown[] = [];
    const clock = createStaticClock(new Date("2026-06-06T14:00:00.000Z"));
    const workflow = defineWorkflow({
      key: "checkout.workflow-state",
      version: 1,
      steps: [],
    });
    const request = {
      workflow,
      correlationId: "corr_state_dedupe",
      idempotencyKey: "checkout:state",
      input: { cartId: "cart_state" },
    } as const;
    const firstRuntime = createCloudflareWorkflowRuntime({
      bindings: {
        dispatchQueue: fakeQueue.queue as Queue<never>,
        workflow: workflowBinding.binding,
      },
      clock,
      ids: createSequenceIdGenerator(["run_cf_state_1", "evt_cf_state_1"]),
      publisher,
      stateStore: state.store,
      telemetry: {
        record: (event) => {
          telemetryEvents.push(event);
        },
      },
    });

    const first = await firstRuntime.start(request);
    const secondRuntime = createCloudflareWorkflowRuntime({
      bindings: {
        dispatchQueue: fakeQueue.queue as Queue<never>,
        workflow: workflowBinding.binding,
      },
      clock,
      ids: createSequenceIdGenerator(["run_cf_state_2", "evt_cf_state_2"]),
      publisher,
      stateStore: state.store,
    });
    const second = await secondRuntime.start(request);

    expect(second.runId).toBe(first.runId);
    expect(fakeQueue.messages).toHaveLength(1);
    expect(state.states.get(first.runId)).toMatchObject({
      correlationId: "corr_state_dedupe",
      historyReference: "cloudflare:run_cf_state_1",
      idempotencyKey: "checkout:state",
      schemaVersion: 1,
      status: "pending",
      workflowKey: "checkout.workflow-state",
    });
    expect(telemetryEvents).toContainEqual(
      expect.objectContaining({
        kind: "workflow.start.succeeded",
        runId: "run_cf_state_1",
      })
    );
  });

  it("provides Cloudflare workflow runtimes through Effect Layers and typed failures", async () => {
    const { publisher } = createEventCollector();
    const workflow = defineWorkflow({
      key: "checkout.workflow-layer",
      version: 1,
      steps: [],
    });
    const layer = createCloudflareWorkflowRuntimeLayer({
      bindings: {
        workflow: {
          create: async () => {
            throw new Error("workflow binding unavailable");
          },
          createBatch: async (): Promise<WorkflowInstance[]> => [],
          get: async () => {
            throw new Error("not expected");
          },
        } as unknown as Workflow<unknown>,
      },
      clock: createStaticClock(new Date("2026-06-06T14:30:00.000Z")),
      ids: createSequenceIdGenerator(["run_cf_layer"]),
      publisher,
    });

    await expect(
      Effect.runPromise(
        Effect.gen(function* startWithLayer() {
          const runtime = yield* WorkflowRuntimeService;
          return yield* Effect.tryPromise({
            catch: (cause) => cause,
            try: () =>
              runtime.start({
                workflow,
                correlationId: "corr_workflow_layer",
                input: {},
              }),
          });
        }).pipe(Effect.provide(layer))
      )
    ).rejects.toBeInstanceOf(CloudflareWorkflowRuntimeFailure);
  });

  it("reconciles Cloudflare instance status back to the shared contract", async () => {
    const workflowBinding = createFakeWorkflowBinding();
    const { publisher } = createEventCollector();
    const runtime = createCloudflareWorkflowRuntime({
      bindings: {
        workflow: workflowBinding.binding,
      },
      clock: createStaticClock(new Date("2026-06-03T11:00:00.000Z")),
      ids: createSequenceIdGenerator(["run_cf_2", "evt_cf_3", "evt_cf_4"]),
      publisher,
    });

    const workflow = defineWorkflow({
      key: "plugin.sync",
      version: 1,
      steps: [],
    });

    await runtime.start({
      workflow,
      input: { pluginId: "plg_2" },
      correlationId: "corr_cf_2",
      runId: "run_cf_2",
    });

    workflowBinding.setStatus("run_cf_2", {
      output: { synced: true },
      status: "complete",
    });

    const reconciled = await runtime.reconcile({ runId: "run_cf_2" });

    expect(reconciled?.status).toBe("completed");
    expect(reconciled?.output).toEqual({ synced: true });
  });
});

const createSandboxPlugin = () =>
  defineSandboxPlugin({
    manifest: {
      allowedHosts: ["api.example.com"],
      bundle: {
        integrity: {
          algorithm: "sha256",
          value: "bundle-hash",
        },
        mainModule: "src/index.js",
        modules: {
          "src/index.js":
            "export default { fetch() { return Response.json({ type: 'hook', decision: 'continue' }); } };",
        },
        r2Key: "plugins/tax/1.0.0/index.js",
        version: "1.0.0+bundle-hash",
      },
      capabilities: ["bridge:fetch", "bridge:log", "bridge:storage"],
      entrypoints: [
        {
          key: "tax.quote",
          kind: "route",
        },
      ],
      id: "tax-sandbox",
      storage: [
        {
          namespace: "settings",
        },
      ],
      version: "1.0.0",
    },
    state: "active",
  });

const createBridgeContext = () => ({
  correlationId: "corr_sandbox_1",
  grantedAllowedHosts: ["api.example.com"],
  grantedCapabilities: [
    "bridge:fetch",
    "bridge:log",
    "route:respond",
    "bridge:storage",
  ] as const,
  grantedStorageNamespaces: ["settings"],
  lifecycleState: "active" as const,
  pluginId: "tax-sandbox",
  pluginVersion: "1.0.0",
  tenantId: "tenant_1",
  traceId: "trace_sandbox_1",
});

describe("cloudflare sandbox plugin runtime", () => {
  it("loads sandbox plugins through Worker Loader and validates responses", async () => {
    const plugin = createSandboxPlugin();
    const loadedCode: CloudflareWorkerCode[] = [];
    const loader: CloudflareWorkerLoaderBinding = {
      get: (id, getCode) => {
        expect(id).toBe(
          createSandboxPluginCacheId({
            entrypointKey: "tax.quote",
            manifest: plugin.manifest,
          })
        );
        return {
          getEntrypoint: () => ({
            fetch: async () => {
              loadedCode.push(await getCode());
              return Response.json({
                body: {
                  quoted: true,
                },
                status: 200,
                type: "routeResponse",
              });
            },
          }),
        };
      },
      load: (code) => {
        loadedCode.push(code);
        return {
          getEntrypoint: () => ({
            fetch: async () =>
              Response.json({
                decision: "continue",
                type: "hook",
              }),
          }),
        };
      },
    };
    const runner = createCloudflareSandboxPluginRunner({ loader });

    const result = await runner.invoke({
      bridgeContext: createBridgeContext(),
      compatibilityDate: "2026-06-04",
      entrypointKey: "tax.quote",
      manifest: plugin.manifest,
      policy: {
        canActivate: true,
        deniedAllowedHosts: [],
        deniedCapabilities: [],
        deniedStorageNamespaces: [],
        grantedAllowedHosts: ["api.example.com"],
        grantedCapabilities: [
          "bridge:fetch",
          "bridge:log",
          "bridge:storage",
          "route:respond",
        ],
        grantedStorageNamespaces: ["settings"],
        pluginId: "tax-sandbox",
      },
      useCache: true,
    });

    expect(result.response).toEqual({
      body: {
        quoted: true,
      },
      status: 200,
      type: "routeResponse",
    });
    expect(loadedCode[0]?.globalOutbound).toEqual({
      allowedHosts: ["api.example.com"],
    });
    expect(result.auditEvents[0]).toMatchObject({
      decision: "allow",
      operationType: "invoke",
      pluginId: "tax-sandbox",
      traceId: "trace_sandbox_1",
    });
  });

  it("denies sandbox execution when Worker Loader is missing", async () => {
    const plugin = createSandboxPlugin();
    const runner = createCloudflareSandboxPluginRunner({});

    await expect(
      runner.invoke({
        bridgeContext: createBridgeContext(),
        compatibilityDate: "2026-06-04",
        entrypointKey: "tax.quote",
        manifest: plugin.manifest,
        policy: {
          canActivate: true,
          deniedAllowedHosts: [],
          deniedCapabilities: [],
          deniedStorageNamespaces: [],
          grantedAllowedHosts: [],
          grantedCapabilities: [],
          grantedStorageNamespaces: [],
          pluginId: "tax-sandbox",
        },
      })
    ).rejects.toMatchObject({
      code: "platform-capability-unavailable",
      pluginId: "tax-sandbox",
      traceId: "trace_sandbox_1",
    });
  });

  it("configures outbound access as denied by default", async () => {
    const plugin = createSandboxPlugin();
    let loadedCode: CloudflareWorkerCode | undefined;
    const loader: CloudflareWorkerLoaderBinding = {
      get: () => {
        throw new Error("unused");
      },
      load: (code) => {
        loadedCode = code;
        return {
          getEntrypoint: () => ({
            fetch: async () =>
              Response.json({
                decision: "continue",
                type: "hook",
              }),
          }),
        };
      },
    };

    await createCloudflareSandboxPluginRunner({ loader }).invoke({
      bridgeContext: {
        ...createBridgeContext(),
        grantedAllowedHosts: [],
      },
      compatibilityDate: "2026-06-04",
      entrypointKey: "tax.quote",
      manifest: plugin.manifest,
      policy: {
        canActivate: true,
        deniedAllowedHosts: [],
        deniedCapabilities: [],
        deniedStorageNamespaces: [],
        grantedAllowedHosts: [],
        grantedCapabilities: ["bridge:log"],
        grantedStorageNamespaces: [],
        pluginId: "tax-sandbox",
      },
    });

    expect(loadedCode?.globalOutbound).toBeNull();
  });

  it("passes only the mediated Effect-backed bridge to Worker Loader entrypoints", async () => {
    const plugin = createSandboxPlugin();
    let exposedEnv: Record<string, unknown> | undefined;
    const loader: CloudflareWorkerLoaderBinding = {
      get: () => {
        throw new Error("unused");
      },
      load: () => ({
        getEntrypoint: () => ({
          fetch: async (_request, env) => {
            exposedEnv = env as Record<string, unknown>;
            const sandboxEnv = env as {
              readonly bridge: Pick<SandboxBridge, "routeResponse">;
            };

            return Response.json(
              await sandboxEnv.bridge.routeResponse({
                body: {
                  mediated: true,
                },
                status: 200,
                type: "routeResponse",
              })
            );
          },
        }),
      }),
    };

    const result = await createCloudflareSandboxPluginRunner({ loader }).invoke(
      {
        bridgeContext: createBridgeContext(),
        compatibilityDate: "2026-06-04",
        entrypointKey: "tax.quote",
        manifest: plugin.manifest,
        policy: {
          canActivate: true,
          deniedAllowedHosts: [],
          deniedCapabilities: [],
          deniedStorageNamespaces: [],
          grantedAllowedHosts: [],
          grantedCapabilities: ["bridge:log", "route:respond"],
          grantedStorageNamespaces: [],
          pluginId: "tax-sandbox",
        },
      }
    );

    expect(exposedEnv).toBeDefined();
    expect(Object.keys(exposedEnv ?? {}).toSorted()).toEqual([
      "bridge",
      "context",
    ]);
    expect(exposedEnv?.context).toMatchObject({
      correlationId: "corr_sandbox_1",
      traceId: "trace_sandbox_1",
    });
    expect(Object.keys(exposedEnv?.bridge ?? {}).toSorted()).toEqual([
      "commerceAction",
      "emitEvent",
      "fetch",
      "log",
      "routeResponse",
      "storageRead",
      "storageWrite",
    ]);
    expect(JSON.stringify(Object.keys(exposedEnv ?? {}))).not.toMatch(
      /(?:binding|database|durable|env|loader|postgres|secret|sql|storage)/iu
    );
    expect(result.response).toEqual({
      body: {
        mediated: true,
      },
      status: 200,
      type: "routeResponse",
    });
    expect(result.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decision: "allow",
          operationType: "routeResponse",
          pluginId: "tax-sandbox",
        }),
      ])
    );
  });

  it("enforces bridge capability, outbound host, and storage scope", async () => {
    const auditEvents: unknown[] = [];
    const storage = createInMemorySandboxStorage();
    const bridge = createSandboxBridge({
      audit: {
        emit: (event) => {
          auditEvents.push(event);
        },
      },
      context: createBridgeContext(),
      fetcher: async () => new Response("ok"),
      storage,
    });

    await bridge.storageWrite("settings", "tax-rate", 0.2);
    await expect(bridge.storageRead("settings", "tax-rate")).resolves.toBe(0.2);
    await expect(bridge.storageRead("secrets", "token")).rejects.toMatchObject({
      code: "storage-denied",
    });
    await expect(
      bridge.fetch("https://evil.example.test")
    ).rejects.toMatchObject({
      code: "egress-denied",
    });

    const restrictedBridge = createSandboxBridge({
      audit: {
        emit: (event) => {
          auditEvents.push(event);
        },
      },
      context: {
        ...createBridgeContext(),
        grantedCapabilities: ["bridge:log"],
      },
      storage,
    });

    await expect(
      restrictedBridge.storageRead("settings", "tax-rate")
    ).rejects.toMatchObject({
      code: "capability-denied",
    });
    await expect(
      restrictedBridge.routeResponse({
        body: { quoted: false },
        status: 200,
        type: "routeResponse",
      })
    ).rejects.toMatchObject({
      code: "capability-denied",
    });
    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decision: "deny",
          operationType: "storage",
          resource: "secrets",
          traceId: "trace_sandbox_1",
        }),
        expect.objectContaining({
          decision: "deny",
          operationType: "fetch",
          traceId: "trace_sandbox_1",
        }),
        expect.objectContaining({
          decision: "deny",
          operationType: "routeResponse",
          traceId: "trace_sandbox_1",
        }),
      ])
    );
  });

  it("classifies Worker Loader invalid responses and defects with invoke audit evidence", async () => {
    const plugin = createSandboxPlugin();
    const createLoaderReturning = (
      response: unknown
    ): CloudflareWorkerLoaderBinding => ({
      get: () => {
        throw new Error("unused");
      },
      load: () => ({
        getEntrypoint: () => ({
          fetch: async () => response,
        }),
      }),
    });

    await expect(
      createCloudflareSandboxPluginRunner({
        loader: createLoaderReturning({ malformed: true }),
      }).invoke({
        bridgeContext: createBridgeContext(),
        compatibilityDate: "2026-06-04",
        entrypointKey: "tax.quote",
        manifest: plugin.manifest,
        policy: {
          canActivate: true,
          deniedAllowedHosts: [],
          deniedCapabilities: [],
          deniedStorageNamespaces: [],
          grantedAllowedHosts: [],
          grantedCapabilities: ["bridge:log"],
          grantedStorageNamespaces: [],
          pluginId: "tax-sandbox",
        },
      })
    ).rejects.toMatchObject({
      code: "invalid-response",
      message: "Sandbox entrypoint returned an invalid response shape.",
    });

    const defectAuditEvents: unknown[] = [];
    const defectiveLoader: CloudflareWorkerLoaderBinding = {
      get: () => {
        throw new Error("unused");
      },
      load: () => ({
        getEntrypoint: () => ({
          fetch: async () => {
            throw new Error("sandbox defect");
          },
        }),
      }),
    };

    await expect(
      createCloudflareSandboxPluginRunner({
        audit: {
          emit: (event) => {
            defectAuditEvents.push(event);
          },
        },
        loader: defectiveLoader,
      }).invoke({
        bridgeContext: createBridgeContext(),
        compatibilityDate: "2026-06-04",
        entrypointKey: "tax.quote",
        manifest: plugin.manifest,
        policy: {
          canActivate: true,
          deniedAllowedHosts: [],
          deniedCapabilities: [],
          deniedStorageNamespaces: [],
          grantedAllowedHosts: [],
          grantedCapabilities: ["bridge:log"],
          grantedStorageNamespaces: [],
          pluginId: "tax-sandbox",
        },
      })
    ).rejects.toMatchObject({
      code: "platform-execution-failed",
      message: "sandbox defect",
      reason: "defect",
    });
    expect(defectAuditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decision: "deny",
          operationType: "invoke",
          reason: "sandbox defect",
        }),
      ])
    );
  });

  it("classifies Worker Loader invocation timeouts without exposing raw host state", async () => {
    const plugin = createSandboxPlugin();
    const auditEvents: unknown[] = [];
    const loader: CloudflareWorkerLoaderBinding = {
      get: () => {
        throw new Error("unused");
      },
      load: () => ({
        getEntrypoint: () => ({
          fetch: () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve(
                  Response.json({
                    decision: "continue",
                    type: "hook",
                  })
                );
              }, 50);
            }),
        }),
      }),
    };

    await expect(
      createCloudflareSandboxPluginRunner({
        audit: {
          emit: (event) => {
            auditEvents.push(event);
          },
        },
        invocationTimeoutMs: 1,
        loader,
      }).invoke({
        bridgeContext: createBridgeContext(),
        compatibilityDate: "2026-06-04",
        entrypointKey: "tax.quote",
        manifest: plugin.manifest,
        policy: {
          canActivate: true,
          deniedAllowedHosts: [],
          deniedCapabilities: [],
          deniedStorageNamespaces: [],
          grantedAllowedHosts: [],
          grantedCapabilities: ["bridge:log"],
          grantedStorageNamespaces: [],
          pluginId: "tax-sandbox",
        },
      })
    ).rejects.toMatchObject({
      code: "platform-execution-failed",
      message: "Sandbox plugin invocation timed out after 1ms.",
      reason: "timeout",
    });
    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decision: "deny",
          operationType: "invoke",
          reason: "Sandbox plugin invocation timed out after 1ms.",
        }),
      ])
    );
    expect(JSON.stringify(auditEvents)).not.toMatch(
      /(?:binding|database|loader|postgres|secret|sql)/iu
    );
  });

  it("denies sandbox commerce actions when actor permission is missing", async () => {
    const auditEvents: unknown[] = [];
    const bridge = createSandboxBridge({
      audit: {
        emit: (event) => {
          auditEvents.push(event);
        },
      },
      authorizeCommerceAction: () => false,
      commerceActionPermissions: {
        "product.list": "product:read",
      },
      commerceActions: {
        "product.list": async () => [],
      },
      context: {
        ...createBridgeContext(),
        auth: {
          permissions: [],
          userId: "user_1",
        },
        grantedCapabilities: ["commerce:read"],
      },
    });

    await expect(
      bridge.commerceAction("product.list", {})
    ).rejects.toMatchObject({
      code: "invalid-auth-scope",
      reason: "product:read",
    });
    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decision: "deny",
          operationType: "commerce",
          reason: 'Permission "product:read" is not granted.',
        }),
      ])
    );
  });

  it("validates sandbox commerce action permissions before exposing bridge actions", () => {
    expect(() =>
      createSandboxBridge({
        commerceActionPermissions: {
          "product.list": "product:read",
        },
        context: createBridgeContext(),
        permissionValidator: (permission) => {
          if (permission !== "catalog:read") {
            throw new Error(`Unsupported permission "${permission}".`);
          }
        },
      })
    ).toThrow(/Unsupported permission "product:read"/);
  });

  it("allows route responses when route capability is granted", async () => {
    const bridge = createSandboxBridge({
      context: createBridgeContext(),
    });

    await expect(
      bridge.routeResponse({
        body: { quoted: true },
        status: 200,
        type: "routeResponse",
      })
    ).resolves.toEqual({
      body: { quoted: true },
      status: 200,
      type: "routeResponse",
    });
  });

  it("gates activation on bundle integrity, grants, and Worker Loader availability", () => {
    const plugin = createSandboxPlugin();

    expect(() =>
      activateSandboxPlugin({
        bundle: {
          bucket: "plugin-bundles",
          integrity: plugin.manifest.bundle.integrity,
          key: plugin.manifest.bundle.r2Key,
          version: plugin.manifest.bundle.version,
        },
        grantedAllowedHosts: ["api.example.com"],
        grantedCapabilities: ["bridge:fetch", "bridge:log", "bridge:storage"],
        grantedStorageNamespaces: ["settings"],
        manifest: plugin.manifest,
        now: new Date("2026-06-04T10:00:00.000Z"),
        workerLoaderAvailable: false,
      })
    ).toThrow(/Worker Loader/);

    const activated = activateSandboxPlugin({
      bundle: {
        bucket: "plugin-bundles",
        integrity: plugin.manifest.bundle.integrity,
        key: plugin.manifest.bundle.r2Key,
        version: plugin.manifest.bundle.version,
      },
      grantedAllowedHosts: ["api.example.com"],
      grantedCapabilities: ["bridge:fetch", "bridge:log", "bridge:storage"],
      grantedStorageNamespaces: ["settings"],
      manifest: plugin.manifest,
      now: new Date("2026-06-04T10:00:00.000Z"),
      workerLoaderAvailable: true,
    });

    expect(activated.record).toMatchObject({
      pluginId: "tax-sandbox",
      state: "active",
      storageNamespaces: ["settings"],
    });

    expect(() =>
      activateSandboxPlugin({
        bundle: {
          bucket: "plugin-bundles",
          integrity: {
            algorithm: "sha256",
            value: "wrong",
          },
          key: plugin.manifest.bundle.r2Key,
          version: plugin.manifest.bundle.version,
        },
        grantedAllowedHosts: ["api.example.com"],
        grantedCapabilities: ["bridge:fetch", "bridge:log", "bridge:storage"],
        grantedStorageNamespaces: ["settings"],
        manifest: plugin.manifest,
        now: new Date("2026-06-04T10:00:00.000Z"),
        workerLoaderAvailable: true,
      })
    ).toThrow(/integrity/);
  });

  it("excludes inactive sandbox plugins from dispatch", () => {
    expect(
      filterActiveSandboxPlugins([
        {
          id: "active",
          state: "active",
        },
        {
          id: "inactive",
          state: "inactive",
        },
        {
          id: "failed",
          state: "failed",
        },
      ]).map((plugin) => plugin.id)
    ).toEqual(["active"]);
  });

  it("persists lifecycle metadata and composes active sandbox dispatch", async () => {
    const plugin = createSandboxPlugin();
    const activated = activateSandboxPlugin({
      bundle: {
        bucket: "plugin-bundles",
        integrity: plugin.manifest.bundle.integrity,
        key: plugin.manifest.bundle.r2Key,
        version: plugin.manifest.bundle.version,
      },
      grantedAllowedHosts: ["api.example.com"],
      grantedCapabilities: ["bridge:fetch", "bridge:log", "bridge:storage"],
      grantedStorageNamespaces: ["settings"],
      manifest: {
        ...plugin.manifest,
        contributions: {
          adminSurfaces: ["tax.settings"],
          routes: ["tax.quote"],
        },
      },
      now: new Date("2026-06-04T10:00:00.000Z"),
      workerLoaderAvailable: true,
    });
    const store = createInMemorySandboxPluginMetadataStore();

    await store.upsert(activated.record);
    const composition = composeSandboxPluginDispatch(await store.list());

    expect(composition.routeKeys).toEqual(["tax.quote"]);
    expect(composition.adminSurfaceKeys).toEqual(["tax.settings"]);
    await expect(store.get("tax-sandbox")).resolves.toMatchObject({
      state: "active",
    });
  });

  it("rejects duplicate sandbox route and admin contribution keys", () => {
    const plugin = createSandboxPlugin();
    const createRecord = (pluginId: string) => ({
      activeBundle: {
        bucket: "plugin-bundles",
        integrity: plugin.manifest.bundle.integrity,
        key: plugin.manifest.bundle.r2Key,
        version: plugin.manifest.bundle.version,
      },
      grantedPolicy: {
        canActivate: true,
        deniedAllowedHosts: [],
        deniedCapabilities: [],
        deniedStorageNamespaces: [],
        grantedAllowedHosts: ["api.example.com"],
        grantedCapabilities: [
          "bridge:fetch",
          "bridge:log",
          "bridge:storage",
        ] as const,
        grantedStorageNamespaces: ["settings"],
        pluginId,
      },
      manifest: {
        ...plugin.manifest,
        id: pluginId,
        contributions: {
          adminSurfaces: ["tax.settings"],
          routes: ["tax.quote"],
        },
      },
      pluginId,
      state: "active" as const,
      storageNamespaces: ["settings"],
      updatedAt: "2026-06-04T10:00:00.000Z",
      version: "1.0.0",
    });

    expect(() =>
      composeSandboxPluginDispatch([
        createRecord("tax-one"),
        createRecord("tax-two"),
      ])
    ).toThrow(/Duplicate sandbox plugin route key "tax.quote"/);
  });

  it("keeps upgrades pending until activation checks pass", () => {
    const plugin = createSandboxPlugin();
    const activated = activateSandboxPlugin({
      bundle: {
        bucket: "plugin-bundles",
        integrity: plugin.manifest.bundle.integrity,
        key: plugin.manifest.bundle.r2Key,
        version: plugin.manifest.bundle.version,
      },
      grantedAllowedHosts: ["api.example.com"],
      grantedCapabilities: ["bridge:fetch", "bridge:log", "bridge:storage"],
      grantedStorageNamespaces: ["settings"],
      manifest: plugin.manifest,
      now: new Date("2026-06-04T10:00:00.000Z"),
      workerLoaderAvailable: true,
    });
    const upgrade = createSandboxPluginUpgradePlan({
      current: activated.record,
      nextBundle: {
        bucket: "plugin-bundles",
        integrity: {
          algorithm: "sha256",
          value: "bundle-hash-v2",
        },
        key: "plugins/tax/2.0.0/index.js",
        version: "2.0.0+bundle-hash-v2",
      },
      nextManifest: {
        ...plugin.manifest,
        bundle: {
          ...plugin.manifest.bundle,
          integrity: {
            algorithm: "sha256",
            value: "bundle-hash-v2",
          },
          r2Key: "plugins/tax/2.0.0/index.js",
          version: "2.0.0+bundle-hash-v2",
        },
        version: "2.0.0",
      },
      now: new Date("2026-06-04T10:05:00.000Z"),
    });

    expect(upgrade.transition).toMatchObject({
      fromVersion: "1.0.0",
      pluginId: "tax-sandbox",
      toState: "upgrade-pending",
      toVersion: "2.0.0",
    });
    expect(
      filterActiveSandboxPlugins([upgrade.pendingRecord]).map(
        (record) => record.pluginId
      )
    ).toEqual([]);
  });
});
