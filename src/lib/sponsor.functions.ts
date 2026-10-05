import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Any signed-in user may ask for a check; import only happens when GOV.UK has a newer file,
// and a shared lease prevents parallel imports.
export const checkSponsorRegister = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claimed } = await supabaseAdmin.rpc("claim_automation_job", { target_key: "sponsor_refresh", target_type: "refresh_sponsor_snapshot", lease_seconds: 900 });
    if (!claimed) return { updated: false, message: "A register update is already running. Try again in a few minutes." };
    try {
      const { refreshSponsorRegister } = await import("@/server/sponsorRefresh.server");
      const r = await refreshSponsorRegister();
      await supabaseAdmin.from("automation_jobs").update({ status: "idle", last_completed_at: new Date().toISOString(), lease_expires_at: null }).eq("job_key", "sponsor_refresh");
      return { updated: r.updated, message: r.updated ? `Updated to the latest official register (${r.rows.toLocaleString()} sponsors).` : r.reason };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Update failed";
      await supabaseAdmin.from("automation_jobs").update({ status: "failed", last_error: message, lease_expires_at: null }).eq("job_key", "sponsor_refresh");
      return { updated: false, message: `Could not update: ${message}` };
    }
  });
