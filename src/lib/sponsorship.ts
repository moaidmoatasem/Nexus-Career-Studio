// Deterministic sponsorship-wording scan of a job description. No AI, no guessing.
// Refusals are checked first, so "unable to offer sponsorship" never reads as an offer.
export type SponsorshipSignal = "offers_sponsorship" | "no_sponsorship" | "right_to_work_required" | "not_mentioned";

// Text between two cues may not cross a sentence or clause boundary.
const GAP = "[^.;:!?\\n]";
const SPONSOR_WORD = "sponsor(?:ship|ing|ed|s)?";
const NEGATION =
  "unable|not able|cannot|can ?not|can't|do not|does not|don't|doesn't|will not|won't|are not|aren't|is not|isn't|not|no longer";

const RULES: { signal: Exclude<SponsorshipSignal, "not_mentioned">; re: RegExp }[] = [
  {
    signal: "no_sponsorship",
    re: new RegExp(
      [
        `\\b(?:${NEGATION})\\b${GAP}{0,40}?\\b${SPONSOR_WORD}\\b`,
        `\\bno\\s+(?:visa\\s+|work\\s+visa\\s+)?sponsorship\\b`,
        `\\bsponsorship\\b${GAP}{0,30}?\\b(?:is|are|will be|can(?:'t| ?not)? be)?\\s*(?:not|n't)\\s+(?:be\\s+)?(?:available|offered|provided|possible|considered)\\b`,
        `\\bwithout\\s+(?:the\\s+need\\s+for\\s+)?(?:visa\\s+)?sponsorship\\b`,
      ].join("|"),
      "i",
    ),
  },
  {
    signal: "offers_sponsorship",
    re: new RegExp(
      [
        `\\b(?:visa\\s+|work\\s+visa\\s+|skilled worker\\s+(?:visa\\s+)?)?sponsorship\\s+(?:is\\s+|will be\\s+|can be\\s+)?(?:available|offered|provided|considered|possible)\\b`,
        `\\b(?:we|will|can|able to|happy to|willing to)\\s+(?:offer\\s+|provide\\s+|consider\\s+)?(?:visa\\s+)?sponsor(?:ship)?\\b`,
        `\\bskilled worker (?:visa )?sponsorship\\b`,
      ].join("|"),
      "i",
    ),
  },
  {
    signal: "right_to_work_required",
    re: new RegExp(
      [
        `\\b(?:must|need to|needs to|required to|should)\\s+(?:already\\s+)?(?:have|hold|possess)\\b${GAP}{0,30}?\\bright to work\\b`,
        `\\bright to work in the (?:uk|united kingdom)\\b${GAP}{0,30}?\\brequired\\b`,
        `\\b(?:existing|current|valid|full)\\s+(?:uk\\s+)?right to work\\b`,
      ].join("|"),
      "i",
    ),
  },
];

export function scanSponsorship(text: string): { signal: SponsorshipSignal; quote: string | null } {
  for (const { signal, re } of RULES) {
    const m = re.exec(text ?? "");
    if (m) {
      const start = Math.max(0, m.index - 40);
      return { signal, quote: text.slice(start, m.index + m[0].length + 40).replace(/\s+/g, " ").trim() };
    }
  }
  return { signal: "not_mentioned", quote: null };
}

export const SIGNAL_LABEL: Record<SponsorshipSignal, string> = {
  offers_sponsorship: "Listing mentions sponsorship",
  no_sponsorship: "Listing says no sponsorship",
  right_to_work_required: "Listing requires existing right to work",
  not_mentioned: "Listing doesn't mention sponsorship",
};

export function matchReason(similarity: number, searched: string, matched: string) {
  if (similarity >= 1) return searched.trim().toLowerCase() === matched.trim().toLowerCase() ? "Exact name" : "Exact after removing Ltd/PLC etc., or a known alias";
  return `Similar name (${Math.round(similarity * 100)}% match) — confirm it's the same company`;
}
