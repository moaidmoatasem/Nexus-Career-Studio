// Reference-bound provenance auditor. Deterministic: no AI is involved in checking.
//  1. Every bullet must cite a real, verified vault item.
//  2. Every metric the model says it used must appear inside that item's own metrics.
//  3. Every number written in the bullet text must appear in that item's evidence.
//  4. Cover letters and outreach notes may only use numbers found in the verified vault, the
//     candidate's profile or the job posting; sentences with any other number are removed.
// Limit: qualitative claims with no number in them ("led the team") cannot be checked this way.
import { skillMatches } from "./scoring";

export interface TailoredBullet {
  vault_item_id: string;
  tailored_text: string;
  verified_metrics: string[];
  aligned_skills: string[];
}
export type ProvenanceScope = "bullet" | "cover_letter" | "recruiter_outreach";
export interface ProvenanceViolation {
  /** Position within its scope: the bullet index, or the sentence index for free text. */
  bulletIndex: number;
  /** The cited vault item, or "" for cover letters and outreach notes. */
  vaultItemId: string;
  reason: "INVALID_VAULT_ID" | "UNVERIFIED_METRIC" | "UNVERIFIED_NUMBER";
  detail: string;
  /** Absent on packs generated before free-text checks existed; treat as "bullet". */
  scope?: ProvenanceScope;
}
export interface VaultLike {
  id: string;
  title: string;
  metrics: string[];
  organization?: string | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  skills?: string[];
}

const NUMBER_WORDS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  fifteen: "15",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  hundred: "100",
  thousand: "1000",
  dozen: "12",
};

const normalizeText = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** Numbers written with digits, normalised: "1,200" → "1200", "47%" → "47", "$1.2M" → "1.2", "07" → "7". */
export function numbersIn(text: string): string[] {
  const out: string[] = [];
  for (const match of text.normalize("NFKC").matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const raw = match[0].replace(/,(?=\d{3}(?!\d))/g, "").replace(/,+$/, "");
    for (const part of raw.split(",")) {
      if (!part) continue;
      const value = Number(part);
      out.push(Number.isFinite(value) ? String(value) : part);
    }
  }
  return out;
}

/** Every number available as evidence, including small numbers written as words ("two teams"). */
export function evidenceNumbers(parts: Array<string | null | undefined>): Set<string> {
  const found = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const n of numbersIn(part)) found.add(n);
    for (const word of part.toLowerCase().match(/[a-z]+/g) ?? []) {
      const digit = NUMBER_WORDS[word];
      if (digit) found.add(digit);
    }
  }
  return found;
}

/** The text a vault item can vouch for. */
export function itemEvidence(item: VaultLike): string[] {
  return [
    item.title,
    item.organization,
    item.description,
    item.start_date,
    item.end_date,
    ...item.metrics,
    ...(item.skills ?? []),
  ].filter((part): part is string => Boolean(part));
}

export function validateBulletProvenance(bullets: TailoredBullet[], vault: VaultLike[]) {
  const map = new Map(vault.map((v) => [v.id, v]));
  const vaultSkills = vault.flatMap((v) => v.skills ?? []);
  const violations: ProvenanceViolation[] = [];
  const valid: TailoredBullet[] = [];
  bullets.forEach((b, i) => {
    const rec = map.get(b.vault_item_id);
    if (!rec) {
      violations.push({
        bulletIndex: i,
        vaultItemId: b.vault_item_id,
        reason: "INVALID_VAULT_ID",
        scope: "bullet",
        detail: `Cited an unknown or unverified vault item "${b.vault_item_id}".`,
      });
      return;
    }
    const before = violations.length;
    for (const metric of b.verified_metrics ?? []) {
      const claimed = normalizeText(metric);
      if (!claimed || !rec.metrics.some((vm) => normalizeText(vm).includes(claimed))) {
        violations.push({
          bulletIndex: i,
          vaultItemId: b.vault_item_id,
          reason: "UNVERIFIED_METRIC",
          scope: "bullet",
          detail: `Metric "${metric}" is not in "${rec.title}".`,
        });
      }
    }
    const allowed = evidenceNumbers(itemEvidence(rec));
    for (const n of new Set(numbersIn(b.tailored_text))) {
      if (!allowed.has(n)) {
        violations.push({
          bulletIndex: i,
          vaultItemId: b.vault_item_id,
          reason: "UNVERIFIED_NUMBER",
          scope: "bullet",
          detail: `"${n}" in "${b.tailored_text}" is not in "${rec.title}".`,
        });
      }
    }
    if (violations.length === before) {
      valid.push({
        ...b,
        aligned_skills: (b.aligned_skills ?? []).filter((s) =>
          vaultSkills.some((v) => skillMatches(v, s)),
        ),
      });
    }
  });
  return { isValid: violations.length === 0, violations, validBullets: valid };
}

/**
 * Removes every sentence that uses a number not found in `allowed`. Paragraphs without
 * removals are kept exactly as written.
 */
export function auditFreeText(
  text: string,
  allowed: Set<string>,
  scope: Exclude<ProvenanceScope, "bullet">,
) {
  const violations: ProvenanceViolation[] = [];
  let index = 0;
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => {
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    const kept = sentences.filter((sentence) => {
      const i = index++;
      const unsupported = [...new Set(numbersIn(sentence))].filter((n) => !allowed.has(n));
      if (!unsupported.length) return true;
      violations.push({
        bulletIndex: i,
        vaultItemId: "",
        reason: "UNVERIFIED_NUMBER",
        scope,
        detail: `Removed "${sentence.trim()}" — ${unsupported.join(", ")} is not in your verified Career Vault, profile or the job posting.`,
      });
      return false;
    });
    return kept.length === sentences.length ? paragraph : kept.join(" ");
  });
  return { text: paragraphs.filter((p) => p.trim()).join("\n\n"), violations };
}
