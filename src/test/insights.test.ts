import { describe, expect, it } from "vitest";
import { funnel, responseStats, skillGaps } from "@/lib/insights";
import { scanSponsorship } from "@/lib/sponsorship";

const apps = [
  { id: "a", status: "interview", created_at: "2026-01-01", applied_at: "2026-01-02T00:00:00Z", job: { source: "gmail", required_skills: [] } },
  { id: "b", status: "applied", created_at: "2026-01-01", applied_at: "2026-01-03T00:00:00Z", job: { source: "gmail", required_skills: [] } },
  { id: "c", status: "queued", created_at: "2026-01-01", applied_at: null, job: { source: "manual", required_skills: [] } },
];

describe("insights", () => {
  it("builds a cumulative funnel", () => {
    expect(funnel(apps).map((f) => f.count)).toEqual([3, 2, 1, 1, 0]);
  });
  it("computes response rate and days to reply", () => {
    const r = responseStats(apps, [{ application_id: "a", event_type: "interview", created_at: "2026-01-06T00:00:00Z" }]);
    expect(r.responseRate).toBe(0.5);
    expect(r.avgDaysToReply).toBe(4);
  });
  it("finds recurring missing skills only", () => {
    const g = skillGaps([["SQL", "Python"], ["sql", "Go"], ["Python"]], ["python"]);
    expect(g.map((x) => x.skill)).toEqual(["SQL"]);
  });
});

describe("sponsorship scan", () => {
  it("detects refusals before offers", () => {
    expect(scanSponsorship("We are unable to offer visa sponsorship for this role.").signal).toBe("no_sponsorship");
    expect(scanSponsorship("Visa sponsorship is available.").signal).toBe("offers_sponsorship");
    expect(scanSponsorship("You must have the right to work in the UK.").signal).toBe("right_to_work_required");
    expect(scanSponsorship("Great team.").signal).toBe("not_mentioned");
  });
});
