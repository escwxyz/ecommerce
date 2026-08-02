import { describe, expect, it } from "bun:test";

import { withOperationTelemetry } from "@ecommerce/core";
import { Effect, Exit } from "effect";

import {
  createCloudflareTelemetryLayer,
  withCloudflareTelemetry,
} from "../telemetry";
import type { CloudflareTelemetryRecord } from "../telemetry";

const createTelemetryConsole = () => {
  const records: CloudflareTelemetryRecord[] = [];
  return {
    console: {
      debug: (payload: CloudflareTelemetryRecord) => {
        records.push(payload);
      },
      error: (payload: CloudflareTelemetryRecord) => {
        records.push(payload);
      },
      info: (payload: CloudflareTelemetryRecord) => {
        records.push(payload);
      },
      log: (payload: CloudflareTelemetryRecord) => {
        records.push(payload);
      },
      warn: (payload: CloudflareTelemetryRecord) => {
        records.push(payload);
      },
    },
    records,
  };
};

const logRecords = (records: readonly CloudflareTelemetryRecord[]) =>
  records.filter((record) => record.kind === "effect.log");

const spanRecords = (records: readonly CloudflareTelemetryRecord[]) =>
  records.filter((record) => record.kind === "effect.span");

describe("Cloudflare telemetry exporter Layer", () => {
  it("exports Effect logs and spans as structured Worker console records", async () => {
    const telemetry = createTelemetryConsole();

    const result = await Effect.runPromise(
      withOperationTelemetry(Effect.succeed("store_1"), {
        attributes: {
          accessToken: "raw-token",
          module: "store",
        },
        correlation: {
          operationId: "operation_1",
          requestId: "request_1",
          traceId: "trace_1",
        },
        name: "store.read",
      }).pipe(
        Effect.provide(
          createCloudflareTelemetryLayer({ console: telemetry.console })
        )
      )
    );

    expect(result).toBe("store_1");
    expect(logRecords(telemetry.records)).toContainEqual(
      expect.objectContaining({
        annotations: {
          accessToken: "<redacted>",
          module: "store",
          operation: "store.read",
          operationId: "operation_1",
          requestId: "request_1",
          traceId: "trace_1",
        },
        kind: "effect.log",
        level: "Info",
        message: ["commerce.operation.succeeded"],
      })
    );
    expect(spanRecords(telemetry.records)).toContainEqual(
      expect.objectContaining({
        attributes: {
          accessToken: "<redacted>",
          module: "store",
          operation: "store.read",
          operationId: "operation_1",
          requestId: "request_1",
          traceId: "trace_1",
        },
        kind: "effect.span",
        name: "store.read",
        outcome: "success",
      })
    );
    expect(JSON.stringify(telemetry.records)).not.toContain("raw-token");
  });

  it("exports failed spans with bounded outcomes without serializing Causes", async () => {
    const telemetry = createTelemetryConsole();
    const exit = await Effect.runPromiseExit(
      withCloudflareTelemetry(
        withOperationTelemetry(Effect.die("broken-secret"), {
          correlation: {
            requestId: "request_1",
          },
          name: "store.read",
        }),
        { console: telemetry.console }
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(spanRecords(telemetry.records)).toContainEqual(
      expect.objectContaining({
        kind: "effect.span",
        name: "store.read",
        outcome: "defect",
      })
    );
    expect(JSON.stringify(telemetry.records)).not.toContain("broken-secret");
  });

  it("keeps exporter defects from changing commerce results", async () => {
    const defectiveConsole = {
      error: () => {
        throw new Error("console unavailable");
      },
      info: () => {
        throw new Error("console unavailable");
      },
      log: () => {
        throw new Error("console unavailable");
      },
    };

    await expect(
      Effect.runPromise(
        withCloudflareTelemetry(
          withOperationTelemetry(Effect.succeed("ok"), {
            correlation: {
              requestId: "request_1",
            },
            name: "store.read",
          }),
          { console: defectiveConsole }
        )
      )
    ).resolves.toBe("ok");
  });

  it("keeps exporter defects from replacing typed commerce failures", async () => {
    const defectiveConsole = {
      error: () => {
        throw new Error("console unavailable");
      },
      info: () => {
        throw new Error("console unavailable");
      },
      log: () => {
        throw new Error("console unavailable");
      },
    };
    const exit = await Effect.runPromiseExit(
      withCloudflareTelemetry(
        withOperationTelemetry(Effect.fail("store-not-found"), {
          correlation: {
            requestId: "request_1",
          },
          name: "store.read",
        }),
        { console: defectiveConsole }
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.reasons).toContainEqual(
        expect.objectContaining({
          _tag: "Fail",
          error: "store-not-found",
        })
      );
    }
  });
});
