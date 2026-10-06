import { AiError, UsageLimitError } from "@/lib/ai.server";
import { classifyRecruitmentEmail, type EmailClassification } from "@/lib/email-classifier.server";
import { assessMailRisk, shouldFetchMessage } from "@/lib/mailFilter";
import { jobLinks, mailSourceKind, matchApplication } from "@/lib/mailMatch";
import { isSubmittedStage, nextStageFromEmail, stageForEmail } from "@/lib/stages";
import { gmailFetch, GmailReconnectError, hasGmailConnection } from "./gmailApi.server";
/** A message that fails this many times is skipped for good so it never blocks the sync. */
const MAX_MESSAGE_ATTEMPTS = 3;
/** Classifier confidence required before an email may change an application. */
const MIN_CLASSIFIER_CONFIDENCE = 0.75;

type GmailPart = {
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  historyId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart;
};
type AppRow = {
  id: string;
  job_id: string;
  status: string;
  applied_at: string | null;
  jobs: { company_name: string; title: string } | null;
};

function header(message: GmailMessage, name: string) {
  return (
    message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}
function decodeBase64Url(data: string) {
  const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function bodyText(part?: GmailPart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
  for (const child of part.parts ?? []) {
    const text = bodyText(child);
    if (text) return text;
  }
  return part.body?.data ? decodeBase64Url(part.body.data) : "";
}

export async function registerGmailWatch(userId: string) {
  if (!(await hasGmailConnection(userId)))
    throw new Error("Connect Gmail before enabling inbox updates.");
  const topicName = process.env["GMAIL_PUBSUB_TOPIC"];
  if (!topicName)
    return { enabled: false as const, reason: "Google push notifications are not configured yet." };
  // The push endpoint rejects every notification without this, so don't start a watch that can't be delivered.
  if (!process.env["GMAIL_PUBSUB_SERVICE_ACCOUNT"])
    return {
      enabled: false as const,
      reason: "Google push notifications need GMAIL_PUBSUB_SERVICE_ACCOUNT on the server.",
    };
  const response = await gmailFetch(userId, "/gmail/v1/users/me/watch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterBehavior: "include" }),
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(
      `Gmail notifications could not start (${response.status}): ${text.slice(0, 300)}`,
    );
  const watch = JSON.parse(text) as { historyId?: string; expiration?: string };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("gmail_sync_state").upsert(
    {
      user_id: userId,
      history_id: watch.historyId ?? null,
      watch_expiration: watch.expiration ? new Date(Number(watch.expiration)).toISOString() : null,
      status: "ready",
      last_error: null,
    },
    { onConflict: "user_id" },
  );
  return { enabled: true as const };
}

export const PAUSED_MESSAGE =
  "The AI provider rejected the key or is out of credits. Fix AI_API_KEY or add credits; Nexus retries once a day, or press Check inbox now.";

export async function syncGmailForUser(
  userId: string,
  maxMessages = 20,
  options: {
    /** The user asked for this check, so a paused sync is retried now. */
    manual?: boolean;
    /** A paused sync is retried once it has been paused this long (the agent passes one day). */
    retryPausedAfterMs?: number;
  } = {},
) {
  if (!(await hasGmailConnection(userId)))
    return {
      ok: false as const,
      reconnectRequired: false,
      error: "Connect Gmail before checking your inbox.",
    };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: state } = await supabaseAdmin
    .from("gmail_sync_state")
    .select("history_id,status,lease_expires_at,paused_at,last_error")
    .eq("user_id", userId)
    .maybeSingle();
  if (state?.status === "paused") {
    // A paused sync is retried when the user presses "Check inbox now" or, from the agent, once a day.
    const pausedFor = state.paused_at ? Date.now() - Date.parse(state.paused_at) : Infinity;
    const retry =
      options.manual ||
      (options.retryPausedAfterMs !== undefined && pausedFor >= options.retryPausedAfterMs);
    if (!retry)
      return {
        ok: false as const,
        paused: true as const,
        reconnectRequired: false,
        error: state.last_error ?? PAUSED_MESSAGE,
      };
  }
  if (state?.lease_expires_at && new Date(state.lease_expires_at) > new Date())
    return { ok: true as const, checked: 0, processed: 0, matched: 0 };
  await supabaseAdmin.from("gmail_sync_state").upsert(
    {
      user_id: userId,
      status: "syncing",
      lease_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    },
    { onConflict: "user_id" },
  );
  // Releases the lease and flags the connection so the UI shows "Reconnect needed" instead of "Syncing".
  const needsReconnect = async () => {
    const message = "Reconnect Gmail to continue.";
    await supabaseAdmin
      .from("gmail_sync_state")
      .upsert(
        { user_id: userId, status: "needs_attention", last_error: message, lease_expires_at: null },
        { onConflict: "user_id" },
      );
    await supabaseAdmin.from("source_connections").upsert(
      {
        user_id: userId,
        source: "gmail",
        enabled: true,
        status: "needs_attention",
        last_error: message,
      },
      { onConflict: "user_id,source" },
    );
    return { ok: false as const, reconnectRequired: true, error: message };
  };
  try {
    let ids: string[] = [];
    let newestHistory = state?.history_id ?? null;
    if (state?.history_id) {
      const history = await gmailFetch(
        userId,
        `/gmail/v1/users/me/history?startHistoryId=${encodeURIComponent(state.history_id)}&historyTypes=messageAdded&labelId=INBOX&maxResults=${maxMessages}`,
      );
      if (history.status !== 404) {
        if (!history.ok) throw new Error(`Gmail history check failed (${history.status}).`);
        const body = (await history.json()) as {
          historyId?: string;
          history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }>;
        };
        ids = [
          ...new Set(
            (body.history ?? [])
              .flatMap((entry) => entry.messagesAdded ?? [])
              .flatMap((entry) => (entry.message?.id ? [entry.message.id] : [])),
          ),
        ].slice(0, maxMessages);
        newestHistory = body.historyId ?? newestHistory;
      }
    }
    if (!state?.history_id || !newestHistory || ids.length === 0) {
      const query =
        'newer_than:30d {application interview recruiter screening assessment offer rejection "next steps" "job alert"} -category:promotions';
      const list = await gmailFetch(
        userId,
        `/gmail/v1/users/me/messages?maxResults=${maxMessages}&q=${encodeURIComponent(query)}`,
      );
      if (!list.ok) throw new Error(`Gmail inbox check failed (${list.status}).`);
      const body = (await list.json()) as { messages?: Array<{ id: string }> };
      ids = (body.messages ?? []).map((item) => item.id);
      const profile = await gmailFetch(userId, "/gmail/v1/users/me/profile");
      if (profile.ok) {
        const p = (await profile.json()) as { historyId?: string; emailAddress?: string };
        newestHistory = p.historyId ?? newestHistory;
        await supabaseAdmin.from("gmail_sync_state").upsert(
          {
            user_id: userId,
            mailbox_email: p.emailAddress ?? null,
            history_id: newestHistory,
            status: "syncing",
            lease_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          },
          { onConflict: "user_id" },
        );
      }
    }
    const { data: seenRows } = ids.length
      ? await supabaseAdmin
          .from("processed_mail_messages")
          .select("provider_message_id,status,attempts")
          .eq("user_id", userId)
          .eq("provider", "gmail")
          .in("provider_message_id", ids)
      : { data: [] };
    const seen = new Set(
      (seenRows ?? []).filter((row) => row.status !== "failed").map((r) => r.provider_message_id),
    );
    const failedBefore = new Map(
      (seenRows ?? [])
        .filter((row) => row.status === "failed")
        .map((row) => [row.provider_message_id, row.attempts] as const),
    );
    const fresh = ids.filter((id) => !seen.has(id)).slice(0, maxMessages);
    const { data: appRows } = await supabaseAdmin
      .from("applications")
      .select("id,job_id,status,applied_at,jobs(company_name,title)")
      .eq("user_id", userId);
    const apps = (appRows ?? []) as AppRow[];
    let processed = 0;
    let matched = 0;
    let skipped = 0;
    const employers = apps.flatMap((a) => (a.jobs?.company_name ? [a.jobs.company_name] : []));
    // Skipped mail keeps only its id and the reason, so it is never read or stored again.
    const markSkipped = async (id: string, reason: string) => {
      await supabaseAdmin.from("processed_mail_messages").upsert(
        {
          user_id: userId,
          provider: "gmail",
          provider_message_id: id,
          status: "skipped",
          skip_reason: reason,
          attempts: 0,
          source_kind: "other",
          classification: null,
          matched: false,
          sender: "",
          subject: "",
          processed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider,provider_message_id" },
      );
      skipped += 1;
    };
    const handleMessage = async (id: string): Promise<void> => {
      // Headers first: the decision to read a message at all never needs its content.
      const peek = await gmailFetch(
        userId,
        `/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&fields=id,labelIds,payload/headers`,
      );
      if (!peek.ok) throw new Error(`Gmail message check failed (${peek.status}).`);
      const head = (await peek.json()) as GmailMessage & { labelIds?: string[] };
      const decision = shouldFetchMessage({
        sender: header(head, "From"),
        subject: header(head, "Subject"),
        labelIds: head.labelIds ?? [],
        employers,
      });
      if (!decision.fetch) return markSkipped(id, decision.reason);
      const response = await gmailFetch(
        userId,
        `/gmail/v1/users/me/messages/${id}?format=full&fields=id,historyId,internalDate,snippet,payload`,
      );
      if (!response.ok) throw new Error(`Gmail message fetch failed (${response.status}).`);
      const message = (await response.json()) as GmailMessage;
      const sender = header(message, "From");
      const subject = header(message, "Subject");
      const body = (bodyText(message.payload) || message.snippet || "").slice(0, 20_000);
      if (body.length < 5) return markSkipped(id, "empty_message");
      const receivedAt = message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : null;
      const kind = mailSourceKind(sender, subject);
      if (kind === "gulf_board_alert") {
        // Recognised so it never reaches the AI provider or the review queue; no parser yet.
        await supabaseAdmin.from("processed_mail_messages").upsert(
          {
            user_id: userId,
            provider: "gmail",
            provider_message_id: id,
            application_id: null,
            status: "processed",
            attempts: 0,
            skip_reason: null,
            classification: "informational",
            matched: false,
            sender,
            subject,
            received_at: receivedAt,
            source_kind: "other",
            confidence: 0,
            company_name: "",
            action_summary: "Gulf job-board alert skipped: it can't be read yet",
            match_reason: null,
            provider_history_id: message.historyId ?? null,
            processed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider,provider_message_id" },
        );
        newestHistory = message.historyId ?? newestHistory;
        processed += 1;
        return;
      }
      // Job-alert mail is not recruiter mail: it is never classified for an application match.
      const classification: EmailClassification =
        kind === "recruiter"
          ? await classifyRecruitmentEmail({ userId, sender, subject, body })
          : {
              status: "informational",
              company_name: "",
              confidence: 0,
              scheduling_url: null,
              action_summary: "",
            };
      let alertJobsAdded = 0;
      if (kind !== "recruiter") {
        const source = kind.replace("_alert", "");
        const { canonicalizeJobUrl, extractPublicJob, knownJobUrls, saveJobForUser } =
          await import("@/lib/discovery.server");
        if (kind === "linkedin_alert" || kind === "indeed_alert") {
          // Board roles come only from the email's own text; the board is never opened.
          const { extractAlertLeads } = await import("@/lib/alertLeads.server");
          const leads = await extractAlertLeads({
            userId,
            sender,
            subject,
            body,
            provider: kind === "linkedin_alert" ? "linkedin" : "indeed",
          }).catch((error: unknown) => {
            console.error("Alert email could not be read", error);
            return [];
          });
          const known = await knownJobUrls(
            supabaseAdmin,
            userId,
            leads.map((lead) => lead.canonical_url),
          ).catch(() => new Set<string>());
          for (const lead of leads.filter((l) => !known.has(l.canonical_url))) {
            const saved = await saveJobForUser(supabaseAdmin, userId, lead, source);
            if (saved.status === "added") alertJobsAdded += 1;
            else if (saved.status === "failed")
              console.error("Alert lead could not be saved", saved.error);
          }
        } else {
          const links = [
            ...new Set(
              jobLinks(body).flatMap((url) => {
                try {
                  return [canonicalizeJobUrl(url)];
                } catch {
                  return [];
                }
              }),
            ),
          ];
          const known = await knownJobUrls(supabaseAdmin, userId, links).catch(
            () => new Set<string>(),
          );
          for (const url of links.filter((u) => !known.has(u))) {
            try {
              const saved = await saveJobForUser(
                supabaseAdmin,
                userId,
                await extractPublicJob(userId, url),
                source,
              );
              if (saved.status === "added") alertJobsAdded += 1;
              else if (saved.status === "failed")
                console.error("Alert role could not be saved", saved.error);
            } catch {
              /* Private, expired, or blocked alert links are not imported. */
            }
          }
        }
        await supabaseAdmin.from("source_connections").upsert(
          {
            user_id: userId,
            source,
            enabled: true,
            status: "ready",
            last_synced_at: new Date().toISOString(),
            last_error: null,
          },
          { onConflict: "user_id,source" },
        );
        if (alertJobsAdded > 0)
          await supabaseAdmin.from("application_events").insert({
            user_id: userId,
            event_type: "roles_discovered",
            title:
              kind === "workday_alert"
                ? `${alertJobsAdded} verified role${alertJobsAdded === 1 ? "" : "s"} imported from ${source}`
                : `${alertJobsAdded} lead${alertJobsAdded === 1 ? "" : "s"} from your ${source} alert`,
            source: "gmail",
          });
      }
      const match =
        kind === "recruiter"
          ? matchApplication(apps, {
              companyName: classification.company_name,
              subject,
              sender,
              body,
            })
          : null;
      // Free-mail senders and fee or payment requests never move an application, even when the
      // message names the employer and the role: they go to the review queue, flagged.
      const risk =
        kind === "recruiter"
          ? assessMailRisk({
              sender,
              subject,
              body,
              readsAsRecruitment: classification.status !== "informational",
            })
          : [];
      const confident =
        risk.length === 0 &&
        Boolean(match?.app) &&
        classification.confidence >= MIN_CLASSIFIER_CONFIDENCE;
      const app = confident ? (match?.app ?? null) : null;
      if (app) {
        const next = nextStageFromEmail(app.status, stageForEmail(classification.status));
        const now = new Date().toISOString();
        const appliedAt =
          next && isSubmittedStage(next) && !app.applied_at ? (receivedAt ?? now) : null;
        await supabaseAdmin
          .from("applications")
          .update({
            ...(next ? { status: next } : {}),
            ...(appliedAt ? { applied_at: appliedAt } : {}),
            last_email_status: classification.status,
            next_action: classification.action_summary,
            updated_at: now,
          })
          .eq("id", app.id)
          .eq("user_id", userId);
        if (next) {
          app.status = next;
          if (appliedAt) app.applied_at = appliedAt;
        }
        const stageNote = next ? `moved to ${next}` : `stage kept at ${app.status}`;
        await supabaseAdmin.from("application_events").insert({
          user_id: userId,
          application_id: app.id,
          job_id: app.job_id,
          event_type: "email_classified",
          title: "Recruitment email updated application",
          detail: `${classification.company_name}: ${classification.action_summary} · ${stageNote} · matched by ${match?.reason ?? "employer and role"}`,
          source: "gmail",
        });
        matched += 1;
      } else if (
        kind === "recruiter" &&
        (risk.length > 0 || classification.status !== "informational")
      ) {
        // Informational mail needs no decision, so it stays out of the review queue unless it looks risky.
        const reason =
          risk.length > 0
            ? `Possible scam: ${risk.join("; ")}. Check the sender before replying; Nexus did not update any application.`
            : match?.app
              ? `Classifier confidence ${Math.round(classification.confidence * 100)}% is below the automatic-update bar`
              : (match?.reason ?? "No confident application match");
        await supabaseAdmin.from("unmatched_mail_messages").upsert(
          {
            user_id: userId,
            provider: "gmail",
            provider_message_id: id,
            sender,
            subject,
            received_at: receivedAt,
            classification: classification.status,
            company_name: classification.company_name,
            action_summary: classification.action_summary,
            match_reason: reason,
            possible_scam: risk.length > 0,
          },
          { onConflict: "user_id,provider,provider_message_id" },
        );
      }
      await supabaseAdmin.from("processed_mail_messages").upsert(
        {
          user_id: userId,
          provider: "gmail",
          provider_message_id: id,
          application_id: app?.id ?? null,
          status: "processed",
          attempts: 0,
          skip_reason: null,
          classification: classification.status,
          matched: Boolean(app),
          sender,
          subject,
          received_at: receivedAt,
          source_kind: kind,
          confidence: classification.confidence,
          company_name: classification.company_name,
          action_summary:
            kind === "recruiter"
              ? classification.action_summary
              : `${alertJobsAdded} ${kind === "workday_alert" ? "verified posting" : "lead"}${alertJobsAdded === 1 ? "" : "s"} imported`,
          match_reason: app ? (match?.reason ?? null) : null,
          provider_history_id: message.historyId ?? null,
          processed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider,provider_message_id" },
      );
      newestHistory = message.historyId ?? newestHistory;
      processed += 1;
    };
    for (const id of fresh) {
      try {
        await handleMessage(id);
      } catch (error) {
        // Reconnect and AI-key problems affect every message, so they stop the sync as before.
        if (error instanceof GmailReconnectError) throw error;
        // A used-up daily cap is not the message's fault: stop here and pick it up after the reset.
        if (error instanceof UsageLimitError) throw error;
        if (error instanceof AiError && [402, 403].includes(error.status)) throw error;
        // One bad message never blocks the rest: retry it next sync, then skip it for good.
        const attempts = (failedBefore.get(id) ?? 0) + 1;
        const reason = (error instanceof Error ? error.message : "Unknown failure").slice(0, 300);
        console.error(`Mail message could not be processed (attempt ${attempts})`, reason);
        const giveUp = attempts >= MAX_MESSAGE_ATTEMPTS;
        await supabaseAdmin.from("processed_mail_messages").upsert(
          {
            user_id: userId,
            provider: "gmail",
            provider_message_id: id,
            status: giveUp ? "skipped" : "failed",
            attempts,
            skip_reason: giveUp ? `failed ${attempts} times: ${reason}` : reason,
            source_kind: "other",
            classification: null,
            matched: false,
            sender: "",
            subject: "",
            processed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider,provider_message_id" },
        );
        if (giveUp) skipped += 1;
      }
    }
    const now = new Date().toISOString();
    await supabaseAdmin.from("gmail_sync_state").upsert(
      {
        user_id: userId,
        history_id: newestHistory,
        status: "ready",
        last_success_at: now,
        last_error: null,
        paused_at: null,
        lease_expires_at: null,
      },
      { onConflict: "user_id" },
    );
    await supabaseAdmin.from("source_connections").upsert(
      {
        user_id: userId,
        source: "gmail",
        enabled: true,
        status: "ready",
        last_synced_at: now,
        last_error: null,
      },
      { onConflict: "user_id,source" },
    );
    return { ok: true as const, checked: ids.length, processed, matched, skipped };
  } catch (error) {
    if (error instanceof GmailReconnectError) return await needsReconnect();
    const paused = error instanceof AiError && [402, 403].includes(error.status);
    const message = paused
      ? PAUSED_MESSAGE
      : error instanceof Error
        ? error.message
        : "Gmail sync failed.";
    await supabaseAdmin.from("gmail_sync_state").upsert(
      {
        user_id: userId,
        status: paused ? "paused" : "needs_attention",
        last_error: message,
        paused_at: paused ? new Date().toISOString() : null,
        lease_expires_at: null,
      },
      { onConflict: "user_id" },
    );
    if (paused)
      await supabaseAdmin.from("source_connections").upsert(
        {
          user_id: userId,
          source: "gmail",
          enabled: true,
          status: "needs_attention",
          last_error: message,
        },
        { onConflict: "user_id,source" },
      );
    throw error;
  }
}
