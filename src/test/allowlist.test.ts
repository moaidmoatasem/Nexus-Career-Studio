// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isEmailAllowed, parseAllowlist } from "@/lib/allowlist";

describe("allowlist", () => {
  it("allows everyone when empty or unset", () => {
    expect(isEmailAllowed("a@example.com", "")).toBe(true);
    expect(isEmailAllowed("a@example.com", "  , ; ")).toBe(true);
    expect(isEmailAllowed("a@example.com", undefined)).toBe(true);
  });

  it("matches addresses ignoring case and spaces", () => {
    const raw = " Me@Example.com , you@example.org ";
    expect(isEmailAllowed("me@example.com", raw)).toBe(true);
    expect(isEmailAllowed("YOU@EXAMPLE.ORG", raw)).toBe(true);
    expect(isEmailAllowed("other@example.com", raw)).toBe(false);
  });

  it("matches @domain entries on the exact domain only", () => {
    const raw = "@corp.example";
    expect(isEmailAllowed("anyone@corp.example", raw)).toBe(true);
    expect(isEmailAllowed("anyone@Corp.Example", raw)).toBe(true);
    expect(isEmailAllowed("anyone@sub.corp.example", raw)).toBe(false);
    expect(isEmailAllowed("anyone@evilcorp.example", raw)).toBe(false);
    expect(isEmailAllowed("corp.example@evil.com", raw)).toBe(false);
  });

  it("rejects missing or malformed emails once a list is set", () => {
    expect(isEmailAllowed(undefined, "me@example.com")).toBe(false);
    expect(isEmailAllowed("", "@example.com")).toBe(false);
    expect(isEmailAllowed("@example.com", "@example.com")).toBe(false);
    expect(isEmailAllowed("not-an-email", "me@example.com")).toBe(false);
  });

  it("accepts separators of comma, semicolon, space and newline", () => {
    expect(parseAllowlist("a@x.com;b@x.com c@x.com\nd@x.com")).toHaveLength(4);
  });

  it("reads ALLOWED_EMAILS from the environment by default", () => {
    process.env["ALLOWED_EMAILS"] = "me@example.com";
    try {
      expect(isEmailAllowed("me@example.com")).toBe(true);
      expect(isEmailAllowed("you@example.com")).toBe(false);
    } finally {
      delete process.env["ALLOWED_EMAILS"];
    }
  });
});
