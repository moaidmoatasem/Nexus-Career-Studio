import { ScoreBreakdown } from '../types/career';

export interface ScoringWeights {
  skillMatchWeight: number;      // 0.45
  seniorityMatchWeight: number;  // 0.25
  domainMatchWeight: number;     // 0.20
  visaEligibilityBonus: number;  // 0.10
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  skillMatchWeight: 0.45,
  seniorityMatchWeight: 0.25,
  domainMatchWeight: 0.20,
  visaEligibilityBonus: 0.10,
};

export function calculateFitScore(
  candidateSkills: string[],
  candidateYearsOfExp: number,
  candidateDomains: string[],
  requiresVisa: boolean,
  targetJob: {
    requiredSkills: string[];
    preferredSkills: string[];
    minYearsExp: number;
    domain: string;
    sponsorVerified?: boolean;
  },
  weights: ScoringWeights = DEFAULT_WEIGHTS
): ScoreBreakdown {
  const normCandidateSkills = new Set(
    candidateSkills.map(s => s.toLowerCase().trim())
  );
  const required = targetJob.requiredSkills.map(s => s.toLowerCase().trim());
  const preferred = targetJob.preferredSkills.map(s => s.toLowerCase().trim());

  // 1. Skill Match: required (80% of skills score) + preferred (20% of skills score)
  const matchedRequired: string[] = [];
  const missingRequired: string[] = [];

  for (const req of required) {
    if (normCandidateSkills.has(req) || Array.from(normCandidateSkills).some(cs => cs.includes(req) || req.includes(cs))) {
      matchedRequired.push(req);
    } else {
      missingRequired.push(req);
    }
  }

  const matchedPreferred: string[] = [];
  for (const pref of preferred) {
    if (normCandidateSkills.has(pref) || Array.from(normCandidateSkills).some(cs => cs.includes(pref) || pref.includes(cs))) {
      matchedPreferred.push(pref);
    }
  }

  const reqRatio = required.length > 0 ? (matchedRequired.length / required.length) : 1;
  const prefRatio = preferred.length > 0 ? (matchedPreferred.length / preferred.length) : 1;
  const rawSkillScore = Math.min(100, Math.round(reqRatio * 80 + prefRatio * 20));

  // 2. Seniority Match Calculation
  let seniorityScore = 100;
  if (candidateYearsOfExp < targetJob.minYearsExp) {
    const deficit = targetJob.minYearsExp - candidateYearsOfExp;
    seniorityScore = Math.max(0, 100 - deficit * 22);
  }

  // 3. Domain Match Calculation
  const normDomains = candidateDomains.map(d => d.toLowerCase().trim());
  const jobDomain = targetJob.domain.toLowerCase().trim();
  const domainScore = normDomains.some(d => d.includes(jobDomain) || jobDomain.includes(d)) ? 100 : 45;

  // 4. Visa Sponsorship Gate
  let visaSatisfied = true;
  let visaMultiplier = 1.0;
  if (requiresVisa) {
    visaSatisfied = Boolean(targetJob.sponsorVerified);
    visaMultiplier = visaSatisfied ? 1.0 : 0.0;
  }

  const weightedTotal =
    rawSkillScore * weights.skillMatchWeight +
    seniorityScore * weights.seniorityMatchWeight +
    domainScore * weights.domainMatchWeight +
    (visaSatisfied ? 100 : 0) * weights.visaEligibilityBonus;

  const totalScore = Math.round(Math.min(100, Math.max(0, weightedTotal * visaMultiplier)));

  return {
    totalScore,
    skillScore: rawSkillScore,
    seniorityScore,
    domainScore,
    visaSatisfied,
    matchedSkills: Array.from(new Set([...matchedRequired, ...matchedPreferred])),
    missingSkills: missingRequired,
  };
}

export function computeFitScore(
  candidate: { candidateSkills: string[]; candidateYearsOfExp: number; candidateDomains: string[]; requiresVisa: boolean },
  job: { requiredSkills: string[]; preferredSkills: string[]; minYearsExp: number; domain: string; isSponsorVerified?: boolean },
  weights?: ScoringWeights
): ScoreBreakdown {
  return calculateFitScore(
    candidate.candidateSkills,
    candidate.candidateYearsOfExp,
    candidate.candidateDomains,
    candidate.requiresVisa,
    {
      requiredSkills: job.requiredSkills,
      preferredSkills: job.preferredSkills,
      minYearsExp: job.minYearsExp,
      domain: job.domain,
      sponsorVerified: job.isSponsorVerified,
    },
    weights
  );
}

