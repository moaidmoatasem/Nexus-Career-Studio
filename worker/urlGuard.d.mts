// Types for the worker's plain-JS URL guard, so the app's unit tests can import it.
export type UrlVerdict = { ok: true; host: string } | { ok: false; reason: string };
export interface CheckUrlOptions {
  allowHttp?: boolean;
  allowedHosts?: string[];
  resolve?: (host: string) => Promise<string[]>;
}
export function isBlockedAddress(ip: string): boolean;
export function checkUrl(raw: string, options?: CheckUrlOptions): Promise<UrlVerdict>;
