// Persistent agent heartbeat. Called by the scheduler (Docker sidecar or cron)
import type { Json } from "@/integrations/supabase/types";
// with the browser closed. Each user is processed under a lease so parallel
// ticks never double-run work. Every action is written to agent_activity.
import { registerGmailWatch, syncGmailForUser } from "./gmailSync.server";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function log(
  db: Admin,
  userId: string,
  task_type: string,
  status: "succeeded" | "failed" | "needs_you" | "skipped",
  summary: string,
  policy: string,
  detail: { [k: string]: Json } = {},
) {
  await db
    .from("agent_activity")
    .insert({ user_id: userId, task_type, status, summary, policy, detail });
}

export async function runAgentTick(maxUsers = 25) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: users, error } = await db
    .from("agent_settings")
    .select("user_id,autonomy")
    .eq("enabled", true)
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(maxUsers);
  if (error) throw error;
  const results: Array<{ userId: string; ok: boolean }> = [];
  for (const u of users ?? []) {
    const { data: claimed } = await db.rpc("claim_automation_job", {
      target_key: `agent:${u.user_id}`,
      target_type: "agent_tick",
      lease_seconds: 600,
    });
    if (!claimed) continue;
    let ok = true;
    try {
      ok = await runForUser(db, u.user_id, u.autonomy);
      await db
        .from("automation_jobs")
        .update({
          status: "idle",
          last_completed_at: new Date().toISOString(),
          lease_expires_at: null,
        })
        .eq("job_key", `agent:${u.user_id}`);
    } catch (e) {
      ok = false;
      const message = e instanceof Error ? e.message : "Unknown failure";
      await db
        .from("automation_jobs")
        .update({ status: "failed", last_error: message, lease_expires_at: null })
        .eq("job_key", `agent:${u.user_id}`);
      await log(
        db,
        u.user_id,
        "agent_tick",
        "failed",
        "The agent hit a problem and will retry next run.",
        u.autonomy,
        { error: message.slice(0, 300) },
      );
    }
    await db
      .from("agent_settings")
      .update({ last_run_at: new Date().toISOString() })
      .eq("user_id", u.user_id);
    results.push({ userId: u.user_id, ok });
  }
  const sponsor = await weeklySponsorCheck(db);
  return { processed: results.length, failed: results.filter((r) => !r.ok).length, sponsor };
}

async function weeklySponsorCheck(db: Admin) {
  const { data: job } = await db
    .from("automation_jobs")
    .select("last_completed_at")
    .eq("job_key", "sponsor_refresh")
    .maybeSingle();
  if (
    job?.last_completed_at &&
    Date.now() - new Date(job.last_completed_at).getTime() < 7 * 86400_000
  )
    return "fresh";
  const { data: claimed } = await db.rpc("claim_automation_job", {
    target_key: "sponsor_refresh",
    target_type: "refresh_sponsor_snapshot",
    lease_seconds: 900,
  });
  if (!claimed) return "busy";
  try {
    const { refreshSponsorRegister } = await import("./sponsorRefresh.server");
    const r = await refreshSponsorRegister();
    await db
      .from("automation_jobs")
      .update({
        status: "idle",
        last_completed_at: new Date().toISOString(),
        lease_expires_at: null,
      })
      .eq("job_key", "sponsor_refresh");
    return r.updated ? "updated" : "unchanged";
  } catch (e) {
    await db
      .from("automation_jobs")
      .update({ status: "failed", last_error: String(e).slice(0, 500), lease_expires_at: null })
      .eq("job_key", "sponsor_refresh");
    return "failed";
  }
}

async function runForUser(db: Admin, userId: string, policy: string) {
  let ok = true;
  // 1. Inbox: only if this user connected Gmail.
  const { data: conn } = await db
    .from("app_user_connections")
    .select("user_id")
    .eq("user_id", userId)
    .eq("connector_id", "google_mail")
    .maybeSingle();
  if (conn) {
    const r = await syncGmailForUser(userId, 25);
    if (!r.ok) {
      ok = false;
      await log(
        db,
        userId,
        "process_gmail_history",
        r.reconnectRequired ? "needs_you" : "failed",
        r.reconnectRequired
          ? "Gmail needs reconnecting before the agent can read new recruiter mail."
          : `Inbox check failed: ${r.error}`,
        policy,
      );
    } else if (r.processed) {
      await log(
        db,
        userId,
        "process_gmail_history",
        "succeeded",
        `Checked ${r.processed} new message${r.processed === 1 ? "" : "s"}; ${r.matched} application${r.matched === 1 ? "" : "s"} updated.`,
        policy,
        { checked: r.checked },
      );
    }
    // 2. Renew Gmail watch when within 24h of expiry (push only when configured).
    const { data: state } = await db
      .from("gmail_sync_state")
      .select("watch_expiration")
      .eq("user_id", userId)
      .maybeSingle();
    const exp = state?.watch_expiration ? new Date(state.watch_expiration).getTime() : 0;
    if (process.env["GMAIL_PUBSUB_TOPIC"] && exp - Date.now() < 24 * 3600_000) {
      try {
        const w = await registerGmailWatch(userId);
        if (w.enabled)
          await log(
            db,
            userId,
            "renew_gmail_watch",
            "succeeded",
            "Renewed live Gmail notifications.",
            policy,
          );
      } catch (e) {
        ok = false;
        await log(
          db,
          userId,
          "renew_gmail_watch",
          "failed",
          "Could not renew live Gmail notifications; scheduled checks continue.",
          policy,
          { error: String(e).slice(0, 300) },
        );
      }
    }
  }
  // 3. Follow-ups: applications submitted 7+ days ago with no newer event.
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: stale } = await db
    .from("applications")
    .select("id,updated_at,next_action")
    .eq("user_id", userId)
    .eq("status", "applied")
    .lt("updated_at", weekAgo)
    .limit(10);
  for (const app of stale ?? []) {
    if (app.next_action?.startsWith("Follow up")) continue;
    await db
      .from("applications")
      .update({ next_action: "Follow up — no response after 7 days" })
      .eq("id", app.id);
    await db.from("agent_activity").insert({
      user_id: userId,
      application_id: app.id,
      task_type: "schedule_follow_up",
      status: "needs_you",
      summary: "No reply after 7 days — a follow-up is due.",
      policy,
    });
  }
  return ok;
}

export function checkConfiguration() {
  const has = (k: string) => Boolean(process.env[k]);
  return {
    database: has("SUPABASE_URL") && has("SUPABASE_SERVICE_ROLE_KEY"),
    ai: has("AI_BASE_URL") && has("AI_MODEL"),
    jobLinkReading: has("FIRECRAWL_API_KEY") || has("FIRECRAWL_API_URL"),
    gmail:
      has("GOOGLE_CLIENT_ID") &&
      has("GOOGLE_CLIENT_SECRET") &&
      has("APP_USER_CONNECTION_KEY_SECRET"),
    gmailLiveUpdates: has("GMAIL_PUBSUB_TOPIC") && has("GMAIL_PUBSUB_SERVICE_ACCOUNT"),
    scheduler: has("AGENT_TICK_SECRET"),
  };
}

/** Run the agent once for a single signed-in user (the "Run now" button). */
export async function runAgentForUser(userId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: s } = await db
    .from("agent_settings")
    .select("autonomy")
    .eq("user_id", userId)
    .maybeSingle();
  const ok = await runForUser(db, userId, s?.autonomy ?? "review_first");
  await db
    .from("agent_settings")
    .upsert({ user_id: userId, last_run_at: new Date().toISOString() }, { onConflict: "user_id" });
  await log(
    db,
    userId,
    "agent_tick",
    ok ? "succeeded" : "failed",
    ok ? "Manual agent run finished." : "Manual run finished with problems — see entries above.",
    s?.autonomy ?? "review_first",
  );
  return { ok };
}
