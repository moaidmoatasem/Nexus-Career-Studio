// Web Crypto AES-256-GCM: runs on Node 20+, Bun and Cloudflare Workers.
// Stored format (unchanged): base64(iv[12] | tag[16] | ciphertext).
const b64decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64encode = (b: Uint8Array) => { let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s); };

async function key(): Promise<CryptoKey> {
  const raw = process.env['APP_USER_CONNECTION_KEY_SECRET'];
  if (!raw) throw new Error("Secure Gmail storage is not configured.");
  return crypto.subtle.importKey("raw", b64decode(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
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
