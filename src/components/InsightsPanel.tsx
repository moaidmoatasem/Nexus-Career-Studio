import { useQuery } from "@tanstack/react-query";
import { BarChart3, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApplications, useJobs, useProfile, useVault } from "@/lib/data";
import { funnel, responseStats, skillGaps, type AppLite } from "@/lib/insights";

const LABEL: Record<string, string> = { saved: "Saved", applied: "Applied", response: "Response", interview: "Interview", offer: "Offer" };

export function InsightsPanel() {
  const apps = useApplications();
  const jobs = useJobs();
  const vault = useVault();
  const profile = useProfile();
  const events = useQuery({ queryKey: ["insight-events"], queryFn: async () => {
    const { data } = await supabase.from("application_events").select("application_id,event_type,created_at").order("created_at", { ascending: false }).limit(1000);
    return data ?? [];
  } });
  const list: AppLite[] = (apps.data ?? []).map((a) => ({ id: a.id, status: a.status, created_at: a.created_at, applied_at: a.applied_at, job: a.jobs ? { source: a.jobs.source, required_skills: a.jobs.required_skills } : null }));
  const f = funnel(list);
  const r = responseStats(list, events.data ?? []);
  const titles = (profile.data?.target_titles ?? []).map((t) => t.toLowerCase());
  const targetJobs = (jobs.data ?? []).filter((j) => !titles.length || titles.some((t) => j.title.toLowerCase().includes(t.split(" ")[0] ?? t)));
  const gaps = skillGaps(targetJobs.map((j) => j.required_skills), (vault.data ?? []).flatMap((v) => v.skills));
  const max = Math.max(1, f[0]?.count ?? 1);

  return <section className="mt-6 grid gap-4 lg:grid-cols-2">
    <div className="rounded-md border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display font-semibold"><BarChart3 className="size-4 text-primary" />Your results</h2>
      <ul className="mt-3 space-y-2">{f.map((s) => <li key={s.stage} className="flex items-center gap-3 text-sm"><span className="w-20 text-muted-foreground">{LABEL[s.stage]}</span><span className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(4, (s.count / max) * 100)}%` }} /><span className="tabular-nums">{s.count}</span></li>)}</ul>
      <p className="mt-4 text-sm text-muted-foreground">
        {r.applied ? <>Response rate <b className="text-foreground">{Math.round((r.responseRate ?? 0) * 100)}%</b> from {r.applied} submitted{r.avgDaysToReply !== null && <> · first reply after <b className="text-foreground">{r.avgDaysToReply.toFixed(1)} days</b> on average</>}.</> : "Submit your first application to start seeing response rates."}
      </p>
      {r.bySource.length > 0 && <ul className="mt-2 text-xs text-muted-foreground">{r.bySource.map((s) => <li key={s.source}>{s.source}: {s.responded}/{s.applied} replied</li>)}</ul>}
    </div>
    <div className="rounded-md border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display font-semibold"><Lightbulb className="size-4 text-primary" />Career gaps</h2>
      {gaps.length ? <ul className="mt-3 space-y-2 text-sm">{gaps.map((g) => <li key={g.skill}><b>{g.skill}</b> <span className="text-muted-foreground">— asked for in {g.roles} target roles. {g.suggestion}</span></li>)}</ul>
        : <p className="mt-3 text-sm text-muted-foreground">No recurring missing skills in your target roles yet.</p>}
    </div>
  </section>;
}
