// Web Crypto AES-GCM: runs on Node 20+, Bun and Cloudflare Workers.
// Stored format (unchanged): base64(iv[12] | tag[16] | ciphertext).
const b64decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64encode = (b: Uint8Array) => { let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s); };

const KEY_SIZES = new Set([16, 24, 32]);

/**
 * Accepts APP_USER_CONNECTION_KEY_SECRET as base64 (`openssl rand -base64 32`) or hex
 * (`openssl rand -hex 32`). Base64 is tried first so existing deployments keep their key.
 */
export function parseKeySecret(raw: string): Uint8Array<ArrayBuffer> {
  const value = raw.trim();
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    try {
      const bytes = b64decode(value);
      if (KEY_SIZES.has(bytes.length)) return bytes;
    } catch { /* not base64 */ }
  }
  if (/^(?:[0-9a-fA-F]{2})+$/.test(value)) {
    const bytes = Uint8Array.from(value.match(/../g) ?? [], (h) => parseInt(h, 16));
    if (KEY_SIZES.has(bytes.length)) return bytes;
  }
  throw new Error("APP_USER_CONNECTION_KEY_SECRET must be 32 random bytes, as base64 (openssl rand -base64 32) or hex (openssl rand -hex 32).");
}

async function key(): Promise<CryptoKey> {
  const raw = process.env['APP_USER_CONNECTION_KEY_SECRET'];
  if (!raw) throw new Error("Secure Gmail storage is not configured.");
  return crypto.subtle.importKey("raw", parseKeySecret(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptConnectionKey(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const out = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(plaintext)));
  const ct = out.subarray(0, out.length - 16), tag = out.subarray(out.length - 16);
  const joined = new Uint8Array(12 + 16 + ct.length);
  joined.set(iv, 0); joined.set(tag, 12); joined.set(ct, 28);
  return b64encode(joined);
}

export async function decryptConnectionKey(stored: string): Promise<string> {
  const bytes = b64decode(stored);
  const iv = bytes.subarray(0, 12), tag = bytes.subarray(12, 28), ct = bytes.subarray(28);
  const input = new Uint8Array(ct.length + 16);
  input.set(ct, 0); input.set(tag, ct.length);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await key(), input);
  return new TextDecoder().decode(plain);
}
