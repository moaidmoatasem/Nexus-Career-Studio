import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SyncHealth } from "./syncHealth";

/** Facts for the stale-sync banner: no Gmail request is made, only stored state is read. */
export const getSyncHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncHealth> => {
    const { hasGmailConnection } = await import("@/server/gmailApi.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const connected = await hasGmailConnection(context.userId);
    const { data: sync } = connected
      ? await supabaseAdmin
          .from("gmail_sync_state")
          .select("status,last_success_at,last_error,created_at")
          .eq("user_id", context.userId)
          .maybeSingle()
      : { data: null };
    const { data: agent } = await context.supabase
      .from("agent_settings")
      .select("enabled,last_run_at,updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      gmail: {
        connected,
        status: sync?.status ?? null,
        lastSuccessAt: sync?.last_success_at ?? null,
        since: sync?.created_at ?? null,
        lastError: sync?.last_error ?? null,
      },
      scheduler: {
        enabled: agent?.enabled ?? false,
        lastRunAt: agent?.last_run_at ?? null,
        since: agent?.updated_at ?? null,
      },
    };
  });
