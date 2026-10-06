import { createFileRoute } from "@tanstack/react-router";

// Public health check: reports which capabilities are configured (never values).
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const { checkConfiguration } = await import("@/server/agentRunner.server");
        const config = checkConfiguration();
        return Response.json(
          { status: config.database ? "ok" : "degraded", config, time: new Date().toISOString() },
          { status: config.database ? 200 : 503 },
        );
      },
    },
  },
});
