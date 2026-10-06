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

import { assessMailRisk, isFreeMailSender, scamSignals } from "@/lib/mailFilter";

describe("free-mail senders", () => {
  it.each([
    "Recruiter <jane.recruiter@gmail.com>",
    "hr@yahoo.co.uk",
    "talent@hotmail.com",
    "x@outlook.com",
    "x@live.com",
    "x@protonmail.com",
    "x@gmx.de",
  ])("treats %s as free mail", (sender) => expect(isFreeMailSender(sender)).toBe(true));

  it.each([
    "jobs@acme.com",
    "no-reply@acme.myworkday.com",
    "x@outlook.office365.com",
    "x@gmail.com.evil.example",
    "x@notgmail.com",
    "",
  ])("does not treat %j as free mail", (sender) => expect(isFreeMailSender(sender)).toBe(false));
});

describe("scam signals", () => {
  it.each([
    "To secure your place please pay a visa processing fee of $250 via Western Union.",
    "A refundable security deposit is required before onboarding.",
    "Send the registration fee by bitcoin to this wallet.",
    "Please transfer the training fee today.",
    "You must pay for your visa before we can proceed.",
    "Buy gift cards and send the codes to the hiring manager.",
  ])("flags: %s", (body) =>
    expect(scamSignals({ subject: "Job offer", body }).length).toBeGreaterThan(0),
  );

  it.each([
    "We would like to invite you to interview for the Platform Engineer role.",
    "There is no application fee, and we never ask candidates for money.",
    "We will sponsor your visa and cover relocation costs.",
    "Your offer letter is attached; please sign and return it.",
  ])("does not flag: %s", (body) =>
    expect(scamSignals({ subject: "Next steps", body })).toEqual([]),
  );
});

describe("assessMailRisk", () => {
  const base = { subject: "Interview", body: "Please pick a time." };
  it("flags a free-mail sender only when the message reads as recruitment", () => {
    expect(
      assessMailRisk({ ...base, sender: "Jane <jane@gmail.com>", readsAsRecruitment: true }),
    ).toEqual(["sent from a free-mail address (gmail.com)"]);
    expect(
      assessMailRisk({ ...base, sender: "Friend <f@gmail.com>", readsAsRecruitment: false }),
    ).toEqual([]);
  });
  it("always flags a payment request, whoever sends it", () => {
    expect(
      assessMailRisk({
        sender: "hr@acme.com",
        subject: "Offer",
        body: "Pay the visa processing fee today.",
        readsAsRecruitment: false,
      }),
    ).toContain("asks for a fee");
  });
  it("is empty for ordinary employer mail", () => {
    expect(assessMailRisk({ ...base, sender: "hr@acme.com", readsAsRecruitment: true })).toEqual(
      [],
    );
  });
});
