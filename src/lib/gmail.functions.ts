import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CONNECTOR_ID = "google_mail";
const GMAIL_SCOPES = ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/gmail.readonly"];

async function loadKey(userId: string) {
  const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
  return getConnectionKeyForUser(userId, CONNECTOR_ID);
}

export const getGmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await loadKey(context.userId);
    if (!key) return { connected: false as const, reconnectRequired: false, email: null, lastSyncedAt: null, lastError: null };
    const { callAsAppUser, reconnectRequired } = await import("@/integrations/lovable/appUserConnector.server");
    const response = await callAsAppUser(key, "/gmail/v1/users/me/profile", GMAIL_SCOPES);
    if (await reconnectRequired(response)) return { connected: false as const, reconnectRequired: true, email: null, lastSyncedAt: null, lastError: null };
    if (!response.ok) throw new Error(`Gmail status check failed (${response.status}).`);
    const profile = await response.json() as { emailAddress?: string };
    const { data: source } = await context.supabase.from("source_connections").select("last_synced_at,last_error").eq("user_id", context.userId).eq("source", "gmail").maybeSingle();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: syncState } = await supabaseAdmin.from("gmail_sync_state").select("watch_expiration,status").eq("user_id", context.userId).maybeSingle();
    return { connected: true as const, reconnectRequired: false, email: profile.emailAddress ?? null, lastSyncedAt: source?.last_synced_at ?? null, lastError: source?.last_error ?? null, automatic: Boolean(syncState?.watch_expiration && new Date(syncState.watch_expiration) > new Date()), syncStatus: syncState?.status ?? "idle" };
  });

export const startGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientAPIKey = process.env['GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY'];
    if (!clientAPIKey) throw new Error("The Gmail client is not linked to this project.");
    const request = getRequest();
    if (!request) throw new Error("Gmail connection must start from the app.");
    const requestUrl = new URL(request.url);
    const forwardedHost = requestUrl.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const origin = forwardedHost ? `https://${forwardedHost}` : requestUrl.origin;
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector.server");
    const existingKey = await loadKey(context.userId);
    return authorizeAppUserOAuth({
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey,
      returnUrl: new URL("/oauth/gmail/return", origin).toString(),
      ...(existingKey ? { connectionAPIKey: existingKey } : {}),
      scopes: GMAIL_SCOPES,
    });
  });

export const completeGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => z.object({ code: z.string().min(10).max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector.server");
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const key = await exchangeAppUserOAuthCode(data.code);
    await saveConnectionKeyForUser(context.userId, CONNECTOR_ID, key);
    await context.supabase.from("source_connections").upsert({ user_id: context.userId, source: "gmail", enabled: true, status: "ready", last_error: null }, { onConflict: "user_id,source" });
    const { registerGmailWatch } = await import("@/server/gmailSync.server");
    const watch = await registerGmailWatch(context.userId).catch((error) => ({ enabled: false as const, reason: error instanceof Error ? error.message : "Automatic inbox updates could not start." }));
    return { ok: true, automatic: watch.enabled, ...(!watch.enabled ? { reason: watch.reason } : {}) };
  });

export const disconnectGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await loadKey(context.userId);
    if (key) {
      const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector.server");
      await disconnectAppUser(key);
      const { deleteConnectionKeyForUser } = await import("@/server/appUserConnections.server");
      await deleteConnectionKeyForUser(context.userId, CONNECTOR_ID);
    }
    await context.supabase.from("source_connections").upsert({ user_id: context.userId, source: "gmail", enabled: false, status: "not_connected", last_error: null }, { onConflict: "user_id,source" });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("gmail_sync_state").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const syncGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncGmailForUser } = await import("@/server/gmailSync.server");
    return syncGmailForUser(context.userId);
  });