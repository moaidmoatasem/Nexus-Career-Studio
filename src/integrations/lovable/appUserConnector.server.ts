function requireApiKey(): string {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error("Gmail connections are not available right now.");
  return key;
}

export async function authorizeAppUserOAuth(params: {
  connectorId: string;
  appUserId: string;
  clientAPIKey: string;
  returnUrl: string;
  connectionAPIKey?: string;
  scopes: string[];
}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireApiKey()}`,
    "Content-Type": "application/json",
    "X-Client-Api-Key": params.clientAPIKey,
  };
  if (params.connectionAPIKey) headers["X-Connection-Api-Key"] = params.connectionAPIKey;
  const response = await fetch("https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/authorize", {
    method: "POST",
    headers,
    body: JSON.stringify({
      connector_id: params.connectorId,
      app_user_id: params.appUserId,
      return_url: params.returnUrl,
      credentials_configuration: { scopes: params.scopes },
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Could not start Gmail connection (${response.status}): ${text}`);
  const body = JSON.parse(text) as { authorization_url?: string };
  if (!body.authorization_url) throw new Error("Gmail did not return a connection page.");
  return { authorizationUrl: body.authorization_url };
}

export async function exchangeAppUserOAuthCode(code: string) {
  const response = await fetch("https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/exchange", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireApiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Could not finish Gmail connection (${response.status}): ${text}`);
  const body = JSON.parse(text) as { api_key?: string; connector_id?: string };
  if (!body.api_key || body.connector_id !== "google_mail") throw new Error("Gmail returned an invalid connection result.");
  return body.api_key;
}

export async function callAsAppUser(connectionAPIKey: string, path: string, requiredScopes: string[], init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${requireApiKey()}`);
  headers.set("X-Connection-Api-Key", connectionAPIKey);
  headers.set("X-Lovable-Required-Scopes", requiredScopes.join(" "));
  return fetch(`https://connector-gateway.lovable.dev/google_mail${path}`, {
    ...init,
    headers,
  });
}

export async function disconnectAppUser(connectionAPIKey: string) {
  const response = await fetch("https://connector-gateway.lovable.dev/api/v1/app-users/connection", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "X-Connection-Api-Key": connectionAPIKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ connector_id: "google_mail" }),
  });
  if (!response.ok) throw new Error(`Could not disconnect Gmail (${response.status}).`);
}

export async function reconnectRequired(response: Response) {
  if (response.status !== 401) return false;
  const body = await response.clone().json().catch(() => null) as { type?: unknown } | null;
  return typeof body?.type === "string" && body.type.startsWith("credential_");
}