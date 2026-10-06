import { describe, expect, it } from "vitest";
import { parseKeySecret } from "@/server/connectionKeyCrypto.server";
import { canonicalizeJobUrl, sourceProvider } from "@/lib/discovery.server";
import { checkUrl, isBlockedAddress } from "../../worker/urlGuard.mjs";

describe("Gmail key secret", () => {
  it("accepts base64 and 64-character hex keys", () => {
    expect(parseKeySecret("q83vEjRWeJCrze8SNFZ4kKvN7xI0VniQq83vEjRWeJA=")).toHaveLength(32);
    expect(parseKeySecret("ab".repeat(32))).toHaveLength(32);
  });
  it("keeps the existing base64 interpretation for keys that already worked", () => {
    // 32 hex characters are also valid base64 (24 bytes); existing deployments must decrypt as before.
    expect(parseKeySecret("0123456789abcdef0123456789abcdef")).toHaveLength(24);
  });
  it("rejects anything that is not a valid AES key", () => {
    expect(() => parseKeySecret("not a key")).toThrow(/openssl rand -base64 32/);
    expect(() => parseKeySecret("abcd")).toThrow();
  });
});

describe("job URLs", () => {
  it("labels providers by real host name only", () => {
    expect(sourceProvider("https://jobs.lever.co/acme/1")).toBe("lever");
    expect(sourceProvider("https://uk.indeed.com/viewjob?jk=1")).toBe("indeed");
    expect(sourceProvider("https://linkedin.com.evil.example/jobs/1")).toBe("career_page");
  });
  it("strips tracking parameters", () => {
    expect(
      canonicalizeJobUrl("https://boards.greenhouse.io/acme/jobs/1?gh_src=x&utm_source=y#apply"),
    ).toBe("https://boards.greenhouse.io/acme/jobs/1");
  });
});

describe("portal helper URL guard", () => {
  const resolveTo = (address: string) => async () => [address];
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.5",
    "192.168.1.10",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:169.254.169.254",
    "::ffff:a9fe:a9fe",
  ])("blocks %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });
  it("allows public addresses", () => {
    expect(isBlockedAddress("104.18.32.12")).toBe(false);
    expect(isBlockedAddress("2606:4700::6810:200c")).toBe(false);
  });
  it("refuses metadata, internal names, http pages and names that resolve inward", async () => {
    expect((await checkUrl("https://169.254.169.254/latest/meta-data/")).ok).toBe(false);
    expect((await checkUrl("https://web:3000/api", { resolve: resolveTo("172.18.0.2") })).ok).toBe(
      false,
    );
    expect(
      (await checkUrl("http://jobs.lever.co/acme", { resolve: resolveTo("104.18.32.12") })).ok,
    ).toBe(false);
    expect(
      (await checkUrl("https://rebind.example.org/", { resolve: resolveTo("10.0.0.5") })).ok,
    ).toBe(false);
    expect(
      (await checkUrl("https://user:pw@jobs.lever.co/acme", { resolve: resolveTo("104.18.32.12") }))
        .ok,
    ).toBe(false);
  });
  it("allows public https postings and honours the host allowlist", async () => {
    const ok = await checkUrl("https://jobs.lever.co/acme/1", {
      resolve: resolveTo("104.18.32.12"),
    });
    expect(ok.ok).toBe(true);
    const listed = await checkUrl("https://jobs.lever.co/acme/1", {
      allowedHosts: ["lever.co"],
      resolve: resolveTo("104.18.32.12"),
    });
    expect(listed.ok).toBe(true);
    const unlisted = await checkUrl("https://careers.example.org/1", {
      allowedHosts: ["lever.co"],
      resolve: resolveTo("104.18.32.12"),
    });
    expect(unlisted.ok).toBe(false);
  });
});
