// Pure, deterministic outcome analytics computed from the user's own records.
export interface AppLite { id: string; status: string; created_at: string; applied_at: string | null; job: { source: string; required_skills: string[] } | null; profile?: string | null }
export interface EventLite { application_id: string | null; event_type: string; created_at: string }

const RESPONSE_EVENTS = new Set(["recruiter_response", "screening", "interview", "offer", "rejected", "email_update", "email_classified", "assessment"]);
const STAGES = ["saved", "applied", "response", "interview", "offer"] as const;
const ORDER: Record<string, number> = { queued: 0, saved: 0, tailored: 0, applied: 1, screening: 2, response: 2, rejected: 2, interview: 3, offer: 4 };

export function funnel(apps: AppLite[]) {
  return STAGES.map((stage, i) => ({ stage, count: apps.filter((a) => (ORDER[a.status] ?? 0) >= i).length }));
}

export function responseStats(apps: AppLite[], events: EventLite[]) {
  const firstReply = new Map<string, number>();
  for (const e of events) {
    if (!e.application_id || !RESPONSE_EVENTS.has(e.event_type)) continue;
    const t = new Date(e.created_at).getTime();
    const prev = firstReply.get(e.application_id);
    if (prev === undefined || t < prev) firstReply.set(e.application_id, t);
  }
  const applied = apps.filter((a) => a.applied_at);
  const responded = (a: AppLite) => firstReply.has(a.id) || (ORDER[a.status] ?? 0) >= 2;
  const bySource = new Map<string, { applied: number; responded: number }>();
  for (const a of applied) {
    const k = a.job?.source || "manual";
    const s = bySource.get(k) ?? { applied: 0, responded: 0 };
    s.applied++; if (responded(a)) s.responded++;
    bySource.set(k, s);
  }
  const days = applied.flatMap((a) => { const r = firstReply.get(a.id); return r ? [(r - new Date(a.applied_at!).getTime()) / 86400_000] : []; }).filter((d) => d >= 0);
  return {
    applied: applied.length,
    responseRate: applied.length ? applied.filter(responded).length / applied.length : null,
    avgDaysToReply: days.length ? days.reduce((x, y) => x + y, 0) / days.length : null,
    bySource: [...bySource.entries()].map(([source, s]) => ({ source, ...s, rate: s.responded / s.applied })).sort((a, b) => b.applied - a.applied),
  };
}

export function skillGaps(targetJobSkills: string[][], vaultSkills: string[], top = 6) {
  const have = new Set(vaultSkills.map((s) => s.trim().toLowerCase()));
  const counts = new Map<string, { label: string; n: number }>();
  for (const skills of targetJobSkills) for (const raw of new Set(skills.map((s) => s.trim()))) {
    const k = raw.toLowerCase(); if (!k || have.has(k)) continue;
    const c = counts.get(k) ?? { label: raw, n: 0 }; c.n++; counts.set(k, c);
  }
  return [...counts.values()].filter((c) => c.n >= 2).sort((a, b) => b.n - a.n).slice(0, top)
    .map((c) => ({ skill: c.label, roles: c.n, suggestion: `Add a Career Vault entry with evidence of ${c.label} (a project, course or result), or note that you don't have it.` }));
}
