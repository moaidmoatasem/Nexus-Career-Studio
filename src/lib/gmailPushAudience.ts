const PUSH_PATH = "/api/public/gmail-push";

/**
 * The audience Google's push token must carry: GMAIL_PUBSUB_AUDIENCE, else APP_URL plus the
 * endpoint path, else the request's own URL. The request URL is last because behind a TLS
 * proxy it can read http:// while the subscription was created with https://.
 * Blank values (an empty line in .env) count as unset.
 */
export function expectedPushAudience(
  requestUrl: string,
  env: { GMAIL_PUBSUB_AUDIENCE?: string | undefined; APP_URL?: string | undefined },
): string {
  const explicit = env.GMAIL_PUBSUB_AUDIENCE?.trim();
  if (explicit) return explicit;
  const appUrl = env.APP_URL?.trim().replace(/\/+$/, "");
  if (appUrl) return `${appUrl}${PUSH_PATH}`;
  const url = new URL(requestUrl);
  return url.origin + url.pathname;
}
