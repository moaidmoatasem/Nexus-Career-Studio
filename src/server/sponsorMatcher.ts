import { SponsorRecord } from '../types/career';

/**
 * Ported from cherenkov-nexus/src/oracle/companyAliases.ts
 * Regex normalization dictionary for legal entity matching.
 */
const LEGAL_SUFFIXES = [
  /\b(limited|ltd|plc|llc|inc|incorporated|corp|corporation|group|holdings|services|uk|technologies|tech)\b/gi,
  /[.,/#!$%^&*;:{}=\-_`~()]/g,
  /\s{2,}/g,
];

export function normalizeCompanyName(rawName: string): string {
  if (!rawName) return '';
  let cleaned = rawName.toLowerCase();
  for (const regex of LEGAL_SUFFIXES) {
    cleaned = cleaned.replace(regex, ' ');
  }
  return cleaned.trim().replace(/\s+/g, ' ');
}

export const EXACT_SHORT_ENTITIES: Record<string, string> = {
  arm: 'Arm Limited',
  meta: 'Meta Platforms Ireland Limited',
  bp: 'BP P.L.C.',
  s3: 'S3 Chemicals Limited',
  x: 'Twitter UK Ltd',
  aws: 'Amazon Web Services UK Limited',
  gds: 'Government Digital Service',
  bt: 'BT Group PLC',
  hsbc: 'HSBC Holdings plc',
  gs: 'Goldman Sachs International',
};

// Trigram similarity implementation in TypeScript to mirror pg_trgm
function createTrigrams(text: string): Set<string> {
  const padded = `  ${text.toLowerCase().trim()} `;
  const trigrams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    trigrams.add(padded.substring(i, i + 3));
  }
  return trigrams;
}

export function computeTrigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  const triA = createTrigrams(a);
  const triB = createTrigrams(b);
  let intersection = 0;
  for (const t of triA) {
    if (triB.has(t)) intersection++;
  }
  const union = triA.size + triB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Port of PostgreSQL match_sponsor_company_v3 function:
 * 1. Checks length <= 4 short name exact dictionary
 * 2. Checks exact normalized string
 * 3. Runs trigram similarity fuzzy matching with threshold
 */
export function matchSponsorCompanyV3(
  searchTerm: string,
  sponsors: SponsorRecord[],
  threshold = 0.35
): SponsorRecord[] {
  const cleanTerm = searchTerm.toLowerCase().trim();
  const normalized = normalizeCompanyName(cleanTerm);

  // Phase 1: Short entity lookup
  if (cleanTerm.length <= 4) {
    const knownExact = EXACT_SHORT_ENTITIES[cleanTerm];
    if (knownExact) {
      const match = sponsors.find(s => s.organisationName.toLowerCase() === knownExact.toLowerCase());
      if (match) {
        return [{ ...match, similarity: 1.0 }];
      }
    }
    const shortExact = sponsors.find(s => s.organisationNormalized.toLowerCase() === cleanTerm);
    if (shortExact) {
      return [{ ...shortExact, similarity: 1.0 }];
    }
  }

  // Phase 2: Exact normalized match
  const exactNormalized = sponsors.find(s => s.organisationNormalized === normalized);
  if (exactNormalized) {
    return [{ ...exactNormalized, similarity: 1.0 }];
  }

  // Phase 3: Fuzzy trigram scoring
  const scored = sponsors
    .map(s => {
      const sim = Math.max(
        computeTrigramSimilarity(normalized, s.organisationNormalized),
        computeTrigramSimilarity(cleanTerm, s.organisationName.toLowerCase())
      );
      return { ...s, similarity: sim };
    })
    .filter(s => (s.similarity ?? 0) >= threshold)
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, 5);

  return scored;
}
