import { describe, expect, it } from "vitest";
import { calculateFitScore, isUkRole, isVerifiedSponsorMatch, scoreRole, skillMatches } from "@/lib/scoring";

describe("skillMatches", () => {
  it.each([
    ["API Testing", "REST API testing", true],
    ["Selenium", "Selenium WebDriver", true],
    ["node.js", "Node.JS", true],
    ["AI/ML", "AI", true],
    ["Java", "JavaScript", false],
    ["Go", "MongoDB", false],
    ["Go", "Django", false],
    ["C", "React", false],
    ["C", "C++", false],
    ["SQL", "PostgreSQL", false],
  ])("%s ~ %s → %s", (a, b, expected) => {
    expect(skillMatches(a, b)).toBe(expected);
  });
});

describe("isUkRole", () => {
  it.each([
    [{ country: "UK", location: "London" }, true],
    [{ country: "United Kingdom", location: "Remote" }, true],
    [{ country: "UK", location: "Dubai" }, false], // manual entries default country to UK
    [{ country: "United Arab Emirates", location: "" }, false],
    [{ country: "", location: "Riyadh, Saudi Arabia" }, false],
    [{ country: "Ireland", location: "Dublin" }, false],
    [{ country: "", location: "" }, true],
  ])("%j → %s", (job, expected) => {
    expect(isUkRole(job)).toBe(expected);
  });
});

describe("calculateFitScore", () => {
  const job = { requiredSkills: ["React", "Docker", "Kubernetes", "Cypress"], preferredSkills: [], minYearsExp: 0, domain: "", sponsorVerified: true };
  it("no longer counts a one-letter skill as a match for unrelated skills", () => {
    const s = calculateFitScore({ skills: ["C"], years: 10, domains: [], requiresVisa: false }, job);
    expect(s.matchedSkills).toEqual([]);
    expect(s.skillScore).toBe(20);
  });
  it("only applies the UK sponsor gate to UK roles", () => {
    const candidate = { skills: ["Selenium"], years: 10, domains: [], requiresVisa: true };
    const role = { requiredSkills: ["Selenium"], preferredSkills: [], minYearsExp: 5, domain: "", sponsorVerified: false };
    expect(calculateFitScore(candidate, { ...role, ukRole: true }).totalScore).toBe(0);
    const abroad = calculateFitScore(candidate, { ...role, ukRole: false });
    expect(abroad.visaCheck).toBe("not_applicable");
    expect(abroad.totalScore).toBeGreaterThan(0);
  });
});

describe("scoreRole", () => {
  const job = { required_skills: ["Selenium"], preferred_skills: [], min_years_exp: 0, domain: "", country: "UK", location: "London" };
  const profile = { years_experience: 8, target_domains: [], requires_visa: true };
  it("ignores unverified vault items", () => {
    const s = scoreRole({ vault: [{ skills: ["Selenium"], is_verified: false }], profile: { ...profile, requires_visa: false }, job, sponsorSimilarity: null });
    expect(s.matchedSkills).toEqual([]);
  });
  it("treats only exact or alias register matches as verified sponsors", () => {
    expect(isVerifiedSponsorMatch(1)).toBe(true);
    expect(isVerifiedSponsorMatch(0.6)).toBe(false);
    const fuzzy = scoreRole({ vault: [{ skills: ["Selenium"], is_verified: true }], profile, job, sponsorSimilarity: 0.6 });
    expect(fuzzy.visaSatisfied).toBe(false);
  });
});
