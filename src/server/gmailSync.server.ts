import { AiError } from "@/lib/ai.server";
import { classifyRecruitmentEmail } from "@/lib/email-classifier.server";
import { callAsAppUser, reconnectRequired } from "@/integrations/lovable/appUserConnector.server";
import { getConnectionKeyForUser } from "./appUserConnections.server";

const CONNECTOR_ID = "google_mail";
export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/gmail.readonly"];

type GmailPart = { mimeType?: string; headers?: Array<{ name: string; value: string }>; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = { id: string; historyId?: string; internalDate?: string; snippet?: string; payload?: GmailPart };

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

function alertKind(sender: string, subject: string) {
  const value = `${sender} ${subject}`.toLowerCase();
  if (value.includes("linkedin")) return "linkedin_alert" as const;
  if (value.includes("indeed")) return "indeed_alert" as const;
  if (value.includes("workday") || value.includes("myworkday")) return "workday_alert" as const;
  return "recruiter" as const;
}

function publicLinks(text: string) {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return [...new Set(matches.map((value) => value.replace(/[.,;]+$/, "")))].filter((value) => {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return ["linkedin.com", "indeed.com", "myworkdayjobs.com", "greenhouse.io", "lever.co", "ashbyhq.com"].some((domain) => host.includes(domain));
    } catch { return false; }
  }).slice(0, 3);
}

function applicationMatchScore(app: { id: string; job_id: string; created_at: string; jobs: { company_name: string; title: string } | null }, classification: { company_name: string }, subject: string, sender: string) {
  if (!app.jobs) return { score: 0, reason: "" };
  const company = classification.company_name.toLowerCase();
  const appCompany = app.jobs.company_name.toLowerCase();
  const title = app.jobs.title.toLowerCase();
  const haystack = `${subject} ${sender}`.toLowerCase();
  let score = 0; const reasons: string[] = [];
  if (company && (appCompany.includes(company) || company.includes(appCompany))) { score += 0.55; reasons.push("company"); }
  if (title.split(/\W+/).filter((word) => word.length > 4).some((word) => haystack.includes(word))) { score += 0.25; reasons.push("role title"); }
  if (haystack.includes(appCompany.split(/\W+/)[0] ?? "")) { score += 0.2; reasons.push("sender or subject"); }
  return { score, reason: reasons.join(", ") };
}

export async function registerGmailWatch(userId: string) {
  const key = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  if (!key) throw new Error("Connect Gmail before enabling inbox updates.");
  const topicName = process.env['GMAIL_PUBSUB_TOPIC'];
  if (!topicName) return { enabled: false as const, reason: "Google push notifications are not configured yet." };
  const response = await callAsAppUser(key, "/gmail/v1/users/me/watch", GMAIL_SCOPES, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterBehavior: "include" }) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Gmail notifications could not start (${response.status}): ${text.slice(0, 300)}`);
  const watch = JSON.parse(text) as { historyId?: string; expiration?: string };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("gmail_sync_state").upsert({ user_id: userId, history_id: watch.historyId ?? null, watch_expiration: watch.expiration ? new Date(Number(watch.expiration)).toISOString() : null, status: "ready", last_error: null }, { onConflict: "user_id" });
  return { enabled: true as const };
}

export async function syncGmailForUser(userId: string, maxMessages = 20) {
  const key = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  if (!key) return { ok: false as const, reconnectRequired: false, error: "Connect Gmail before checking your inbox." };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: state } = await supabaseAdmin.from("gmail_sync_state").select("history_id,status,lease_expires_at").eq("user_id", userId).maybeSingle();
  if (state?.status === "paused") return { ok: false as const, reconnectRequired: false, error: state.status };
  if (state?.lease_expires_at && new Date(state.lease_expires_at) > new Date()) return { ok: true as const, checked: 0, processed: 0, matched: 0 };
  await supabaseAdmin.from("gmail_sync_state").upsert({ user_id: userId, status: "syncing", lease_expires_at: new Date(Date.now() + 5 * 60_000).toISOString() }, { onConflict: "user_id" });
  try {
    let ids: string[] = [];
    let newestHistory = state?.history_id ?? null;
    if (state?.history_id) {
      const history = await callAsAppUser(key, `/gmail/v1/users/me/history?startHistoryId=${encodeURIComponent(state.history_id)}&historyTypes=messageAdded&labelId=INBOX&maxResults=${maxMessages}`, GMAIL_SCOPES);
      if (history.status !== 404) {
        if (await reconnectRequired(history)) return { ok: false as const, reconnectRequired: true, error: "Reconnect Gmail to continue." };
        if (!history.ok) throw new Error(`Gmail history check failed (${history.status}).`);
        const body = await history.json() as { historyId?: string; history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }> };
        ids = [...new Set((body.history ?? []).flatMap((entry) => entry.messagesAdded ?? []).flatMap((entry) => entry.message?.id ? [entry.message.id] : []))].slice(0, maxMessages);
        newestHistory = body.historyId ?? newestHistory;
      }
    }
    if (!state?.history_id || !newestHistory || ids.length === 0) {
      const query = 'newer_than:30d {application interview recruiter screening assessment offer rejection "next steps" "job alert"} -category:promotions';
      const list = await callAsAppUser(key, `/gmail/v1/users/me/messages?maxResults=${maxMessages}&q=${encodeURIComponent(query)}`, GMAIL_SCOPES);
      if (await reconnectRequired(list)) return { ok: false as const, reconnectRequired: true, error: "Reconnect Gmail to continue." };
      if (!list.ok) throw new Error(`Gmail inbox check failed (${list.status}).`);
      const body = await list.json() as { messages?: Array<{ id: string }> };
      ids = (body.messages ?? []).map((item) => item.id);
      const profile = await callAsAppUser(key, "/gmail/v1/users/me/profile", GMAIL_SCOPES);
      if (profile.ok) { const p = await profile.json() as { historyId?: string; emailAddress?: string }; newestHistory = p.historyId ?? newestHistory; await supabaseAdmin.from("gmail_sync_state").upsert({ user_id: userId, mailbox_email: p.emailAddress ?? null, history_id: newestHistory, status: "syncing", lease_expires_at: new Date(Date.now() + 5 * 60_000).toISOString() }, { onConflict: "user_id" }); }
    }
    const { data: seenRows } = ids.length ? await supabaseAdmin.from("processed_mail_messages").select("provider_message_id").eq("user_id", userId).eq("provider", "gmail").in("provider_message_id", ids) : { data: [] };
    const seen = new Set((seenRows ?? []).map((row) => row.provider_message_id));
    const fresh = ids.filter((id) => !seen.has(id)).slice(0, maxMessages);
    const { data: apps } = await supabaseAdmin.from("applications").select("id,job_id,created_at,jobs(company_name,title)").eq("user_id", userId);
    let processed = 0; let matched = 0;
    for (const id of fresh) {
      const response = await callAsAppUser(key, `/gmail/v1/users/me/messages/${id}?format=full&fields=id,historyId,internalDate,snippet,payload`, GMAIL_SCOPES);
      if (!response.ok) continue;
      const message = await response.json() as GmailMessage;
      const sender = header(message, "From"); const subject = header(message, "Subject"); const body = (bodyText(message.payload) || message.snippet || "").slice(0, 20_000);
      if (body.length < 5) continue;
      const kind = alertKind(sender, subject);
      const classification = await classifyRecruitmentEmail({ sender, subject, body });
      let alertJobsAdded = 0;
      if (kind !== "recruiter") {
        const { extractPublicJob } = await import("@/lib/discovery.server");
        for (const url of publicLinks(body)) {
          try {
            const extracted = await extractPublicJob(url);
            const { data: inserted, error } = await supabaseAdmin.from("jobs").upsert({ ...extracted, external_reference: extracted.external_reference ?? null, user_id: userId, source: kind.replace("_alert", "") }, { onConflict: "user_id,canonical_url", ignoreDuplicates: true }).select("id").maybeSingle();
            if (!error && inserted) alertJobsAdded += 1;
          } catch { /* Private, expired, or blocked alert links are not imported. */ }
        }
        await supabaseAdmin.from("source_connections").upsert({ user_id: userId, source: kind.replace("_alert", ""), enabled: true, status: "ready", last_synced_at: new Date().toISOString(), last_error: null }, { onConflict: "user_id,source" });
        if (alertJobsAdded > 0) await supabaseAdmin.from("application_events").insert({ user_id: userId, event_type: "roles_discovered", title: `${alertJobsAdded} verified role${alertJobsAdded === 1 ? "" : "s"} imported from ${kind.replace("_alert", "")}`, source: "gmail" });
      }
      const candidates = (apps ?? []).map((app) => ({ app, ...applicationMatchScore(app as { id: string; job_id: string; created_at: string; jobs: { company_name: string; title: string } | null }, classification, subject, sender) })).sort((a, b) => b.score - a.score);
      const best = candidates[0]; const nextBest = candidates[1];
      const confident = kind === "recruiter" && classification.confidence >= 0.75 && best && best.score >= 0.7 && (!nextBest || best.score - nextBest.score >= 0.15);
      const statusMap: Record<string, string | null> = { applied_ack: "applied", screening: "screening", interview_invite: "interviewing", offer: "offered", rejection: "rejected", action_required: null, informational: null };
      if (confident) {
        const next = statusMap[classification.status];
        await supabaseAdmin.from("applications").update({ ...(next ? { status: next } : {}), last_email_status: classification.status, next_action: classification.action_summary, updated_at: new Date().toISOString() }).eq("id", best.app.id).eq("user_id", userId);
        await supabaseAdmin.from("application_events").insert({ user_id: userId, application_id: best.app.id, job_id: best.app.job_id, event_type: "email_classified", title: "Recruitment email updated application", detail: `${classification.company_name}: ${classification.action_summary} · matched by ${best.reason}`, source: "gmail" });
        matched += 1;
      } else if (kind === "recruiter") {
        await supabaseAdmin.from("unmatched_mail_messages").upsert({ user_id: userId, provider: "gmail", provider_message_id: id, sender, subject, received_at: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null, classification: classification.status, company_name: classification.company_name, action_summary: classification.action_summary, match_reason: best?.reason || "No confident application match" }, { onConflict: "user_id,provider,provider_message_id" });
      }
      await supabaseAdmin.from("processed_mail_messages").upsert({ user_id: userId, provider: "gmail", provider_message_id: id, application_id: confident ? best.app.id : null, classification: classification.status, matched: Boolean(confident), sender, subject, received_at: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null, source_kind: kind, confidence: classification.confidence, company_name: classification.company_name, action_summary: kind === "recruiter" ? classification.action_summary : `${alertJobsAdded} verified posting${alertJobsAdded === 1 ? "" : "s"} imported`, match_reason: confident ? best.reason : null, provider_history_id: message.historyId ?? null, processed_at: new Date().toISOString() }, { onConflict: "user_id,provider,provider_message_id" });
      newestHistory = message.historyId ?? newestHistory; processed += 1;
    }
    const now = new Date().toISOString();
    await supabaseAdmin.from("gmail_sync_state").upsert({ user_id: userId, history_id: newestHistory, status: "ready", last_success_at: now, last_error: null, lease_expires_at: null }, { onConflict: "user_id" });
    await supabaseAdmin.from("source_connections").upsert({ user_id: userId, source: "gmail", enabled: true, status: "ready", last_synced_at: now, last_error: null }, { onConflict: "user_id,source" });
    return { ok: true as const, checked: ids.length, processed, matched };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail sync failed.";
    const paused = error instanceof AiError && [402, 403].includes(error.status);
    await supabaseAdmin.from("gmail_sync_state").upsert({ user_id: userId, status: paused ? "paused" : "needs_attention", last_error: message, lease_expires_at: null }, { onConflict: "user_id" });
    throw error;
  }
}