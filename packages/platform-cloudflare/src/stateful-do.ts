import type { StatefulCoordinationRequest } from "@ecommerce/core";
import { DurableObject } from "cloudflare:workers";

interface StoredCoordinationResult {
  readonly output?: unknown;
}

/**
 * Durable Object host for platform stateful coordination requests.
 * It stores idempotency keys per coordinator object so duplicate mutation
 * attempts can be rejected before module repositories are mutated.
 */
export class StatefulCoordinatorDurableObject extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const input = (await request.json()) as StatefulCoordinationRequest;

    if (!input.idempotencyKey) {
      return new Response("Missing idempotency key", { status: 400 });
    }

    const storageKey = `coordination:${input.operationName}:${input.idempotencyKey}`;
    const existing =
      await this.ctx.storage.get<StoredCoordinationResult>(storageKey);

    if (existing) {
      return Response.json({
        duplicate: true,
        output: existing.output,
      });
    }

    await this.ctx.storage.put(storageKey, {
      output: undefined,
    } satisfies StoredCoordinationResult);

    return Response.json({
      duplicate: false,
      output: undefined,
    });
  }
}
