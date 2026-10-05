import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, BadgeCheck, MapPin, Plus, Target, BriefcaseBusiness, ShieldCheck, Bookmark, X, Link2, Mail, Building2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useJobs, useVault, useProfile, useSponsorSet, scoreJob, useInvalidate, useRoleDecisions, useSourceConnections, uid } from "@/lib/data";
import { isUkRole, isVerifiedSponsorMatch } from "@/lib/scoring";
import { PageHeader, ScoreRing } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { intakeJobUrl, refreshMyDiscovery } from "@/lib/discovery.functions";
import { GmailConnection } from "@/components/GmailConnection";

export const Route = createFileRoute("/_authenticated/radar")({
  head: () => ({ meta: [{ title: "Role Radar — Nexus Career Studio" }, { name: "description", content: "Roles ranked by fit score." }, { property: "og:title", content: "Role Radar — Nexus Career Studio" }, { property: "og:description", content: "Compare job fit, skill gaps, and UK sponsorship." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: RadarPage,
});

function RadarPage() {
  const jobs = useJobs();
  const vault = useVault();
  const profile = useProfile();
  const companies = useMemo(() => Array.from(new Set((jobs.data ?? []).map((j) => j.company_name))), [jobs.data]);
  const sponsors = useSponsorSet(companies);
  const decisions = useRoleDecisions();
  const sources = useSourceConnections();
  const invalidate = useInvalidate();
  const refreshDiscovery = useServerFn(refreshMyDiscovery);
  const [refreshing, setRefreshing] = useState(false);
  const decidedIds = useMemo(() => new Set((decisions.data ?? []).map((item) => item.job_id)), [decisions.data]);

  const scored = useMemo(
    () =>
      (jobs.data ?? []).filter((job) => !decidedIds.has(job.id))
        .map((j) => {
          const sponsor = sponsors.data?.[j.company_name] ?? null;
          const ukRole = isUkRole(j);
          return { job: j, sponsor, ukRole, verifiedSponsor: isVerifiedSponsorMatch(sponsor?.similarity), score: scoreJob(j, vault.data ?? [], profile.data, sponsor?.similarity ?? null) };
        })
        .sort((a, b) => b.score.totalScore - a.score.totalScore),
    [jobs.data, vault.data, profile.data, sponsors.data, decidedIds],
  );

  async function decide(jobId: string, decision: "saved" | "dismissed") {
    const user_id = await uid();
    const { error } = await supabase.from("role_decisions").upsert({ user_id, job_id: jobId, decision }, { onConflict: "user_id,job_id" });
    if (error) { toast.error(error.message); return; }
    toast.success(decision === "saved" ? "Saved for your shortlist" : "Removed from discovery");
    invalidate("role-decisions");
  }

  async function queue(jobId: string, fit: number) {
    const user_id = await uid();
    const { data: app, error } = await supabase.from("applications").upsert({ user_id, job_id: jobId, fit_score: fit, status: "queued" }, { onConflict: "user_id,job_id", ignoreDuplicates: true }).select("id").maybeSingle();
    if (error) { toast.error(error.message); return; }
    if (app) await supabase.from("application_events").insert({ user_id, application_id: app.id, job_id: jobId, event_type: "queued", title: "Role saved to application queue", source: "discovery" });
    toast.success("Added to your daily queue");
    invalidate("applications", "application-events");
  }

  return (
    <div>
      <PageHeader title="Discover" sub="Review verified opportunities and choose where to invest your time.">
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={refreshing} onClick={async () => { setRefreshing(true); try { const result = await refreshDiscovery(); if (!result.ok) toast.error(result.error); else { const extra = [result.duplicates ? `${result.duplicates} already in your inbox` : "", result.failed ? `${result.failed} could not be read` : ""].filter(Boolean).join(", "); toast[result.added || !result.failed ? "success" : "error"](`${result.added} new verified role${result.added === 1 ? "" : "s"} from ${result.found} results${extra ? ` (${extra})` : ""}`); invalidate("jobs", "source-connections"); } } catch (error) { toast.error(error instanceof Error ? error.message : "Discovery failed"); } finally { setRefreshing(false); } }}><RefreshCw className={refreshing ? "animate-spin" : ""} />Find roles now</Button><ImportJobDialog onAdded={() => invalidate("jobs")} /><AddJobDialog onAdded={() => invalidate("jobs")} /></div>
      </PageHeader>
      <details className="mb-7 border-y py-4">
        <summary className="cursor-pointer list-none text-sm font-medium">How roles reach your inbox <span className="ml-2 text-xs font-normal text-muted-foreground">Employer pages, public links, and your email alerts</span></summary>
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {[
          { source: "career_pages", label: "Career pages", icon: Building2 },
          { source: "linkedin", label: "LinkedIn alerts", icon: Link2 },
          { source: "indeed", label: "Indeed alerts", icon: Link2 },
          { source: "mail", label: "Gmail intake", icon: Mail },
        ].map((item) => {
          const connection = sources.data?.find((source) => item.source === "mail" ? source.source === "gmail" || source.source === "outlook" : source.source === item.source);
          const ready = item.source === "career_pages" || connection?.status === "ready";
          return <div key={item.source} className="rounded-md border bg-card p-3"><div className="flex items-center justify-between"><item.icon className="size-4 text-primary" /><span className={ready ? "text-[10px] font-medium text-success" : "text-[10px] text-muted-foreground"}>{ready ? "Ready" : item.source === "mail" ? "Connect Gmail" : "Via Gmail or link"}</span></div><p className="mt-3 text-sm font-medium">{item.label}</p><p className="mt-1 text-xs text-muted-foreground">{item.source === "career_pages" ? "Employer and public ATS pages" : item.source === "mail" ? "Read-only recruitment updates" : "Job alerts and public links"}</p>{item.source === "mail" && <GmailConnection />}</div>;
        })}
      </div></details>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3"><span className="grid size-9 place-items-center rounded-md bg-primary/12 text-primary"><BriefcaseBusiness className="size-4" /></span><div><p className="font-display text-xl font-semibold">{scored.length}</p><p className="text-xs text-muted-foreground">roles evaluated</p></div></div>
        <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3"><span className="grid size-9 place-items-center rounded-md bg-success/12 text-success"><Target className="size-4" /></span><div><p className="font-display text-xl font-semibold">{scored.filter((item) => item.score.totalScore >= 70).length}</p><p className="text-xs text-muted-foreground">strong matches</p></div></div>
        <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3"><span className="grid size-9 place-items-center rounded-md bg-warning/12 text-warning"><ShieldCheck className="size-4" /></span><div><p className="font-display text-xl font-semibold">{scored.filter((item) => item.ukRole && item.verifiedSponsor).length}</p><p className="text-xs text-muted-foreground">licensed UK sponsors</p></div></div>
      </div>
      {!vault.isLoading && !vault.data?.some((item) => item.is_verified) && (
        <div className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          Fit scores only count verified evidence, and none is verified yet. <Link to="/vault" className="text-primary underline">Add or verify your experience</Link> to get real fit scores.
        </div>
      )}
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">New for review</h2><span className="text-xs text-muted-foreground">{scored.length} undecided · highest fit first</span></div>
      <div className="grid gap-3">
        {scored.map(({ job, sponsor, ukRole, verifiedSponsor, score }, index) => (
          <div key={job.id} className="group rounded-md border bg-card p-5 surface-lift transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/40">
            <div className="flex gap-4">
              <span className="hidden w-6 pt-1 font-mono text-[10px] text-muted-foreground sm:block">{String(index + 1).padStart(2, '0')}</span>
              <ScoreRing score={score.totalScore} />
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-semibold">{job.title}</h3>
                <p className="text-sm text-muted-foreground">{job.company_name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="capitalize">{job.source.replaceAll("_", " ")}</Badge>
                  <span>{new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round((new Date(job.discovered_at).getTime() - Date.now()) / 86_400_000), "day")}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}{job.is_remote ? " · Remote" : ""}</span>
                  {job.salary_range && <span>{job.salary_range}</span>}
                  {!ukRole ? (
                    <Badge variant="outline" className="text-muted-foreground">Outside UK · sponsor check n/a</Badge>
                  ) : verifiedSponsor ? (
                    <Badge className="gap-1 bg-success/15 text-success hover:bg-success/15"><BadgeCheck className="h-3 w-3" />Licensed sponsor</Badge>
                  ) : sponsor ? (
                    <Badge variant="outline" className="text-warning" title={`Closest register entry: ${sponsor.organisation_name}`}>Possible sponsor · confirm name</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">No sponsor match</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5 sm:ml-[6.5rem]">
              {score.matchedSkills.map((s) => <Badge key={s} variant="secondary" className="text-success">{s}</Badge>)}
              {score.missingSkills.map((s) => <Badge key={s} variant="outline" className="text-destructive">{s}</Badge>)}
            </div>
            <div className="mt-3 font-mono text-[10px] text-muted-foreground sm:ml-[6.5rem]">
              skills {score.skillScore} · seniority {score.seniorityScore} · domain {score.domainScore}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 sm:ml-[6.5rem]">
              <Button size="sm" variant="outline" onClick={() => { void decide(job.id, "saved"); void queue(job.id, score.totalScore); }}><Bookmark className="size-3.5" />Save role</Button>
              <Button size="sm" variant="ghost" onClick={() => decide(job.id, "dismissed")}><X className="size-3.5" />Dismiss</Button>
              {job.job_url && <Button size="sm" variant="ghost" asChild><a href={job.job_url} target="_blank" rel="noreferrer">Posting</a></Button>}
            </div>
          </div>
        ))}
      </div>
      {!scored.length && !jobs.isLoading && <div className="rounded-md border border-dashed p-10 text-center"><p className="font-display text-lg font-semibold">Discovery inbox cleared</p><p className="mt-2 text-sm text-muted-foreground">Add a role link or return after your next source sync.</p></div>}
    </div>
  );
}

function ImportJobDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const intake = useServerFn(intakeJobUrl);
  async function importJob() {
    setBusy(true);
    try {
      const result = await intake({ data: { url } });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(result.data.duplicate ? "This role is already in your inbox" : "Job imported and ready to review");
      setOpen(false);
      setUrl("");
      onAdded();
    } catch { toast.error("Enter a complete public job URL."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm"><Link2 className="size-4" />Paste job link</Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Import a job posting</DialogTitle></DialogHeader><div className="grid gap-3"><Input type="url" placeholder="LinkedIn, Indeed, or employer job URL" value={url} onChange={(event) => setUrl(event.target.value)} /><p className="text-xs text-muted-foreground">Nexus reads the public posting, extracts only stated facts, and flags pages it cannot access.</p><Button onClick={importJob} disabled={busy || !url.startsWith("http")}>{busy ? "Reading posting…" : "Import job"}</Button></div></DialogContent>
  </Dialog>;
}

function AddJobDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", company_name: "", location: "", job_url: "", required: "", preferred: "", years: "0", domain: "", description: "" });
  const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  async function save() {
    if (!f.title || !f.company_name) { toast.error("Title and company are required"); return; }
    const user_id = await uid();
    const { error } = await supabase.from("jobs").insert({
      user_id, title: f.title, company_name: f.company_name, location: f.location, job_url: f.job_url, description: f.description,
      required_skills: split(f.required), preferred_skills: split(f.preferred), min_years_exp: Number(f.years) || 0, domain: f.domain,
    });
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    onAdded();
  }
  const field = (k: keyof typeof f, label: string) => (
    <Input placeholder={label} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />Add role</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a role</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {field("title", "Job title")}
          {field("company_name", "Company")}
          {field("location", "Location")}
          {field("job_url", "Posting URL")}
          {field("required", "Required skills (comma separated)")}
          {field("preferred", "Preferred skills (comma separated)")}
          <div className="grid grid-cols-2 gap-3">{field("years", "Min years")}{field("domain", "Domain e.g. Fintech")}</div>
          <Textarea placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <Button onClick={save}>Save role</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
