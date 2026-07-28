import { describe, expect, it } from "bun:test";

import { Context, Effect, Layer, Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { createEventEnvelope } from "../../events/index";
import { defineWorkflow, defineWorkflowStep } from "../../workflows/index";
import {
  composeNativePlugins,
  defineNativePlugin,
  defineNativePluginApiGroupContribution,
  defineNativePluginEventHandlerContribution,
  defineNativePluginProviderContribution,
  defineNativePluginServiceContribution,
  defineNativePluginWorkflowContribution,
} from "../index";

class AnalyticsService extends Context.Service<
  AnalyticsService,
  {
    readonly summarize: (subject: string) => Effect.Effect<string>;
  }
>()("@ecommerce/core/test/AnalyticsService") {}

class SearchProvider extends Context.Service<
  SearchProvider,
  {
    readonly search: (query: string) => Effect.Effect<readonly string[]>;
  }
>()("@ecommerce/core/test/SearchProvider") {}

const analyticsLayer = Layer.succeed(
  AnalyticsService,
  AnalyticsService.of({
    summarize: (subject) => Effect.succeed(`summary:${subject}`),
  })
);

const searchProviderLayer = Layer.succeed(
  SearchProvider,
  SearchProvider.of({
    search: (query) => Effect.succeed([`result:${query}`]),
  })
);

describe("native plugin Effect contributions", () => {
  it("preserves service, provider, API, workflow, and event Effect contracts", async () => {
    const service = defineNativePluginServiceContribution({
      key: "analytics:service",
      layer: analyticsLayer,
      service: AnalyticsService,
    });
    const provider = defineNativePluginProviderContribution({
      contractKey: "commerce:search-provider",
      key: "analytics:search",
      kind: "search",
      layer: searchProviderLayer,
      provider: SearchProvider,
    });
    const apiGroup = defineNativePluginApiGroupContribution({
      group: HttpApiGroup.make("analyticsAdmin").add(
        HttpApiEndpoint.get("analyticsSummary", "/admin/analytics", {
          success: Schema.String,
        })
      ),
      handlers: Layer.empty,
      key: "analytics:admin-api",
      surface: "admin",
    });
    const workflow = defineNativePluginWorkflowContribution({
      key: "analytics:refresh-workflow",
      layer: analyticsLayer,
      workflow: defineWorkflow({
        key: "analytics.refresh",
        version: 1,
        steps: [
          defineWorkflowStep({
            name: "refresh",
            run: () =>
              AnalyticsService.use((analytics) =>
                Effect.map(analytics.summarize("orders"), (output) => ({
                  output,
                }))
              ),
          }),
        ],
      }),
    });
    const seenEvents: string[] = [];
    const eventHandler = defineNativePluginEventHandlerContribution({
      eventName: "analytics.requested",
      handler: (
        event: ReturnType<
          typeof createEventEnvelope<
            "analytics.requested",
            { readonly subject: string }
          >
        >
      ) =>
        AnalyticsService.use((analytics) =>
          Effect.flatMap(
            analytics.summarize(event.payload.subject),
            (summary) =>
              Effect.sync(() => {
                seenEvents.push(summary);
              })
          )
        ),
      key: "analytics:requested-handler",
      layer: analyticsLayer,
    });
    const plugin = defineNativePlugin({
      contributions: {
        apiGroups: [apiGroup],
        eventHandlers: [eventHandler],
        providers: [provider],
        services: [service],
        workflows: [workflow],
      },
      manifest: {
        capabilities: [],
        id: "analytics",
        version: "1.0.0",
      },
    });

    const composition = composeNativePlugins([plugin]);
    const composedService = composition.services[0];
    const composedProvider = composition.providers[0];
    const composedWorkflow = composition.workflows[0];
    const composedEventHandler = composition.eventHandlers[0];

    expect(composition.apiGroups[0]).toBe(apiGroup);
    expect(composition.apiGroups[0]?.owner).toBe("plugin");
    expect(composedService?.service).toBe(AnalyticsService);
    expect(composedProvider?.provider).toBe(SearchProvider);
    expect(composedWorkflow?.workflow.key).toBe("analytics.refresh");
    if (
      !composedService ||
      !composedProvider ||
      !composedWorkflow ||
      !composedEventHandler
    ) {
      throw new Error("Expected every active plugin Effect contribution.");
    }

    const summary = await Effect.runPromise(
      AnalyticsService.use((analytics) => analytics.summarize("orders")).pipe(
        Effect.provide(composedService.layer)
      )
    );
    const results = await Effect.runPromise(
      SearchProvider.use((search) => search.search("customer")).pipe(
        Effect.provide(composedProvider.layer)
      )
    );
    const refreshStep = composedWorkflow.workflow.steps[0];
    expect(refreshStep).toBeDefined();
    if (!refreshStep) {
      throw new Error("Expected the plugin workflow refresh step.");
    }
    const workflowResult = await Effect.runPromise(
      refreshStep
        .run(
          {},
          {
            attempt: 1,
            correlationId: "correlation_1",
            stepId: "step_1",
            stepName: "refresh",
            workflowId: "workflow_1",
            workflowKey: "analytics.refresh",
            workflowVersion: 1,
          }
        )
        .pipe(Effect.provide(composedWorkflow.layer))
    );
    await Effect.runPromise(
      composedEventHandler
        .handler(
          createEventEnvelope({
            id: "event_1",
            name: "analytics.requested",
            payload: { subject: "orders" },
          })
        )
        .pipe(Effect.provide(composedEventHandler.layer))
    );

    expect(summary).toBe("summary:orders");
    expect(results).toEqual(["result:customer"]);
    expect(workflowResult.output).toBe("summary:orders");
    expect(seenEvents).toEqual(["summary:orders"]);
  });
});
