// Deterministic sponsorship-wording scan of a job description. No AI, no guessing.
export type SponsorshipSignal = "offers_sponsorship" | "no_sponsorship" | "right_to_work_required" | "not_mentioned";

const RULES: { signal: Exclude<SponsorshipSignal, "not_mentioned">; re: RegExp }[] = [
  { signal: "no_sponsorship", re: /\b(unable|not able|cannot|can't|do not|don't|will not|won't|no)\b[^.]{0,40}\b(sponsor|sponsorship)\b|\bsponsorship\b[^.]{0,30}\b(is )?not (available|offered|provided)\b/i },
  { signal: "offers_sponsorship", re: /\b(visa )?sponsorship (is )?(available|offered|provided|considered)\b|\b(we|will|can|able to) (offer |provide )?sponsor\b|\bskilled worker (visa )?sponsorship\b/i },
  { signal: "right_to_work_required", re: /\b(must|need to|required to) (have|hold|possess)[^.]{0,30}right to work\b|\bright to work in the (uk|united kingdom)\b[^.]{0,30}\brequired\b/i },
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
