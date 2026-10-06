import { describe, expect, it } from "vitest";
import {
  auditFreeText,
  evidenceNumbers,
  numbersIn,
  validateBulletProvenance,
} from "@/lib/provenance";

const vault = [
  {
    id: "v1",
    title: "QA Lead",
    organization: "Acme",
    description: "Led two QA engineers on the payments platform.",
    start_date: "2021",
    end_date: "",
    metrics: ["Cut regression time from 3 days to 4 hours"],
    skills: ["Selenium", "API Testing"],
  },
];
const bullet = (
  tailored_text: string,
  verified_metrics: string[] = [],
  aligned_skills: string[] = [],
) => ({ vault_item_id: "v1", tailored_text, verified_metrics, aligned_skills });

describe("numbersIn", () => {
  it("normalises digits, separators and units", () => {
    expect(numbersIn("Saved $1,200,000 (47%) in Q3 2021 and 1.50x faster")).toEqual([
      "1200000",
      "47",
      "3",
      "2021",
      "1.5",
    ]);
    expect(numbersIn("2020,2021 and 30, then")).toEqual(["2020", "2021", "30"]);
  });
  it("collects small numbers written as words in evidence", () => {
    expect(evidenceNumbers(["Led two QA engineers"]).has("2")).toBe(true);
  });
});

describe("validateBulletProvenance", () => {
  it("accepts a bullet whose numbers all come from the cited item", () => {
    const r = validateBulletProvenance(
      [
        bullet("Cut regression time from 3 days to 4 hours while leading 2 engineers since 2021", [
          "Cut regression time from 3 days to 4 hours",
        ]),
      ],
      vault,
    );
    expect(r.isValid).toBe(true);
    expect(r.validBullets).toHaveLength(1);
  });
  it("rejects invented numbers in the bullet text even when verified_metrics is empty", () => {
    const r = validateBulletProvenance(
      [bullet("Reduced production defects by 47% and saved $1.2M annually")],
      vault,
    );
    expect(r.isValid).toBe(false);
    expect(r.validBullets).toHaveLength(0);
    expect(r.violations.map((v) => v.reason)).toEqual(["UNVERIFIED_NUMBER", "UNVERIFIED_NUMBER"]);
  });
  it("rejects a claimed metric that adds to the real one", () => {
    const r = validateBulletProvenance(
      [bullet("x", ["Cut regression time from 3 days to 4 hours and grew revenue 30%"])],
      vault,
    );
    expect(r.violations.some((v) => v.reason === "UNVERIFIED_METRIC")).toBe(true);
  });
  it("rejects an empty claimed metric", () => {
    expect(validateBulletProvenance([bullet("x", [""])], vault).isValid).toBe(false);
  });
  it("rejects citations of items that are not in the verified vault", () => {
    const r = validateBulletProvenance(
      [{ ...bullet("x"), vault_item_id: "unverified-item" }],
      vault,
    );
    expect(r.violations[0]?.reason).toBe("INVALID_VAULT_ID");
  });
  it("keeps only aligned skills the vault can back", () => {
    const r = validateBulletProvenance(
      [bullet("Automated API checks", [], ["API Testing", "Kubernetes"])],
      vault,
    );
    expect(r.validBullets[0]?.aligned_skills).toEqual(["API Testing"]);
  });
});

describe("auditFreeText", () => {
  const allowed = evidenceNumbers(["Cut regression time from 3 days to 4 hours", "10"]);
  it("removes only the sentences with unsupported numbers", () => {
    const letter =
      "Dear team,\n\nWith 10 years in QA, I cut regression time from 3 days to 4 hours. I also raised revenue by 30%. I would love to help.\n\nBest regards,\nMoayed";
    const r = auditFreeText(letter, allowed, "cover_letter");
    expect(r.text).toBe(
      "Dear team,\n\nWith 10 years in QA, I cut regression time from 3 days to 4 hours. I would love to help.\n\nBest regards,\nMoayed",
    );
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.scope).toBe("cover_letter");
    expect(r.violations[0]?.detail).toContain("30");
  });
  it("leaves clean text untouched", () => {
    const note = "Hi Sam,\nI'd love to chat about the QA role.";
    expect(auditFreeText(note, allowed, "recruiter_outreach")).toEqual({
      text: note,
      violations: [],
    });
  });
});
