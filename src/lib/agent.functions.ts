import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const runMyAgentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { runAgentForUser } = await import("@/server/agentRunner.server");
    return runAgentForUser(context.userId);
  });

export const getAgentHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { checkConfiguration } = await import("@/server/agentRunner.server");
    return checkConfiguration();
  });
