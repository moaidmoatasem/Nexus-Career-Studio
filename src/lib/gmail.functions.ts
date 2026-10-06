import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The app's public origin for this request, used to build the OAuth redirect URI. */
function requestOrigin(): string {
  const request = getRequest();
  if (!request) throw new Error("Gmail connection must start from the app.");
  const url = new URL(request.url);
  const forwardedHost =
    url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
  return forwardedHost ? `https://${forwardedHost}` : url.origin;
}

export const getGmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { gmailFetch, GmailReconnectError, hasGmailConnection } =
      await import("@/server/gmailApi.server");
    const disconnected = {
      connected: false as const,
      reconnectRequired: false,
      email: null,
      lastSyncedAt: null,
      lastError: null,
    };
    if (!(await hasGmailConnection(context.userId))) return disconnected;
    let profile: { emailAddress?: string };
    try {
      const response = await gmailFetch(context.userId, "/gmail/v1/users/me/profile");
      if (!response.ok) throw new Error(`Gmail status check failed (${response.status}).`);
      profile = (await response.json()) as { emailAddress?: string };
    } catch (error) {
      if (error instanceof GmailReconnectError) return { ...disconnected, reconnectRequired: true };
      throw error;
    }
    const { data: source } = await context.supabase
      .from("source_connections")
      .select("last_synced_at,last_error")
      .eq("user_id", context.userId)
      .eq("source", "gmail")
      .maybeSingle();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: syncState } = await supabaseAdmin
      .from("gmail_sync_state")
      .select("watch_expiration,status")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      connected: true as const,
      reconnectRequired: false,
      email: profile.emailAddress ?? null,
      lastSyncedAt: source?.last_synced_at ?? null,
      lastError: source?.last_error ?? null,
      automatic: Boolean(
        syncState?.watch_expiration && new Date(syncState.watch_expiration) > new Date(),
      ),
      syncStatus: syncState?.status ?? "idle",
    };
  });

export const startGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildAuthorizationUrl, createOAuthState, gmailRedirectUri } =
      await import("@/server/gmailApi.server");
    const state = await createOAuthState(context.userId);
    return { authorizationUrl: buildAuthorizationUrl(state, gmailRedirectUri(requestOrigin())) };
  });

export const completeGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; state: string }) =>
    z
      .object({ code: z.string().min(10).max(4000), state: z.string().min(10).max(2000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { connectGmailWithCode, gmailRedirectUri, verifyOAuthState } =
      await import("@/server/gmailApi.server");
    if (!(await verifyOAuthState(data.state, context.userId)))
      throw new Error(
        "This Gmail sign-in expired or belongs to another session. Please connect again.",
      );
    await connectGmailWithCode(context.userId, data.code, gmailRedirectUri(requestOrigin()));
    await context.supabase.from("source_connections").upsert(
      {
        user_id: context.userId,
        source: "gmail",
        enabled: true,
        status: "ready",
        last_error: null,
      },
      { onConflict: "user_id,source" },
    );
    const { registerGmailWatch } = await import("@/server/gmailSync.server");
    const watch = await registerGmailWatch(context.userId).catch((error) => ({
      enabled: false as const,
      reason: error instanceof Error ? error.message : "Automatic inbox updates could not start.",
    }));
    return {
      ok: true,
      automatic: watch.enabled,
      ...(!watch.enabled ? { reason: watch.reason } : {}),
    };
  });

export const disconnectGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { disconnectGmailForUser } = await import("@/server/gmailApi.server");
    const { revoked } = await disconnectGmailForUser(context.userId);
    await context.supabase.from("source_connections").upsert(
      {
        user_id: context.userId,
        source: "gmail",
        enabled: false,
        status: "not_connected",
        last_error: null,
      },
      { onConflict: "user_id,source" },
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("gmail_sync_state").delete().eq("user_id", context.userId);
    return { ok: true, revoked };
  });

export const syncGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncGmailForUser } = await import("@/server/gmailSync.server");
    return syncGmailForUser(context.userId);
  });
