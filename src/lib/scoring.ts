// Deterministic 0–100 fit scorer (ported from Career-copilot scoring/engine.py).
// Shared by the Discover screen and server-side application packs so scores always match.
export interface ScoreBreakdown {
  totalScore: number;
  skillScore: number;
  seniorityScore: number;
  domainScore: number;
  visaSatisfied: boolean;
  /** "uk_sponsor" when the UK register decides visa fit; "not_applicable" otherwise. Absent on older packs. */
  visaCheck?: "uk_sponsor" | "not_applicable";
  matchedSkills: string[];
  missingSkills: string[];
}

export const DEFAULT_WEIGHTS = { skill: 0.45, seniority: 0.25, domain: 0.2, visa: 0.1 };

/** Lower-case, NFKC, list separators to spaces. Keeps "+", "#" and "." so C++, C# and Node.js survive. */
export function normalizeSkill(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[/,;|()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const skillTokens = (s: string) => normalizeSkill(s).split(" ").filter(Boolean);

/**
 * Whole-word phrase match in either direction: "API testing" ~ "REST API testing" and
 * "Selenium" ~ "Selenium WebDriver", but "Java" !~ "JavaScript", "Go" !~ "MongoDB" and "C" !~ "React".
 */
export function skillMatches(a: string, b: string): boolean {
  const ta = skillTokens(a);
  const tb = skillTokens(b);
  if (!ta.length || !tb.length) return false;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  for (let i = 0; i + short.length <= long.length; i++) {
    if (short.every((token, j) => long[i + j] === token)) return true;
  }
  return false;
}

const placeTokens = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
const hasPlace = (tokens: string[], term: string) => {
  const t = term.split(" ");
  for (let i = 0; i + t.length <= tokens.length; i++)
    if (t.every((w, j) => tokens[i + j] === w)) return true;
  return false;
};

const UK_COUNTRY_TERMS = [
  "uk",
  "u k",
  "gb",
  "united kingdom",
  "great britain",
  "britain",
  "england",
  "scotland",
  "wales",
  "northern ireland",
];
const UK_PLACE_TERMS = [
  ...UK_COUNTRY_TERMS,
  "london",
  "manchester",
  "birmingham",
  "edinburgh",
  "glasgow",
  "leeds",
  "bristol",
  "cambridge",
  "oxford",
  "reading",
  "belfast",
  "cardiff",
  "liverpool",
  "sheffield",
  "newcastle",
  "nottingham",
  "leicester",
  "brighton",
  "milton keynes",
  "aberdeen",
  "southampton",
  "york",
  "coventry",
  "exeter",
  "bath",
];
const NON_UK_PLACE_TERMS = [
  "uae",
  "united arab emirates",
  "dubai",
  "abu dhabi",
  "sharjah",
  "saudi",
  "saudi arabia",
  "ksa",
  "riyadh",
  "jeddah",
  "dammam",
  "khobar",
  "qatar",
  "doha",
  "kuwait",
  "bahrain",
  "manama",
  "oman",
  "muscat",
  "egypt",
  "cairo",
  "giza",
  "alexandria",
  "jordan",
  "amman",
  "lebanon",
  "beirut",
  "morocco",
  "casablanca",
  "usa",
  "us",
  "united states",
  "canada",
  "toronto",
  "ireland",
  "dublin",
  "germany",
  "berlin",
  "munich",
  "netherlands",
  "amsterdam",
  "france",
  "paris",
  "spain",
  "madrid",
  "portugal",
  "lisbon",
  "poland",
  "warsaw",
  "india",
  "bangalore",
  "bengaluru",
  "singapore",
  "australia",
  "sydney",
  "melbourne",
  "new york",
  "san francisco",
];

/**
 * Whether the UK sponsor register is relevant to this role. The location wins over the
 * stored country, because manually added roles default to country "UK".
 */
export function isUkRole(job: { country?: string | null; location?: string | null }): boolean {
  const location = placeTokens(job.location ?? "");
  if (NON_UK_PLACE_TERMS.some((term) => hasPlace(location, term))) return false;
  if (UK_PLACE_TERMS.some((term) => hasPlace(location, term))) return true;
  const country = placeTokens(job.country ?? "");
  if (!country.length) return true;
  return UK_COUNTRY_TERMS.some((term) => hasPlace(country, term));
}

export function calculateFitScore(
  candidate: { skills: string[]; years: number; domains: string[]; requiresVisa: boolean },
  job: {
    requiredSkills: string[];
    preferredSkills: string[];
    minYearsExp: number;
    domain: string;
    sponsorVerified: boolean;
    /** Defaults to true, the original UK-only behaviour. */
    ukRole?: boolean;
  },
  w = DEFAULT_WEIGHTS,
): ScoreBreakdown {
  const pool = candidate.skills.filter((s) => normalizeSkill(s));
  const unique = (list: string[]) => Array.from(new Set(list.map(normalizeSkill).filter(Boolean)));
  const req = unique(job.requiredSkills);
  const pref = unique(job.preferredSkills);
  const has = (skill: string) => pool.some((c) => skillMatches(c, skill));
  const matchedReq = req.filter(has);
  const missingReq = req.filter((r) => !has(r));
  const matchedPref = pref.filter(has);
  const reqRatio = req.length ? matchedReq.length / req.length : 1;
  const prefRatio = pref.length ? matchedPref.length / pref.length : 1;
  const skillScore = Math.min(100, Math.round(reqRatio * 80 + prefRatio * 20));
  const deficit = Math.max(0, job.minYearsExp - candidate.years);
  const seniorityScore = Math.max(0, 100 - deficit * 22);
  const jd = normalizeSkill(job.domain);
  const domainScore = jd && candidate.domains.some((d) => skillMatches(d, jd)) ? 100 : 45;
  const ukRole = job.ukRole ?? true;
  const visaCheck = candidate.requiresVisa && ukRole ? "uk_sponsor" : "not_applicable";
  const visaSatisfied = visaCheck === "not_applicable" || job.sponsorVerified;
  const weighted =
    skillScore * w.skill +
    seniorityScore * w.seniority +
    domainScore * w.domain +
    (visaSatisfied ? 100 : 0) * w.visa;
  const totalScore = visaSatisfied ? Math.round(Math.min(100, Math.max(0, weighted))) : 0;
  return {
    totalScore,
    skillScore,
    seniorityScore,
    domainScore,
    visaSatisfied,
    visaCheck,
    matchedSkills: Array.from(new Set([...matchedReq, ...matchedPref])),
    missingSkills: missingReq,
  };
}

/** A register row counts as a verified sponsor only on an exact (normalised) or alias match. */
export function isVerifiedSponsorMatch(similarity: number | null | undefined): boolean {
  return (similarity ?? 0) >= 1;
}

export interface RoleScoreInput {
  vault: Array<{ skills: string[]; is_verified: boolean }>;
  profile:
    | { years_experience: number; target_domains: string[]; requires_visa: boolean }
    | null
    | undefined;
  job: {
    required_skills: string[];
    preferred_skills: string[];
    min_years_exp: number;
    domain: string;
    country: string;
    location: string;
  };
  /** Similarity of the best UK register match for the employer, or null when there is none. */
  sponsorSimilarity: number | null | undefined;
}

/** The one scoring path used by both the browser and the server. Only verified vault items count. */
export function scoreRole({
  vault,
  profile,
  job,
  sponsorSimilarity,
}: RoleScoreInput): ScoreBreakdown {
  return calculateFitScore(
    {
      skills: vault.filter((v) => v.is_verified).flatMap((v) => v.skills),
      years: profile?.years_experience ?? 0,
      domains: profile?.target_domains ?? [],
      requiresVisa: profile?.requires_visa ?? false,
    },
    {
      requiredSkills: job.required_skills,
      preferredSkills: job.preferred_skills,
      minYearsExp: job.min_years_exp,
      domain: job.domain,
      sponsorVerified: isVerifiedSponsorMatch(sponsorSimilarity),
      ukRole: isUkRole(job),
    },
  );
}
