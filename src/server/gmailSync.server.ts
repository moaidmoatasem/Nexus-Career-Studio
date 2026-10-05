import { AiError } from "@/lib/ai.server";
import { classifyRecruitmentEmail } from "@/lib/email-classifier.server";
import { jobLinks, mailSourceKind, matchApplication } from "@/lib/mailMatch";
import { isSubmittedStage, nextStageFromEmail, stageForEmail } from "@/lib/stages";
import { gmailFetch, GmailReconnectError, hasGmailConnection } from "./gmailApi.server";
/** Classifier confidence required before an email may change an application. */
const MIN_CLASSIFIER_CONFIDENCE = 0.75;

type GmailPart = { mimeType?: string; headers?: Array<{ name: string; value: string }>; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = { id: string; historyId?: string; internalDate?: string; snippet?: string; payload?: GmailPart };
type AppRow = { id: string; job_id: string; status: string; applied_at: string | null; jobs: { company_name: string; title: string } | null };

function header(message: GmailMessage, name: string) { return message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? ""; }
function decodeBase64Url(data: string) {
  const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function bodyText(part?: GmailPart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
  for (const child of part.parts ?? []) { const text = bodyText(child); if (text) return text; }
  return part.body?.data ? decodeBase64Url(part.body.data) : "";
}

export async function registerGmailWatch(userId: string) {
  if (!(await hasGmailConnection(userId))) throw new Error("Connect Gmail before enabling inbox updates.");
  const topicName = process.env['GMAIL_PUBSUB_TOPIC'];
  if (!topicName) return { enabled: false as const, reason: "Google push notifications are not configured yet." };
  // The push endpoint rejects every notification without this, so don't start a watch that can't be delivered.
  if (!process.env['GMAIL_PUBSUB_SERVICE_ACCOUNT']) return { enabled: false as const, reason: "Google push notifications need GMAIL_PUBSUB_SERVICE_ACCOUNT on the server." };
  const response = await gmailFetch(userId, "/gmail/v1/users/me/watch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterBehavior: "include" }) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Gmail notifications could not start (${response.status}): ${text.slice(0, 300)}`);
  const watch = JSON.parse(text) as { historyId?: string; expiration?: string };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("gmail_sync_state").upsert({ user_id: userId, history_id: watch.historyId ?? null, watch_expiration: watch.expiration ? new Date(Number(watch.expiration)).toISOString() : null, status: "ready", last_error: null }, { onConflict: "user_id" });
  return { enabled: true as const };
}

export async function syncGmailForUser(userId: string, maxMessages = 20) {
  if (!(await hasGmailConnection(userId))) return { ok: false as const, reconnectRequired: false, error: "Connect Gmail before checking your inbox." };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: state } = await supabaseAdmin.from("gmail_sync_state").select("history_id,status,lease_expires_at").eq("user_id", userId).maybeSingle();
  if (state?.status === "paused") return { ok: false as const, reconnectRequired: false, error: state.status };
  if (state?.lease_expires_at && new Date(state.lease_expires_at) > new Date()) return { ok: true as const, checked: 0, processed: 0, matched: 0 };
  await supabaseAdmin.from("gmail_sync_state").upsert({ user_id: userId, status: "syncing", lease_expires_at: new Date(Date.now() + 5 * 60_000).toISOString() }, { onConflict: "user_id" });
  // Releases the lease and flags the connection so the UI shows "Reconnect needed" instead of "Syncing".
  const needsReconnect = async () => {
    const message = "Reconnect Gmail to continue.";
    await supabaseAdmin.from("gmail_sync_state").upsert({ user_id: userId, status: "needs_attention", last_error: message, lease_expires_at: null }, { onConflict: "user_id" });
    await supabaseAdmin.from("source_connections").upsert({ user_id: userId, source: "gmail", enabled: true, status: "needs_attention", last_error: message }, { onConflict: "user_id,source" });
    return { ok: false as const, reconnectRequired: true, error: message };
  };
  try {
    let ids: string[] = [];
    let newestHistory = state?.history_id ?? null;
    if (state?.history_id) {
      const history = await gmailFetch(userId, `/gmail/v1/users/me/history?startHistoryId=${encodeURIComponent(state.history_id)}&historyTypes=messageAdded&labelId=INBOX&maxResults=${maxMessages}`);
      if (history.status !== 404) {
        if (!history.ok) throw new Error(`Gmail history check failed (${history.status}).`);
        const body = await history.json() as { historyId?: string; history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }> };
        ids = [...new Set((body.history ?? []).flatMap((entry) => entry.messagesAdded ?? []).flatMap((entry) => entry.message?.id ? [entry.message.id] : []))].slice(0, maxMessages);
        newestHistory = body.historyId ?? newestHistory;
      }
    }
    if (!state?.history_id || !newestHistory || ids.length === 0) {
      const query = 'newer_than:30d {application interview recruiter screening assessment offer rejection "next steps" "job alert"} -category:promotions';
      const list = await gmailFetch(userId, `/gmail/v1/users/me/messages?maxResults=${maxMessages}&q=${encodeURIComponent(query)}`);
      if (!list.ok) throw new Error(`Gmail inbox check failed (${list.status}).`);
      const body = await list.json() as { messages?: Array<{ id: string }> };
      ids = (body.messages ?? []).map((item) => item.id);
      const profile = await gmailFetch(userId, "/gmail/v1/users/me/profile");
      if (profile.ok) { const p = await profile.json() as { historyId?: string; emailAddress?: string }; newestHistory = p.historyId ?? newestHistory; await supabaseAdmin.from("gmail_sync_state").upsert({ user_id: userId, mailbox_email: p.emailAddress ?? null, history_id: newestHistory, status: "syncing", lease_expires_at: new Date(Date.now() + 5 * 60_000).toISOString() }, { onConflict: "user_id" }); }
    }
    const { data: seenRows } = ids.length ? await supabaseAdmin.from("processed_mail_messages").select("provider_message_id").eq("user_id", userId).eq("provider", "gmail").in("provider_message_id", ids) : { data: [] };
    const seen = new Set((seenRows ?? []).map((row) => row.provider_message_id));
    const fresh = ids.filter((id) => !seen.has(id)).slice(0, maxMessages);
    const { data: appRows } = await supabaseAdmin.from("applications").select("id,job_id,status,applied_at,jobs(company_name,title)").eq("user_id", userId);
    const apps = (appRows ?? []) as AppRow[];
    let processed = 0; let matched = 0;
    for (const id of fresh) {
      const response = await gmailFetch(userId, `/gmail/v1/users/me/messages/${id}?format=full&fields=id,historyId,internalDate,snippet,payload`);
      if (!response.ok) continue;
      const message = await response.json() as GmailMessage;
      const sender = header(message, "From"); const subject = header(message, "Subject"); const body = (bodyText(message.payload) || message.snippet || "").slice(0, 20_000);
      if (body.length < 5) continue;
      const receivedAt = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null;
      const kind = mailSourceKind(sender, subject);
      const classification = await classifyRecruitmentEmail({ sender, subject, body });
      let alertJobsAdded = 0;
      if (kind !== "recruiter") {
        const source = kind.replace("_alert", "");
        const { canonicalizeJobUrl, extractPublicJob, knownJobUrls, saveJobForUser } = await import("@/lib/discovery.server");
        const links = [...new Set(jobLinks(body).flatMap((url) => { try { return [canonicalizeJobUrl(url)]; } catch { return []; } }))];
        const known = await knownJobUrls(supabaseAdmin, userId, links).catch(() => new Set<string>());
        for (const url of links.filter((u) => !known.has(u))) {
          try {
            const saved = await saveJobForUser(supabaseAdmin, userId, await extractPublicJob(url), source);
            if (saved.status === "added") alertJobsAdded += 1;
            else if (saved.status === "failed") console.error("Alert role could not be saved", saved.error);
          } catch { /* Private, expired, or blocked alert links are not imported. */ }
        }
        await supabaseAdmin.from("source_connections").upsert({ user_id: userId, source, enabled: true, status: "ready", last_synced_at: new Date().toISOString(), last_error: null }, { onConflict: "user_id,source" });
        if (alertJobsAdded > 0) await supabaseAdmin.from("application_events").insert({ user_id: userId, event_type: "roles_discovered", title: `${alertJobsAdded} verified role${alertJobsAdded === 1 ? "" : "s"} imported from ${source}`, source: "gmail" });
      }
      const match = kind === "recruiter" ? matchApplication(apps, { companyName: classification.company_name, subject, sender, body }) : null;
      const confident = Boolean(match?.app) && classification.confidence >= MIN_CLASSIFIER_CONFIDENCE;
      const app = confident ? match?.app ?? null : null;
      if (app) {
        const next = nextStageFromEmail(app.status, stageForEmail(classification.status));
        const now = new Date().toISOString();
        const appliedAt = next && isSubmittedStage(next) && !app.applied_at ? receivedAt ?? now : null;
        await supabaseAdmin.from("applications").update({ ...(next ? { status: next } : {}), ...(appliedAt ? { applied_at: appliedAt } : {}), last_email_status: classification.status, next_action: classification.action_summary, updated_at: now }).eq("id", app.id).eq("user_id", userId);
        if (next) { app.status = next; if (appliedAt) app.applied_at = appliedAt; }
        const stageNote = next ? `moved to ${next}` : `stage kept at ${app.status}`;
        await supabaseAdmin.from("application_events").insert({ user_id: userId, application_id: app.id, job_id: app.job_id, event_type: "email_classified", title: "Recruitment email updated application", detail: `${classification.company_name}: ${classification.action_summary} · ${stageNote} · matched by ${match?.reason ?? "employer and role"}`, source: "gmail" });
        matched += 1;
      } else if (kind === "recruiter") {
        const reason = match?.app ? `Classifier confidence ${Math.round(classification.confidence * 100)}% is below the automatic-update bar` : match?.reason ?? "No confident application match";
        await supabaseAdmin.from("unmatched_mail_messages").upsert({ user_id: userId, provider: "gmail", provider_message_id: id, sender, subject, received_at: receivedAt, classification: classification.status, company_name: classification.company_name, action_summary: classification.action_summary, match_reason: reason }, { onConflict: "user_id,provider,provider_message_id" });
      }
      await supabaseAdmin.from("processed_mail_messages").upsert({ user_id: userId, provider: "gmail", provider_message_id: id, application_id: app?.id ?? null, classification: classification.status, matched: Boolean(app), sender, subject, received_at: receivedAt, source_kind: kind, confidence: classification.confidence, company_name: classification.company_name, action_summary: kind === "recruiter" ? classification.action_summary : `${alertJobsAdded} verified posting${alertJobsAdded === 1 ? "" : "s"} imported`, match_reason: app ? match?.reason ?? null : null, provider_history_id: message.historyId ?? null, processed_at: new Date().toISOString() }, { onConflict: "user_id,provider,provider_message_id" });
      newestHistory = message.historyId ?? newestHistory; processed += 1;
    }
    const now = new Date().toISOString();
    await supabaseAdmin.from("gmail_sync_state").upsert({ user_id: userId, history_id: newestHistory, status: "ready", last_success_at: now, last_error: null, lease_expires_at: null }, { onConflict: "user_id" });
    await supabaseAdmin.from("source_connections").upsert({ user_id: userId, source: "gmail", enabled: true, status: "ready", last_synced_at: now, last_error: null }, { onConflict: "user_id,source" });
    return { ok: true as const, checked: ids.length, processed, matched };
  } catch (error) {
    if (error instanceof GmailReconnectError) return await needsReconnect();
    const message = error instanceof Error ? error.message : "Gmail sync failed.";
    const paused = error instanceof AiError && [402, 403].includes(error.status);
    await supabaseAdmin.from("gmail_sync_state").upsert({ user_id: userId, status: paused ? "paused" : "needs_attention", last_error: message, lease_expires_at: null }, { onConflict: "user_id" });
    throw error;
  }
}
