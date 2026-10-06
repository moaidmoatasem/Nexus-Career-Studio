// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stand-in for the encrypted Supabase storage, so the OAuth logic can be tested on its own.
const store = new Map<string, string>();
vi.mock("@/server/appUserConnections.server", () => ({
  saveConnectionKeyForUser: async (userId: string, connector: string, value: string) =>
    void store.set(`${userId}:${connector}`, value),
  getConnectionKeyForUser: async (userId: string, connector: string) =>
    store.get(`${userId}:${connector}`) ?? null,
  deleteConnectionKeyForUser: async (userId: string, connector: string) =>
    void store.delete(`${userId}:${connector}`),
}));

const api = await import("@/server/gmailApi.server");

const idToken = (email: string) =>
  `x.${Buffer.from(JSON.stringify({ email })).toString("base64url")}.y`;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  store.clear();
  process.env["GOOGLE_CLIENT_ID"] = "client-id.apps.googleusercontent.com";
  process.env["GOOGLE_CLIENT_SECRET"] = "secret";
  process.env["APP_USER_CONNECTION_KEY_SECRET"] = "q83vEjRWeJCrze8SNFZ4kKvN7xI0VniQq83vEjRWeJA=";
  delete process.env["APP_URL"];
});

describe("OAuth state", () => {
  it("only verifies for the same user before it expires", async () => {
    const state = await api.createOAuthState("user-a", 1_000);
    expect(await api.verifyOAuthState(state, "user-a", 2_000)).toBe(true);
    expect(await api.verifyOAuthState(state, "user-b", 2_000)).toBe(false);
    expect(await api.verifyOAuthState(state, "user-a", 1_000 + 11 * 60_000)).toBe(false);
  });
  it("rejects a tampered state", async () => {
    const state = await api.createOAuthState("user-a");
    const [payload, sig] = state.split(".");
    const forged = Buffer.from(
      JSON.stringify({ u: "user-b", e: Date.now() + 60_000, n: "x" }),
    ).toString("base64url");
    expect(await api.verifyOAuthState(`${forged}.${sig}`, "user-b")).toBe(false);
    expect(await api.verifyOAuthState(`${payload}.${sig}x`, "user-a")).toBe(false);
  });
});

describe("authorization URL", () => {
  it("asks Google for offline, read-only Gmail access on the app's own redirect", () => {
    process.env["APP_URL"] = "https://nexus.example.org/";
    const url = new URL(
      api.buildAuthorizationUrl("STATE", api.gmailRedirectUri("http://localhost:3000")),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://nexus.example.org/oauth/gmail/return",
    );
    expect(url.searchParams.get("scope")).toBe(
      "openid email https://www.googleapis.com/auth/gmail.readonly",
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("STATE");
  });
});

describe("token handling", () => {
  it("stores the refresh token and uses it for Gmail calls", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url === "https://oauth2.googleapis.com/token") {
        const form = new URLSearchParams(String(init?.body));
        if (form.get("grant_type") === "authorization_code") {
          return json(200, {
            access_token: "at-1",
            expires_in: 3600,
            refresh_token: "rt-1",
            scope: "openid email https://www.googleapis.com/auth/gmail.readonly",
            id_token: idToken("me@example.com"),
          });
        }
        return json(200, { access_token: "at-2", expires_in: 3600 });
      }
      const auth = new Headers(init?.headers).get("Authorization");
      return auth === "Bearer at-1" ? json(401, {}) : json(200, { emailAddress: "me@example.com" });
    }) as unknown as typeof fetch;

    await expect(
      api.connectGmailWithCode("u1", "code-123", "https://app/oauth/gmail/return", fetchMock),
    ).resolves.toEqual({ email: "me@example.com" });
    const saved = JSON.parse(store.get("u1:google_mail")!);
    expect(saved).toMatchObject({ v: 1, refresh_token: "rt-1", email: "me@example.com" });

    // The cached token is rejected once, so the client refreshes and retries.
    const res = await api.gmailFetch("u1", "/gmail/v1/users/me/profile", {}, fetchMock);
    expect(res.status).toBe(200);
    expect(calls.filter((u) => u.startsWith("https://gmail.googleapis.com")).length).toBe(2);
  });

  it("refuses a sign-in where Gmail access was unticked", async () => {
    const fetchMock = (async () =>
      json(200, {
        access_token: "at",
        refresh_token: "rt",
        scope: "openid email",
      })) as unknown as typeof fetch;
    await expect(
      api.connectGmailWithCode("u1", "code-123", "https://app/oauth/gmail/return", fetchMock),
    ).rejects.toThrow(/Gmail read access/);
    expect(store.size).toBe(0);
  });

  it("asks for a reconnect when Google revoked the grant or the token is from the old gateway", async () => {
    store.set("u2:google_mail", "lovable-connection-key");
    await expect(
      api.gmailFetch("u2", "/gmail/v1/users/me/profile", {}, fetch),
    ).rejects.toBeInstanceOf(api.GmailReconnectError);

    store.set(
      "u3:google_mail",
      JSON.stringify({ v: 1, refresh_token: "revoked", email: null, scope: "" }),
    );
    const revoked = (async () => json(400, { error: "invalid_grant" })) as unknown as typeof fetch;
    await expect(
      api.gmailFetch("u3", "/gmail/v1/users/me/profile", {}, revoked),
    ).rejects.toBeInstanceOf(api.GmailReconnectError);
  });

  it("revokes at Google and deletes the stored token on disconnect", async () => {
    store.set(
      "u4:google_mail",
      JSON.stringify({ v: 1, refresh_token: "rt-4", email: null, scope: "" }),
    );
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 200 }),
    ) as unknown as typeof fetch;
    await expect(api.disconnectGmailForUser("u4", fetchMock)).resolves.toEqual({ revoked: true });
    expect(store.has("u4:google_mail")).toBe(false);
    expect(
      String((fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0]),
    ).toBe("https://oauth2.googleapis.com/revoke");
  });
});
