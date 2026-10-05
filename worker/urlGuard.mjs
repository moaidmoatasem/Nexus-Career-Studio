// Network guard for the portal helper. The helper opens links that users supply, from
// your server, so it must never reach loopback, private, link-local (cloud metadata) or
// other internal addresses, and must not follow a page into one.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_V4 = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

const v4ToInt = (ip) => ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;

/** True for any address the helper must not contact. Unparseable input counts as blocked. */
export function isBlockedAddress(ip) {
  const version = isIP(ip);
  if (version === 4) {
    const n = v4ToInt(ip);
    return BLOCKED_V4.some(([base, bits]) => n >>> (32 - bits) === v4ToInt(base) >>> (32 - bits));
  }
  if (version === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (dotted) return isBlockedAddress(dotted[1]);
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(x);
    if (hex) {
      const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16);
      return isBlockedAddress([hi >> 8, hi & 255, lo >> 8, lo & 255].join("."));
    }
    // Unique-local (fc00::/7), link-local (fe80::/10), multicast (ff00::/8), NAT64 (64:ff9b::/96).
    return /^(?:f[cd]|fe[89ab]|ff)/.test(x) || x.startsWith("64:ff9b:");
  }
  return true;
}

/**
 * Checks a URL before the helper requests it. Top-level pages must be https; sub-resources
 * may be http. `allowedHosts` (from PORTAL_ALLOWED_HOSTS) restricts top-level pages to those
 * domains and their subdomains. `resolve` is injectable for tests.
 */
export async function checkUrl(raw, { allowHttp = false, allowedHosts = [], resolve = defaultResolve } = {}) {
  let url;
  try { url = new URL(raw); } catch { return { ok: false, reason: "Not a valid URL" }; }
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) return { ok: false, reason: `Blocked ${url.protocol} link` };
  if (url.username || url.password) return { ok: false, reason: "Links with embedded credentials are not allowed" };
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!isIP(host) && (!host.includes(".") || /(?:^|\.)(?:localhost|local|internal|home|lan|corp)$/.test(host))) {
    return { ok: false, reason: `Blocked internal host ${host}` };
  }
  if (allowedHosts.length && !allowedHosts.some((d) => host === d || host.endsWith(`.${d}`))) {
    return { ok: false, reason: `${host} is not in PORTAL_ALLOWED_HOSTS` };
  }
  const addresses = isIP(host) ? [host] : await resolve(host).catch(() => []);
  if (!addresses.length) return { ok: false, reason: `Could not resolve ${host}` };
  const blocked = addresses.find(isBlockedAddress);
  if (blocked) return { ok: false, reason: `Blocked private or internal address ${blocked}` };
  return { ok: true, host };
}

async function defaultResolve(host) {
  return (await lookup(host, { all: true, verbatim: true })).map((entry) => entry.address);
}
