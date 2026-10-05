import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2, Clock3, Mail, Radar, Sparkles } from "lucide-react";
import { useApplications, useApplicationEvents, useJobs, useProfile, useRoleDecisions } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GmailConnection } from "@/components/GmailConnection";
import { SetupProgress } from "@/components/SetupProgress";
import { AgentPanel } from "@/components/AgentPanel";
import { ReviewQueue } from "@/components/ReviewQueue";
import { InsightsPanel } from "@/components/InsightsPanel";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({ meta: [{ title: "Mission Control — Nexus Career Studio" }, { name: "description", content: "Your next best job-search actions." }, { property: "og:title", content: "Mission Control — Nexus Career Studio" }, { property: "og:description", content: "Review discoveries, prepare applications, and follow up." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: TodayPage,
});

function TodayPage() {
  const applications = useApplications();
  const jobs = useJobs();
  const decisions = useRoleDecisions();
  const events = useApplicationEvents();
  const profile = useProfile();
  const decided = new Set((decisions.data ?? []).map((item) => item.job_id));
  const newJobs = (jobs.data ?? []).filter((job) => !decided.has(job.id)).length;
  const ready = (applications.data ?? []).filter((item) => item.status === "tailored");
  const followUps = (applications.data ?? []).filter((item) => item.next_action);
  const preferencesReady = Boolean(profile.data?.target_titles.length && profile.data?.target_locations.length);

  return <div>
    <PageHeader title="Mission Control" sub="What your agent did, and the one thing that needs you next." />
    <SetupProgress />
    <ReviewQueue />
    <AgentPanel />
    <InsightsPanel />
    <div className="grid gap-3 md:grid-cols-3">
      <ActionStat icon={Radar} value={newJobs} label="roles to review" to="/radar" action="Review inbox" />
      <ActionStat icon={Sparkles} value={ready.length} label="ready to submit" to="/applications" action="Open applications" />
      <ActionStat icon={CalendarClock} value={followUps.length} label="follow-ups due" to="/applications" action="Check next actions" />
    </div>

    {!preferencesReady && <section className="mt-6 rounded-md border border-warning/40 bg-warning/10 p-5"><div className="flex items-start gap-3"><Clock3 className="mt-0.5 size-5 text-warning" /><div><h2 className="font-display font-semibold">Complete your discovery profile</h2><p className="mt-1 text-sm text-muted-foreground">Add target titles and locations in Career Vault before automated discovery is enabled.</p><Button className="mt-4" size="sm" variant="outline" asChild><Link to="/vault">Open Career Vault <ArrowRight /></Link></Button></div></div></section>}

    <section className="mt-6 flex flex-col justify-between gap-4 rounded-md border bg-card p-5 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><Mail className="mt-0.5 size-5 text-primary" /><div><h2 className="font-display font-semibold">Recruitment inbox</h2><p className="mt-1 text-sm text-muted-foreground">Connect Gmail to import supported job alerts and track confident application updates.</p></div></div><GmailConnection compact /></section>

    <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
      <section><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Ready to move</h2><Badge variant="outline">Candidate-controlled</Badge></div><div className="space-y-3">
        {ready.map((item) => <div key={item.id} className="rounded-md border bg-card p-4"><div className="flex items-start justify-between gap-4"><div><h3 className="font-medium">{item.jobs?.title}</h3><p className="text-sm text-muted-foreground">{item.jobs?.company_name}</p></div><span className="font-mono text-primary">{item.fit_score}</span></div><div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px] text-muted-foreground"><Step done label="Tailored" /><Step done label="Audited" /><Step label="Portal" /><Step label="Confirm" /></div><Button className="mt-4" size="sm" asChild><Link to="/applications/$applicationId" params={{ applicationId: item.id }}>Review & apply <ArrowRight /></Link></Button></div>)}
        {!ready.length && <div className="rounded-md border border-dashed p-8 text-center"><BriefcaseBusiness className="mx-auto size-5 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">No application packs are waiting.</p><Button className="mt-4" size="sm" variant="outline" asChild><Link to="/radar">Find a role</Link></Button></div>}
      </div></section>
      <section><h2 className="mb-3 font-display text-lg font-semibold">Recent activity</h2><div className="border-l pl-5">
        {(events.data ?? []).slice(0, 8).map((event) => <div key={event.id} className="relative pb-5"><span className="absolute -left-[1.55rem] top-1 grid size-4 place-items-center rounded-full border bg-background"><CheckCircle2 className="size-2.5 text-primary" /></span><p className="text-sm font-medium">{event.title}</p>{event.detail && <p className="mt-1 text-xs text-muted-foreground">{event.detail}</p>}<p className="mt-1 text-[10px] text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p></div>)}
        {!events.data?.length && <p className="text-sm text-muted-foreground">Your discovery, tailoring, and application updates will appear here.</p>}
      </div></section>
    </div>
  </div>;
}

function ActionStat({ icon: Icon, value, label, to, action }: { icon: typeof Radar; value: number; label: string; to: "/radar" | "/applications"; action: string }) {
  return <div className="rounded-md border bg-card p-4"><div className="flex items-center justify-between"><Icon className="size-4 text-primary" /><span className="font-display text-2xl font-semibold">{value}</span></div><p className="mt-4 text-sm text-muted-foreground">{label}</p><Button className="mt-3 px-0" variant="link" asChild><Link to={to}>{action} <ArrowRight /></Link></Button></div>;
}

function Step({ done = false, label }: { done?: boolean; label: string }) {
  return <span className={done ? "rounded-sm bg-success/10 px-1 py-2 text-success" : "rounded-sm bg-secondary px-1 py-2"}>{label}</span>;
}