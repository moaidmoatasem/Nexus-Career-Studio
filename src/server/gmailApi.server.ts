// Direct Google OAuth 2.0 and Gmail REST access, with no third-party gateway.
// Each user's refresh token is stored encrypted (AES-GCM) in app_user_connections and is
// only ever used server-side. Access tokens are short-lived and cached in memory.
// Uses only fetch and Web Crypto, so it runs on Node, Bun and edge runtimes alike.
import { deleteConnectionKeyForUser, getConnectionKeyForUser, saveConnectionKeyForUser } from "./appUserConnections.server";
import { parseKeySecret } from "./connectionKeyCrypto.server";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GMAIL_API = "https://gmail.googleapis.com";
export const CONNECTOR_ID = "google_mail";
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const SCOPES = ["openid", "email", GMAIL_READONLY_SCOPE];
const STATE_TTL_MS = 10 * 60_000;

/** The stored connection is missing, revoked or from the old gateway: the user must reconnect. */
export class GmailReconnectError extends Error {
  constructor(message = "Reconnect Gmail to continue.") {
    super(message);
  }
}

type Fetch = typeof fetch;
type StoredConnection = { v: 1; refresh_token: string; email: string | null; scope: string };

export function googleOAuthConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env['GOOGLE_CLIENT_ID']?.trim();
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function requireConfig() {
  const cfg = googleOAuthConfig();
  if (!cfg) throw new Error("Gmail isn't set up on this server: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  return cfg;
}

/** The OAuth redirect URI. APP_URL wins so it matches Google Cloud exactly behind a proxy. */
export function gmailRedirectUri(requestOrigin: string): string {
  const base = process.env['APP_URL']?.trim().replace(/\/+$/, "") || requestOrigin;
  return `${base}/oauth/gmail/return`;
}

// ---------- signed OAuth state (binds the callback to the user who started it) ----------

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function stateKey(): Promise<CryptoKey> {
  const raw = process.env['APP_USER_CONNECTION_KEY_SECRET'];
  if (!raw) throw new Error("Secure Gmail storage is not configured: set APP_USER_CONNECTION_KEY_SECRET.");
  // A separate HMAC key is derived from the storage secret, so one secret covers both uses safely.
  const base = await crypto.subtle.importKey("raw", parseKeySecret(raw), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode("nexus gmail oauth state v1") },
    base,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"],
  );
}

export async function createOAuthState(userId: string, now = Date.now()): Promise<string> {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const payload = b64url(enc.encode(JSON.stringify({ u: userId, e: now + STATE_TTL_MS, n: nonce })));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await stateKey(), enc.encode(payload)));
  return `${payload}.${b64url(signature)}`;
}

export async function verifyOAuthState(state: string, userId: string, now = Date.now()): Promise<boolean> {
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra !== undefined) return false;
  try {
    if (!(await crypto.subtle.verify("HMAC", await stateKey(), fromB64url(signature), enc.encode(payload)))) return false;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { u?: unknown; e?: unknown };
    return data.u === userId && typeof data.e === "number" && data.e > now;
  } catch {
    return false;
  }
}

export function buildAuthorizationUrl(state: string, redirectUri: string): string {
  const { clientId } = requireConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // returns a refresh token for background inbox checks
    prompt: "consent", // always re-issue the refresh token, even on reconnect
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

// ---------- tokens ----------

type TokenResponse = { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string; id_token?: string; error?: string; error_description?: string };

async function tokenRequest(form: Record<string, string>, fetchImpl: Fetch): Promise<{ ok: boolean; status: number; body: TokenResponse }> {
  const res = await fetchImpl(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString() });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  return { ok: res.ok, status: res.status, body };
}

function emailFromIdToken(idToken: string | undefined): string | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { email?: unknown };
    return typeof claims.email === "string" ? claims.email : null;
  } catch {
    return null;
  }
}

/** Exchanges the authorization code and stores the encrypted refresh token for this user. */
export async function connectGmailWithCode(userId: string, code: string, redirectUri: string, fetchImpl: Fetch = fetch): Promise<{ email: string | null }> {
  const { clientId, clientSecret } = requireConfig();
  const { ok, body } = await tokenRequest({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }, fetchImpl);
  if (!ok || !body.access_token) throw new Error(`Google did not accept the sign-in (${body.error_description ?? body.error ?? "unknown error"}).`);
  const scopes = (body.scope ?? "").split(" ");
  if (!scopes.includes(GMAIL_READONLY_SCOPE)) throw new Error("Gmail read access wasn't granted. Connect again and tick the Gmail permission.");
  if (!body.refresh_token) throw new Error("Google didn't return a long-lived token. Remove Nexus at myaccount.google.com/connections, then connect again.");
  const stored: StoredConnection = { v: 1, refresh_token: body.refresh_token, email: emailFromIdToken(body.id_token), scope: body.scope ?? "" };
  await saveConnectionKeyForUser(userId, CONNECTOR_ID, JSON.stringify(stored));
  cacheAccessToken(userId, body.access_token, body.expires_in);
  return { email: stored.email };
}

async function loadConnection(userId: string): Promise<StoredConnection> {
  let raw: string | null;
  try {
    raw = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  } catch {
    throw new GmailReconnectError("Reconnect Gmail to continue — the stored connection could not be read.");
  }
  if (!raw) throw new GmailReconnectError("Connect Gmail before checking your inbox.");
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConnection>;
    if (parsed.v === 1 && typeof parsed.refresh_token === "string") return parsed as StoredConnection;
  } catch { /* connections made through the old Lovable gateway are not JSON */ }
  throw new GmailReconnectError("Reconnect Gmail to continue — this connection was made with an older setup.");
}

export async function hasGmailConnection(userId: string): Promise<boolean> {
  return Boolean(await getConnectionKeyForUser(userId, CONNECTOR_ID).catch(() => "unreadable"));
}

const accessTokens = new Map<string, { token: string; expiresAt: number }>();

function cacheAccessToken(userId: string, token: string, expiresIn: number | undefined) {
  accessTokens.set(userId, { token, expiresAt: Date.now() + Math.max(60, (expiresIn ?? 3600) - 60) * 1000 });
}

async function accessToken(userId: string, fetchImpl: Fetch, forceRefresh = false): Promise<string> {
  const cached = accessTokens.get(userId);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.token;
  const { clientId, clientSecret } = requireConfig();
  const stored = await loadConnection(userId);
  const { ok, status, body } = await tokenRequest({ client_id: clientId, client_secret: clientSecret, refresh_token: stored.refresh_token, grant_type: "refresh_token" }, fetchImpl);
  if (!ok || !body.access_token) {
    accessTokens.delete(userId);
    if (body.error === "invalid_grant" || status === 401) throw new GmailReconnectError();
    throw new Error(`Google token refresh failed (${status}${body.error ? `: ${body.error}` : ""}).`);
  }
  cacheAccessToken(userId, body.access_token, body.expires_in);
  return body.access_token;
}

/** Calls the Gmail REST API as the user. Throws GmailReconnectError when access is gone. */
export async function gmailFetch(userId: string, path: string, init: RequestInit = {}, fetchImpl: Fetch = fetch): Promise<Response> {
  const call = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetchImpl(`${GMAIL_API}${path}`, { ...init, headers });
  };
  let res = await call(await accessToken(userId, fetchImpl));
  if (res.status === 401) {
    res = await call(await accessToken(userId, fetchImpl, true));
    if (res.status === 401) throw new GmailReconnectError();
  }
  return res;
}

/** Revokes Google's grant (best effort) and deletes the stored token. Returns whether Google confirmed the revoke. */
export async function disconnectGmailForUser(userId: string, fetchImpl: Fetch = fetch): Promise<{ revoked: boolean }> {
  accessTokens.delete(userId);
  const stored = await loadConnection(userId).catch(() => null);
  let revoked = !stored; // nothing usable was stored, so there is no grant left to revoke
  if (stored) {
    const res = await fetchImpl(REVOKE_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: stored.refresh_token }).toString() }).catch(() => null);
    revoked = Boolean(res?.ok);
  }
  await deleteConnectionKeyForUser(userId, CONNECTOR_ID);
  return { revoked };
}
