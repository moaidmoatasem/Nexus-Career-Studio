// Deterministic 0–100 fit scorer (ported from Career-copilot scoring/engine.py).
export interface ScoreBreakdown {
  totalScore: number;
  skillScore: number;
  seniorityScore: number;
  domainScore: number;
  visaSatisfied: boolean;
  matchedSkills: string[];
  missingSkills: string[];
}

export const DEFAULT_WEIGHTS = { skill: 0.45, seniority: 0.25, domain: 0.2, visa: 0.1 };

const norm = (s: string) => s.toLowerCase().trim();
const hit = (pool: string[], s: string) => pool.some((c) => c === s || c.includes(s) || s.includes(c));

export function calculateFitScore(
  candidate: { skills: string[]; years: number; domains: string[]; requiresVisa: boolean },
  job: { requiredSkills: string[]; preferredSkills: string[]; minYearsExp: number; domain: string; sponsorVerified: boolean },
  w = DEFAULT_WEIGHTS,
): ScoreBreakdown {
  const pool = candidate.skills.map(norm).filter(Boolean);
  const req = job.requiredSkills.map(norm);
  const pref = job.preferredSkills.map(norm);
  const matchedReq = req.filter((r) => hit(pool, r));
  const missingReq = req.filter((r) => !hit(pool, r));
  const matchedPref = pref.filter((p) => hit(pool, p));
  const reqRatio = req.length ? matchedReq.length / req.length : 1;
  const prefRatio = pref.length ? matchedPref.length / pref.length : 1;
  const skillScore = Math.min(100, Math.round(reqRatio * 80 + prefRatio * 20));
  const deficit = Math.max(0, job.minYearsExp - candidate.years);
  const seniorityScore = Math.max(0, 100 - deficit * 22);
  const jd = norm(job.domain);
  const domainScore = jd && candidate.domains.map(norm).some((d) => d && (d.includes(jd) || jd.includes(d))) ? 100 : 45;
  const visaSatisfied = !candidate.requiresVisa || job.sponsorVerified;
  const weighted =
    skillScore * w.skill + seniorityScore * w.seniority + domainScore * w.domain + (visaSatisfied ? 100 : 0) * w.visa;
  const totalScore = visaSatisfied ? Math.round(Math.min(100, Math.max(0, weighted))) : 0;
  return {
    totalScore,
    skillScore,
    seniorityScore,
    domainScore,
    visaSatisfied,
    matchedSkills: Array.from(new Set([...matchedReq, ...matchedPref])),
    missingSkills: missingReq,
  };
}
