import { apiAssembly as defaultApiAssembly } from "@ecommerce/api";
import type { createContext } from "@ecommerce/api/context";
import type { AuthService } from "@ecommerce/auth";
import { notificationEventPermissions } from "@ecommerce/notification-event";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

type CreateContext = typeof createContext;
type ApiContext = Awaited<ReturnType<CreateContext>>;
type ServerApiAssembly = typeof defaultApiAssembly;
type ServerTransportRouter = ConstructorParameters<
  typeof OpenAPIHandler<ApiContext>
>[0];

export interface CreateServerAppOptions {
  apiAssembly?: ServerApiAssembly;
  auth: AuthService;
  corsOrigin: string;
  createContext: CreateContext;
  createVisitorId?: () => string;
  notificationEventRealtime?: NotificationEventRealtimeRouteOptions;
  reportError?: (error: unknown) => void;
}

export interface NotificationEventRealtimeRouteOptions {
  readonly namespace?: DurableObjectNamespace;
  readonly routePath?: string;
}

const visitorCookieName = "commerce_visitor";
const visitorIdPattern = /^[A-Za-z0-9_-]{8,128}$/u;
const visitorCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

const createDefaultVisitorId = (): string => crypto.randomUUID();

export const createServerApp = ({
  apiAssembly = defaultApiAssembly,
  auth,
  corsOrigin,
  createContext: createRequestContext,
  createVisitorId = createDefaultVisitorId,
  notificationEventRealtime,
}: CreateServerAppOptions) => {
  const app = new Hono();
  const router = apiAssembly.router as ServerTransportRouter;

  const apiHandler = new OpenAPIHandler(router, {
    plugins: [
      new OpenAPIReferencePlugin({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      }),
    ],
  });

  const rpcHandler = new RPCHandler(router);

  app.use(logger());
  app.use(
    "/*",
    cors({
      origin: corsOrigin,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );

  app.get("/", (c) => c.text("OK"));

  app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  const notificationEventRealtimeNamespace =
    notificationEventRealtime?.namespace;

  if (notificationEventRealtimeNamespace) {
    app.get(
      notificationEventRealtime.routePath ??
        "/api/notification-events/realtime",
      async (c) => {
        if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
          return c.text("Expected WebSocket upgrade", 426);
        }

        const context = await createRequestContext({ auth, context: c });

        if (!context.session?.user) {
          return c.text("Unauthorized", 401);
        }

        const decision = context.authorization.evaluatePermission({
          permission: notificationEventPermissions.eventRead,
          session: context.session,
        });

        if (!decision.allowed) {
          return c.text("Forbidden", 403);
        }

        const requestUrl = new URL(c.req.url);
        const scope = requestUrl.searchParams.get("scope") ?? "tenant:default";
        const actorId =
          typeof context.session.user === "object" &&
          context.session.user &&
          "id" in context.session.user
            ? String(context.session.user.id)
            : "admin";
        requestUrl.searchParams.set("scope", scope);
        requestUrl.searchParams.set("actorId", actorId);

        const stub = notificationEventRealtimeNamespace.getByName(scope);
        return stub.fetch(new Request(requestUrl, c.req.raw));
      }
    );
  }

  app.use("/*", async (c, next) => {
    const requestVisitorId = getCookie(c, visitorCookieName);
    const hasValidVisitorId =
      requestVisitorId !== undefined && visitorIdPattern.test(requestVisitorId);
    const visitorId = hasValidVisitorId ? requestVisitorId : createVisitorId();
    const context = await createRequestContext({
      auth,
      context: c,
      visitorId,
    });

    const persistVisitorId = () => {
      if (context.session || hasValidVisitorId) {
        return;
      }

      setCookie(c, visitorCookieName, visitorId, {
        httpOnly: true,
        maxAge: visitorCookieMaxAgeSeconds,
        path: "/",
        sameSite: "Lax",
        secure: new URL(c.req.url).protocol === "https:",
      });
    };

    const rpcResult = await rpcHandler.handle(c.req.raw, {
      prefix: "/rpc",
      context,
    });

    if (rpcResult.matched) {
      persistVisitorId();
      return c.newResponse(rpcResult.response.body, rpcResult.response);
    }

    const apiResult = await apiHandler.handle(c.req.raw, {
      prefix: "/api-reference",
      context,
    });

    if (apiResult.matched) {
      persistVisitorId();
      return c.newResponse(apiResult.response.body, apiResult.response);
    }

    await next();
  });

  return app;
};
