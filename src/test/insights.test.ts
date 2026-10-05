import { describe, expect, it } from "vitest";
import { funnel, responseStats, skillGaps } from "@/lib/insights";
import { scanSponsorship } from "@/lib/sponsorship";

// Statuses are the values the applications table actually stores.
const apps = [
  { id: "a", status: "interviewing", created_at: "2026-01-01", applied_at: "2026-01-02T00:00:00Z", job: { source: "gmail", required_skills: [] } },
  { id: "b", status: "applied", created_at: "2026-01-01", applied_at: "2026-01-03T00:00:00Z", job: { source: "gmail", required_skills: [] } },
  { id: "c", status: "queued", created_at: "2026-01-01", applied_at: null, job: { source: "manual", required_skills: [] } },
];

describe("insights", () => {
  it("builds a cumulative funnel from stored statuses", () => {
    expect(funnel(apps).map((f) => f.count)).toEqual([3, 2, 1, 1, 0]);
  });
  it("counts offers and interviews at their stages", () => {
    const withOffer = [...apps, { id: "d", status: "offered", created_at: "2026-01-01", applied_at: "2026-01-04T00:00:00Z", job: { source: "lever", required_skills: [] } }];
    expect(funnel(withOffer).map((f) => f.count)).toEqual([4, 3, 2, 2, 1]);
  });
  it("computes response rate and days to reply", () => {
    const r = responseStats(apps, [{ application_id: "a", event_type: "email_classified", created_at: "2026-01-06T00:00:00Z" }]);
    expect(r.responseRate).toBe(0.5);
    expect(r.avgDaysToReply).toBe(4);
  });
  it("treats an interviewing application as a response even without an event", () => {
    expect(responseStats(apps, []).responseRate).toBe(0.5);
  });
  it("finds recurring missing skills only", () => {
    const g = skillGaps([["SQL", "Python"], ["sql", "Go"], ["Python"]], ["python"]);
    expect(g.map((x) => x.skill)).toEqual(["SQL"]);
  });
});

describe("sponsorship scan", () => {
  it.each([
    ["We are unable to offer visa sponsorship for this role.", "no_sponsorship"],
    ["This role does not offer visa sponsorship.", "no_sponsorship"],
    ["We are not currently sponsoring visas for this position.", "no_sponsorship"],
    ["The company doesn't sponsor work visas.", "no_sponsorship"],
    ["Sponsorship is not available for this role.", "no_sponsorship"],
    ["No visa sponsorship.", "no_sponsorship"],
    ["You must be able to work in the UK without sponsorship.", "no_sponsorship"],
    ["Visa sponsorship is available.", "offers_sponsorship"],
    ["No problem if you're relocating: visa sponsorship is available.", "offers_sponsorship"],
    ["We can sponsor Skilled Worker visas.", "offers_sponsorship"],
    ["Visa sponsorship is available for candidates who do not hold the right to work.", "offers_sponsorship"],
    ["You must have the right to work in the UK.", "right_to_work_required"],
    ["Candidates must already have the right to work in the UK.", "right_to_work_required"],
    ["A valid UK right to work is essential.", "right_to_work_required"],
    ["Great team.", "not_mentioned"],
  ])("%s → %s", (text, signal) => {
    expect(scanSponsorship(text).signal).toBe(signal);
  });
});
