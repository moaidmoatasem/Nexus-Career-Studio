import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ShieldCheck, ShieldAlert, Sparkles } from "lucide-react";
import { z } from "zod";
import { synthesizePack } from "@/lib/ai.functions";
import { useJobs, useApplications, useInvalidate, type TailoredPack } from "@/lib/data";
import { PageHeader, ScoreRing } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/synthesize")({
  validateSearch: z.object({ job: z.string().optional() }),
  head: () => ({ meta: [{ title: "Tailor — Nexus Career Studio" }, { name: "description", content: "Grounded tailored application packs." }, { property: "og:title", content: "Tailor — Nexus Career Studio" }, { property: "og:description", content: "Create role-specific materials from verified evidence." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SynthPage,
});

function SynthPage() {
  const { job: jobParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const jobs = useJobs();
  const apps = useApplications();
  const invalidate = useInvalidate();
  const run = useServerFn(synthesizePack);
  const [busy, setBusy] = useState(false);
  const jobId = jobParam ?? "";
  const job = jobs.data?.find((j) => j.id === jobId);
  const app = apps.data?.find((a) => a.job_id === jobId);
  const pack = app?.tailored_pack as unknown as TailoredPack | null;

  async function generate() {
    setBusy(true);
    try {
      const r = await run({ data: { jobId } });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Pack generated and audited");
      invalidate("applications");
    } finally {
      setBusy(false);
    }
  }
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copied"));

  return (
    <div>
      <PageHeader title="Prepare application" sub="Create role-specific materials from verified Career Vault items. Every number is fact-checked against them.">
        <div className="flex gap-2">
          <Select value={jobId} onValueChange={(v) => navigate({ search: { job: v } })}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Choose a role" /></SelectTrigger>
            <SelectContent>{jobs.data?.map((j) => <SelectItem key={j.id} value={j.id}>{j.title} · {j.company_name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={generate} disabled={!jobId || busy}><Sparkles className="h-4 w-4" />{busy ? "Generating…" : pack ? "Regenerate" : "Generate"}</Button>
        </div>
      </PageHeader>

      {!job && <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">Pick a role to tailor for.</p>}
      {job && !pack && !busy && <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">No pack yet for {job.title}. Generate one from your vault.</p>}
      {busy && <p className="animate-pulse rounded-lg border p-10 text-center text-muted-foreground">Tailoring from your vault and auditing every claim…</p>}

      {job && pack && !busy && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className={`flex items-center gap-3 rounded-lg border p-4 ${pack.provenanceValid ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10"}`}>
              {pack.provenanceValid ? <ShieldCheck className="h-5 w-5 text-success" /> : <ShieldAlert className="h-5 w-5 text-warning" />}
              <div className="text-sm">
                {pack.provenanceValid
                  ? "Fact-check passed — every number and metric traces to your verified Career Vault."
                  : `${pack.rejected.length} unsupported line(s) removed by the fact-check. Review the materials before sending.`}
              </div>
            </div>
            <section className="rounded-lg border bg-card p-5">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Resume bullets</h2>
                <Button size="sm" variant="ghost" onClick={() => copy(pack.bullets.map((b) => "• " + b.tailored_text).join("\n"))}><Copy className="h-4 w-4" /></Button></div>
              <ul className="space-y-3">
                {pack.bullets.map((b, i) => (
                  <li key={i} className="border-s-2 border-primary ps-3">
                    <p className="text-sm" dir="auto">{b.tailored_text}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">↳ {b.vault_item_id.slice(0, 8)} {b.verified_metrics.map((m) => `· ${m}`).join(" ")}</p>
                  </li>
                ))}
              </ul>
              {pack.rejected.length > 0 && (
                <div className="mt-4 space-y-1 border-t pt-3">{pack.rejected.map((v, i) => <p key={i} className="text-xs text-destructive">✕ {v.scope === "cover_letter" ? "Cover letter: " : v.scope === "recruiter_outreach" ? "Recruiter note: " : ""}{v.detail}</p>)}</div>
              )}
            </section>
            <section className="rounded-lg border bg-card p-5">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Cover letter</h2>
                <Button size="sm" variant="ghost" onClick={() => copy(pack.coverLetter)}><Copy className="h-4 w-4" /></Button></div>
              <p className="whitespace-pre-line text-sm leading-relaxed" dir="auto">{pack.coverLetter}</p>
            </section>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg border bg-card p-5">
              <ScoreRing score={pack.scoreBreakdown.totalScore} />
              <div><p className="font-semibold">{job.title}</p><p className="text-sm text-muted-foreground">{job.company_name}</p></div>
            </div>
            <section className="rounded-lg border bg-card p-5">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Recruiter note</h2>
                <Badge variant="outline" className="font-mono">{pack.recruiterOutreach.split(/\s+/).filter(Boolean).length}/75 words</Badge></div>
              <p className="text-sm" dir="auto">{pack.recruiterOutreach}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => copy(pack.recruiterOutreach)}><Copy className="h-4 w-4" />Copy</Button>
            </section>
            <Button asChild variant="secondary" className="w-full"><Link to="/resume" search={{ job: job.id }}>Open ATS resume</Link></Button>
          </div>
        </div>
      )}
    </div>
  );
}
