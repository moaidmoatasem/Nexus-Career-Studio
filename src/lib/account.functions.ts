import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OWN_TABLES = ["vault_items", "applications", "application_events", "role_decisions", "source_connections", "discovery_runs", "agent_settings", "agent_activity", "portal_tasks", "unmatched_mail_messages", "processed_mail_messages"] as const;
const SCREENSHOT_BUCKET = "portal-screenshots";

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
    const problems: string[] = [];
    const notes: string[] = [];

    // Revoke Gmail access first so no mailbox grant outlives the account. An unreadable
    // handle is still deleted; a failed revoke is reported so the user can remove access at Google.
    const { getConnectionKeyForUser, deleteConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const key = await getConnectionKeyForUser(uid, "google_mail").catch(() => null);
    if (key) {
      const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector.server");
      await disconnectAppUser(key).catch(() => notes.push("Gmail access could not be revoked automatically — remove Nexus under Third-party connections at myaccount.google.com."));
    }
    await deleteConnectionKeyForUser(uid, "google_mail").catch((e: unknown) => problems.push(`gmail connection: ${e instanceof Error ? e.message : String(e)}`));

    // Portal helper screenshots live in storage, outside the tables below.
    const { data: shots, error: listError } = await db.storage.from(SCREENSHOT_BUCKET).list(uid, { limit: 1000 });
    if (listError && !/not found/i.test(listError.message)) problems.push(`screenshots: ${listError.message}`);
    if (shots?.length) {
      const { error } = await db.storage.from(SCREENSHOT_BUCKET).remove(shots.map((f) => `${uid}/${f.name}`));
      if (error) problems.push(`screenshots: ${error.message}`);
    }

    for (const t of ["portal_tasks", "agent_activity", "agent_settings", "application_events", "unmatched_mail_messages", "processed_mail_messages", "gmail_sync_state", "applications", "role_decisions", "discovery_runs", "source_connections", "vault_items"] as const) {
      const { error } = await db.from(t).delete().eq("user_id", uid);
      if (error) problems.push(`${t}: ${error.message}`);
    }
    const { error: jobsError } = await db.from("jobs").delete().eq("user_id", uid);
    if (jobsError) problems.push(`jobs: ${jobsError.message}`);
    const { error: profileError } = await db.from("profiles").delete().eq("id", uid);
    if (profileError) problems.push(`profile: ${profileError.message}`);

    // Keep the sign-in if anything is left behind, so the user can retry rather than lose access to leftovers.
    if (problems.length) throw new Error(`Some of your data could not be deleted, so your account was kept. Try again or contact the site owner. (${problems.join("; ")})`);
    const { error } = await db.auth.admin.deleteUser(uid);
    if (error) throw new Error(`Your data was removed but the sign-in could not be deleted: ${error.message}`);
    return { ok: true, notes };
  });
