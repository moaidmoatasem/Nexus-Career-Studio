// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isRecruitingSender, shouldFetchMessage } from "@/lib/mailFilter";

const decide = (
  sender: string,
  subject: string,
  labelIds: string[] = ["INBOX"],
  employers: string[] = [],
) => shouldFetchMessage({ sender, subject, labelIds, employers });

describe("recruiting senders", () => {
  it.each([
    "Acme Careers <no-reply@acme.myworkday.com>",
    "no-reply@us.greenhouse-mail.io",
    "Jobs <jobs@hire.lever.co>",
    "notifications@smartrecruiters.com",
    "jobs-noreply@linkedin.com",
    "alert@uk.indeed.com",
    "alerts@mail.bayt.com",
  ])("reads mail from %s", (sender) => {
    expect(isRecruitingSender(sender)).toBe(true);
    expect(decide(sender, "Hello").fetch).toBe(true);
  });

  it("does not trust a display name or a look-alike domain", () => {
    expect(isRecruitingSender("LinkedIn Jobs <x@example.org>")).toBe(false);
    expect(isRecruitingSender("x@greenhouse.io.evil.example")).toBe(false);
    expect(isRecruitingSender("x@notgreenhouse.io")).toBe(false);
  });
});

describe("shouldFetchMessage", () => {
  it("reads mail from an employer the user applied to", () => {
    expect(
      decide("Sam <sam@acme.com>", "Quick question", ["INBOX"], ["Acme Robotics Ltd"]),
    ).toEqual({
      fetch: true,
      reason: "applied_employer",
    });
  });

  it("reads mail whose subject uses recruitment wording", () => {
    for (const subject of [
      "Your application to Globex",
      "Interview invitation: Data Engineer",
      "Unfortunately, we are not moving forward",
      "Next steps for your application",
      "Thank you for applying",
      "Assessment for the Platform Engineer role",
    ])
      expect(decide("hr@globex.example", subject)).toMatchObject({ fetch: true });
  });

  it("skips ordinary personal and commercial mail without reading it", () => {
    for (const [sender, subject] of [
      ["mum@example.org", "Dinner on Sunday?"],
      ["billing@utility.example", "Your October bill"],
      ["news@shop.example", "Special offer: 30% off everything"],
      ["noreply@bank.example", "Your statement is ready"],
      ["friend@example.org", "Photos from the trip"],
    ] as const)
      expect(decide(sender, subject)).toEqual({ fetch: false, reason: "not_recruitment" });
  });

  it("skips Promotions and Social even when the subject sounds like recruitment", () => {
    expect(
      decide("deals@shop.example", "Hiring now? Shop interview outfits", ["CATEGORY_PROMOTIONS"]),
    ).toEqual({ fetch: false, reason: "promotions_or_social" });
    expect(decide("x@social.example", "New opportunity for you", ["CATEGORY_SOCIAL"])).toEqual({
      fetch: false,
      reason: "promotions_or_social",
    });
  });

  it("still reads a known job-alert sender that Gmail filed under Promotions", () => {
    expect(
      decide("jobs-noreply@linkedin.com", "New jobs for you", ["CATEGORY_PROMOTIONS"]),
    ).toEqual({
      fetch: true,
      reason: "recruiting_sender",
    });
  });

  it("does not read an employer's name appearing only in the subject", () => {
    expect(
      decide("stranger@example.org", "Acme Robotics stock tips", ["INBOX"], ["Acme Robotics"]),
    ).toEqual({ fetch: false, reason: "not_recruitment" });
  });
});
