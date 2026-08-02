import { describe, expect, it } from "bun:test";

import { Effect } from "effect";
import type { Effect as EffectType } from "effect/Effect";

import type { DurableAudit } from "../../telemetry/index";
import { createTestTelemetry } from "../../testing/index";
import {
  SandboxBridgeFailure,
  SandboxCapabilityBridgeService,
  createSandboxCapabilityBridgeLayer,
  invokeSandboxBridgeOperation,
} from "../index";
import type {
  SandboxBridgeContext,
  SandboxBridgeOperation,
  SandboxCapabilityBridgeHandlerInput,
} from "../index";

const context: SandboxBridgeContext = {
  correlationId: "corr_1",
  grantedAllowedHosts: ["api.example.com"],
  grantedCapabilities: ["bridge:log", "bridge:storage"],
  grantedStorageNamespaces: ["settings"],
  lifecycleState: "active",
  pluginId: "tax-sandbox",
  pluginVersion: "1.0.0",
  tenantId: "tenant_1",
};

const storageReadOperation: SandboxBridgeOperation = {
  capability: "bridge:storage",
  resource: "settings",
  type: "storageRead",
};

const logOperation: SandboxBridgeOperation = {
  capability: "bridge:log",
  type: "log",
};

const runWithBridge = <A, E>(
  effect: EffectType<A, E, DurableAudit | SandboxCapabilityBridgeService>,
  handler: (
    input: SandboxCapabilityBridgeHandlerInput
  ) => Effect.Effect<unknown>
) => {
  const telemetry = createTestTelemetry();
  const bridgeLayer = createSandboxCapabilityBridgeLayer({ handler });

  return Effect.runPromiseExit(
    effect.pipe(Effect.provide(bridgeLayer), Effect.provide(telemetry.layer))
  ).then((exit) => ({
    auditEvents: telemetry.auditEvents,
    exit,
  }));
};

const expectSandboxBridgeFailure = (failure: unknown): SandboxBridgeFailure => {
  expect(failure).toBeInstanceOf(SandboxBridgeFailure);
  if (!(failure instanceof SandboxBridgeFailure)) {
    throw new Error("Expected SandboxBridgeFailure.");
  }

  return failure;
};

describe("sandbox capability bridge service", () => {
  it("executes granted operations through an Effect handler and records durable audit", async () => {
    const result = await runWithBridge(
      invokeSandboxBridgeOperation({
        context,
        operation: storageReadOperation,
      }),
      (input) =>
        Effect.succeed({
          key: input.operation.resource,
          ok: true,
        })
    );

    expect(result.exit._tag).toBe("Success");
    if (result.exit._tag === "Success") {
      expect(result.exit.value).toEqual({
        key: "settings",
        ok: true,
      });
    }
    expect(result.auditEvents).toHaveLength(1);
    expect(result.auditEvents[0]).toMatchObject({
      attributes: {
        decision: "allow",
        operationType: "storageRead",
        pluginId: "tax-sandbox",
        reason: 'Capability "bridge:storage" granted.',
      },
      correlation: {
        requestId: "corr_1",
      },
      eventType: "sandbox.bridge.allow",
      subjectId: "tax-sandbox",
    });
  });

  it("rejects unauthorized capabilities with a typed audited failure", async () => {
    let handlerCalls = 0;
    const result = await runWithBridge(
      invokeSandboxBridgeOperation({
        context: {
          ...context,
          grantedCapabilities: ["bridge:log"],
        },
        operation: storageReadOperation,
      }),
      () =>
        Effect.sync(() => {
          handlerCalls += 1;
        })
    );

    expect(handlerCalls).toBe(0);
    expect(result.exit._tag).toBe("Failure");
    const failure = await Effect.runPromise(
      invokeSandboxBridgeOperation({
        context: {
          ...context,
          grantedCapabilities: ["bridge:log"],
        },
        operation: storageReadOperation,
      }).pipe(
        Effect.provide(
          createSandboxCapabilityBridgeLayer({
            handler: () => Effect.sync(() => undefined),
          })
        ),
        Effect.provide(createTestTelemetry().layer),
        Effect.flip
      )
    );
    expectSandboxBridgeFailure(failure);
    expect(expectSandboxBridgeFailure(failure).code).toBe("capability-denied");
    expect(result.auditEvents).toHaveLength(1);
    expect(result.auditEvents[0]).toMatchObject({
      attributes: {
        decision: "deny",
        operationType: "storageRead",
        reason: 'Capability "bridge:storage" is not granted.',
      },
      eventType: "sandbox.bridge.deny",
    });
  });

  it("rejects operations after their deadline before invoking the handler", async () => {
    let handlerCalls = 0;
    const result = await runWithBridge(
      invokeSandboxBridgeOperation({
        context,
        deadlineEpochMillis: 1,
        nowEpochMillis: 2,
        operation: logOperation,
      }),
      () =>
        Effect.sync(() => {
          handlerCalls += 1;
        })
    );

    expect(handlerCalls).toBe(0);
    expect(result.exit._tag).toBe("Failure");
    const failure = await Effect.runPromise(
      invokeSandboxBridgeOperation({
        context,
        deadlineEpochMillis: 1,
        nowEpochMillis: 2,
        operation: logOperation,
      }).pipe(
        Effect.provide(
          createSandboxCapabilityBridgeLayer({
            handler: () => Effect.sync(() => undefined),
          })
        ),
        Effect.provide(createTestTelemetry().layer),
        Effect.flip
      )
    );
    expect(expectSandboxBridgeFailure(failure).code).toBe("deadline-exceeded");
    expect(result.auditEvents[0]).toMatchObject({
      attributes: {
        decision: "deny",
        operationType: "log",
        reason: "Sandbox bridge operation deadline exceeded.",
      },
      eventType: "sandbox.bridge.deny",
    });
  });

  it("enforces per-scope quotas before dispatching host operations", async () => {
    let handlerCalls = 0;
    const program = Effect.gen(function* () {
      yield* invokeSandboxBridgeOperation({
        context,
        operation: logOperation,
        quota: {
          key: "plugin:tax-sandbox",
          limit: 1,
        },
      });
      return yield* invokeSandboxBridgeOperation({
        context,
        operation: logOperation,
        quota: {
          key: "plugin:tax-sandbox",
          limit: 1,
        },
      });
    });

    const result = await runWithBridge(program, () =>
      Effect.sync(() => {
        handlerCalls += 1;
      })
    );

    expect(handlerCalls).toBe(1);
    expect(result.exit._tag).toBe("Failure");
    const failure = await Effect.runPromise(
      program.pipe(
        Effect.provide(
          createSandboxCapabilityBridgeLayer({
            handler: () => Effect.sync(() => undefined),
          })
        ),
        Effect.provide(createTestTelemetry().layer),
        Effect.flip
      )
    );
    expect(expectSandboxBridgeFailure(failure).code).toBe("quota-exceeded");
    expect(result.auditEvents.map((event) => event.eventType)).toEqual([
      "sandbox.bridge.allow",
      "sandbox.bridge.deny",
    ]);
  });

  it("normalizes malformed bridge messages to typed audited failures", async () => {
    let handlerCalls = 0;
    const result = await runWithBridge(
      invokeSandboxBridgeOperation({
        context,
        operation: {
          capability: "bridge:storage",
          type: "log",
        },
      }),
      () =>
        Effect.sync(() => {
          handlerCalls += 1;
        })
    );

    expect(handlerCalls).toBe(0);
    expect(result.exit._tag).toBe("Failure");
    const failure = await Effect.runPromise(
      invokeSandboxBridgeOperation({
        context,
        operation: {
          capability: "bridge:storage",
          type: "log",
        },
      }).pipe(
        Effect.provide(
          createSandboxCapabilityBridgeLayer({
            handler: () => Effect.sync(() => undefined),
          })
        ),
        Effect.provide(createTestTelemetry().layer),
        Effect.flip
      )
    );
    expect(expectSandboxBridgeFailure(failure).code).toBe("invalid-input");
    expect(result.auditEvents[0]).toMatchObject({
      attributes: {
        decision: "deny",
        operationType: "log",
        reason: "Sandbox bridge message failed schema decoding.",
      },
      eventType: "sandbox.bridge.deny",
    });
  });
});
