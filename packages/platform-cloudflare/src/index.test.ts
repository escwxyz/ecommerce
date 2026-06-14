import { describe, expect, it } from "bun:test";

import {
  defineQueueMessage,
  defineSandboxPlugin,
  defineWorkflow,
  createEventCollector,
  createInMemoryWorkflowMetadataStore,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core";
import {
  createFakeNotificationProvider,
  createNotificationEventService,
} from "@ecommerce/notification-event";
import { createInMemoryNotificationEventRepository } from "@ecommerce/notification-event/repository";

import {
  activateSandboxPlugin,
  createCloudflareQueuePublisher,
  createCloudflareQueuedNotificationProvider,
  composeSandboxPluginDispatch,
  createCloudflareSandboxPluginRunner,
  createCloudflareStatefulCoordinator,
  createCloudflareWorkflowRuntime,
  createInMemorySandboxPluginMetadataStore,
  createInMemorySandboxStorage,
  createNotificationEventQueuePublisher,
  createNotificationEventRealtimePublisher,
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
            readonly idempotencyKey?: string;
          };
          requests.push(body);

          const key = body.idempotencyKey;
          const duplicate = key ? idempotencyKeys.has(key) : false;

          if (key) {
            idempotencyKeys.add(key);
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

    const published = await service.publishEvent({
      correlationId: "corr_notify_1",
      name: "order.placed",
      payload: { orderId: "order_1" },
      sourceModule: "order",
      workflowRunId: "wf_notify_1",
    });

    await expect(
      repository.findOutboxById(published.outbox.id)
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

    await service.upsertNotificationTemplate({
      channel: "email",
      id: "ntpl_cf_notify_1",
      name: "Order placed",
      providerKey: "email",
      templateKey: "order.placed",
    });

    const dispatch = await service.dispatchNotification({
      channel: "email",
      correlationId: "corr_notify_2",
      idempotencyKey: "notify_order_1",
      payload: { orderId: "order_1" },
      recipient: { address: "ada@example.com", type: "email" },
      templateKey: "order.placed",
    });
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
    await expect(repository.listDispatches()).resolves.toMatchObject([
      {
        id: "ndsp_cf_notify_1",
        status: "delivered",
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

  it("preserves queue and stateful coordination metadata through platform adapters", async () => {
    const fakeQueue = createFakeQueue();
    const fakeNamespace = createFakeDurableObjectNamespace();
    const clock = createStaticClock(new Date("2026-06-06T12:00:00.000Z"));
    const queuePublisher = createCloudflareQueuePublisher({
      clock,
      queue: fakeQueue.queue as Queue<never>,
    });
    const coordinator = createCloudflareStatefulCoordinator({
      clock,
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
    const coordinated = await coordinator.coordinate({
      causationId: message.id,
      coordinatorKey: "cart:cart_1",
      correlationId: message.correlationId,
      idempotencyKey: message.idempotencyKey,
      operationName: "cart.reserve",
      payload: message.payload,
      subject: message.subject,
      workflowRunId: message.workflowRunId,
    });

    expect(queued).toEqual({
      messageId: "msg_runtime_1",
      queuedAt: new Date("2026-06-06T12:00:00.000Z"),
    });
    expect(fakeQueue.messages).toEqual([message]);
    expect(coordinated).toMatchObject({
      causationId: "msg_runtime_1",
      coordinatorKey: "cart:cart_1",
      correlationId: "corr_runtime_1",
      duplicate: false,
      idempotencyKey: "checkout:cart_1",
      operationName: "cart.reserve",
      subject: {
        id: "cart_1",
        type: "cart",
      },
      workflowRunId: "run_runtime_1",
    });
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
        }),
        expect.objectContaining({
          decision: "deny",
          operationType: "fetch",
        }),
        expect.objectContaining({
          decision: "deny",
          operationType: "routeResponse",
        }),
      ])
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
