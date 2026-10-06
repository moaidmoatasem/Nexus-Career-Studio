// Optional private-instance allowlist. ALLOWED_EMAILS holds comma-separated addresses or
// "@domain" entries; empty means everyone who can sign in is allowed.

export const PRIVATE_INSTANCE_MESSAGE = "This Nexus instance is private";

export function parseAllowlist(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(/[,;\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(
  email: string | undefined | null,
  raw: string | undefined | null = process.env["ALLOWED_EMAILS"],
): boolean {
  const entries = parseAllowlist(raw);
  if (entries.length === 0) return true;
  const address = (email ?? "").trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at < 1) return false;
  const domain = address.slice(at);
  return entries.some((entry) => (entry.startsWith("@") ? entry === domain : entry === address));
}

/** Error with a status code, which the request middleware passes through instead of a 500 page. */
export class PrivateInstanceError extends Error {
  readonly statusCode = 403;
  constructor() {
    super(PRIVATE_INSTANCE_MESSAGE);
  }
}
