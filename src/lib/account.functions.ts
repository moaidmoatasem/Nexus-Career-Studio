import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OWN_TABLES = ["vault_items", "applications", "application_events", "role_decisions", "source_connections", "discovery_runs", "agent_settings", "agent_activity", "portal_tasks", "unmatched_mail_messages"] as const;

export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const out: Record<string, unknown> = { exported_at: new Date().toISOString(), user_id: context.userId };
    out["profile"] = (await db.from("profiles").select("*").eq("id", context.userId).maybeSingle()).data;
    for (const t of OWN_TABLES) out[t] = (await db.from(t).select("*").eq("user_id", context.userId)).data ?? [];
    out["jobs_added_by_you"] = (await db.from("jobs").select("*").eq("user_id", context.userId)).data ?? [];
    return JSON.stringify(out, null, 2);
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ confirm: z.literal("DELETE") }).parse(d))
  .handler(async ({ context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    // Revoke Gmail access first so no mailbox handle outlives the account.
    try {
      const { getConnectionKeyForUser, deleteConnectionKeyForUser } = await import("@/server/appUserConnections.server");
      const key = await getConnectionKeyForUser(uid, "google_mail");
      if (key) { const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector.server"); await disconnectAppUser(key).catch(() => undefined); }
      await deleteConnectionKeyForUser(uid, "google_mail");
    } catch { /* continue: account deletion must not be blocked */ }
    for (const t of ["portal_tasks", "agent_activity", "agent_settings", "application_events", "unmatched_mail_messages", "processed_mail_messages", "gmail_sync_state", "applications", "role_decisions", "discovery_runs", "source_connections", "vault_items"] as const) {
      await db.from(t).delete().eq("user_id", uid);
    }
    await db.from("jobs").delete().eq("user_id", uid);
    await db.from("profiles").delete().eq("id", uid);
    const { error } = await db.auth.admin.deleteUser(uid);
    if (error) throw new Error(`Your data was removed but the sign-in could not be deleted: ${error.message}`);
    return { ok: true };
  });
