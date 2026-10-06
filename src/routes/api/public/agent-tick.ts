import { createFileRoute } from "@tanstack/react-router";

async function sameSecret(a: string, b: string) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const xa = new Uint8Array(x),
    ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= (xa[i] ?? 0) ^ (ya[i] ?? 0);
  return diff === 0;
}

// Scheduler heartbeat. Protected by AGENT_TICK_SECRET (Bearer token).
export const Route = createFileRoute("/api/public/agent-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["AGENT_TICK_SECRET"];
        const token = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
        if (!expected || !token || !(await sameSecret(token, expected)))
          return new Response("Unauthorized", { status: 401 });
        const { runAgentTick } = await import("@/server/agentRunner.server");
        try {
          return Response.json(await runAgentTick());
        } catch (e) {
          console.error("agent tick failed", e);
          return Response.json({ error: "Agent run failed" }, { status: 500 });
        }
      },
    },
  },
});
