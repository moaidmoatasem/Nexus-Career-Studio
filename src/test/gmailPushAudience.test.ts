// @vitest-environment node
import { describe, expect, it } from "vitest";
import { expectedPushAudience } from "@/lib/gmailPushAudience";

const REQUEST = "http://web:3000/api/public/gmail-push?token=x";

describe("expectedPushAudience", () => {
  it("prefers GMAIL_PUBSUB_AUDIENCE", () => {
    expect(
      expectedPushAudience(REQUEST, {
        GMAIL_PUBSUB_AUDIENCE: " https://custom.example/audience ",
        APP_URL: "https://nexus.example.com",
      }),
    ).toBe("https://custom.example/audience");
  });

  it("falls back to APP_URL plus the endpoint path, ignoring a trailing slash", () => {
    expect(expectedPushAudience(REQUEST, { APP_URL: "https://nexus.example.com/" })).toBe(
      "https://nexus.example.com/api/public/gmail-push",
    );
  });

  it("falls back to the request URL without its query string", () => {
    expect(expectedPushAudience(REQUEST, {})).toBe("http://web:3000/api/public/gmail-push");
  });

  it("treats blank values from an empty .env line as unset", () => {
    expect(expectedPushAudience(REQUEST, { GMAIL_PUBSUB_AUDIENCE: "", APP_URL: "  " })).toBe(
      "http://web:3000/api/public/gmail-push",
    );
    expect(
      expectedPushAudience(REQUEST, { GMAIL_PUBSUB_AUDIENCE: "", APP_URL: "https://n.example" }),
    ).toBe("https://n.example/api/public/gmail-push");
  });
});
