import { createFileRoute } from "@tanstack/react-router";

type PushEnvelope = { message?: { data?: string; messageId?: string }; subscription?: string };

async function verifyGoogleIdentity(request: Request) {
  const token = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return false;
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
  if (!response.ok) return false;
  const claims = await response.json() as { aud?: string; email?: string; email_verified?: string };
  const audience = process.env['GMAIL_PUBSUB_AUDIENCE'] ?? new URL(request.url).origin + new URL(request.url).pathname;
  const expectedEmail = process.env['GMAIL_PUBSUB_SERVICE_ACCOUNT'];
  return claims.aud === audience && claims.email_verified === "true" && (!expectedEmail || claims.email === expectedEmail);
}

export const Route = createFileRoute("/api/public/gmail-push")({
  server: { handlers: { POST: async ({ request }) => {
    if (!(await verifyGoogleIdentity(request))) return new Response("Unauthorized", { status: 401 });
    const envelope = await request.json().catch(() => null) as PushEnvelope | null;
    if (!envelope?.message?.data) return new Response("Invalid notification", { status: 400 });
    let emailAddress = "";
    try {
      const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(envelope.message.data), (c) => c.charCodeAt(0)))) as { emailAddress?: string };
      emailAddress = payload.emailAddress ?? "";
    } catch { return new Response("Invalid notification", { status: 400 }); }
    if (!emailAddress) return new Response("Invalid notification", { status: 400 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: state } = await supabaseAdmin.from("gmail_sync_state").select("user_id").eq("mailbox_email", emailAddress).maybeSingle();
    if (!state) return new Response("ok");
    await supabaseAdmin.from("gmail_sync_state").update({ last_notification_at: new Date().toISOString() }).eq("user_id", state.user_id);
    const { syncGmailForUser } = await import("@/server/gmailSync.server");
    await syncGmailForUser(state.user_id, 25);
    return new Response("ok");
  } } },
});