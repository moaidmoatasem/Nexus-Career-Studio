import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check, ExternalLink, FileText, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApplications, useApplicationEvents, useInvalidate, type TailoredPack } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PortalAssistant } from "@/components/PortalAssistant";

export const Route = createFileRoute("/_authenticated/applications/$applicationId")({
  head: () => ({ meta: [{ title: "Application workspace — Nexus Career Studio" }, { name: "description", content: "Prepare and track one job application." }, { property: "og:title", content: "Application workspace — Nexus Career Studio" }, { property: "og:description", content: "Review evidence, materials, submission, and recruitment updates." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ApplicationWorkspace,
});

function ApplicationWorkspace() {
  const { applicationId } = Route.useParams();
  const applications = useApplications();
  const events = useApplicationEvents();
  const invalidate = useInvalidate();
  if (applications.isLoading) return <p className="text-sm text-muted-foreground">Loading application…</p>;
  const application = applications.data?.find((item) => item.id === applicationId);
  if (!application) throw notFound();
  const current = application;
  const pack = current.tailored_pack as unknown as TailoredPack | null;
  const timeline = (events.data ?? []).filter((event) => event.application_id === current.id);
  const submitted = Boolean(current.applied_at);
  async function confirmSubmitted() {
    const now = new Date().toISOString();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await Promise.all([
      supabase.from("applications").update({ status: "applied", applied_at: now, updated_at: now, next_action: "Watch for confirmation or recruiter follow-up" }).eq("id", current.id),
      supabase.from("application_events").insert({ user_id: auth.user.id, application_id: current.id, job_id: current.job_id, event_type: "submitted", title: "Submission confirmed by candidate", detail: current.jobs?.job_url || "Manual application", source: "user" }),
    ]);
    invalidate("applications", "application-events");
    toast.success("Application moved to Applied");
  }
  const provider = current.jobs?.source_provider || current.jobs?.source || "employer";
  return <div><Link to="/applications" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Applications</Link>
    <div className="flex flex-col justify-between gap-5 border-b pb-7 md:flex-row md:items-end"><div><div className="mb-2 flex flex-wrap gap-2"><Badge variant="outline">{current.status}</Badge><Badge variant="secondary">{provider.replaceAll("_", " ")}</Badge></div><h1 className="font-display text-3xl font-semibold">{current.jobs?.title}</h1><p className="mt-2 text-muted-foreground">{current.jobs?.company_name} · {current.jobs?.location || "Location not stated"}</p></div><span className="font-display text-3xl text-primary">{current.fit_score}<span className="text-sm text-muted-foreground"> / 100 fit</span></span></div>
    <div className="grid gap-8 py-8 lg:grid-cols-[1.25fr_.75fr]"><main className="space-y-8"><section><h2 className="font-display text-xl font-semibold">Application checklist</h2><div className="mt-4 grid gap-2 sm:grid-cols-2"><CheckRow done={Boolean(pack)} label="Materials tailored" /><CheckRow done={Boolean(pack?.provenanceValid)} label="Claims verified" /><CheckRow done={submitted} label="Official portal completed" /><CheckRow done={submitted} label="Submission confirmed" /></div></section>
      <section className="border-y py-6"><h2 className="font-display text-xl font-semibold">Your materials</h2>{pack ? <div className="mt-4 flex flex-wrap gap-3"><Button asChild><Link to="/resume" search={{ job: current.job_id }}><FileText />Review ATS resume</Link></Button><Button variant="outline" asChild><Link to="/synthesize" search={{ job: current.job_id }}>Review cover letter</Link></Button></div> : <div className="mt-4"><p className="text-sm text-muted-foreground">Create a grounded pack from your verified career evidence before applying.</p><Button className="mt-4" asChild><Link to="/synthesize" search={{ job: current.job_id }}>Prepare materials</Link></Button></div>}</section>
      <section><h2 className="font-display text-xl font-semibold">Submit on the official portal</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Nexus prepares your evidence and answers. You review the employer’s questions and make the final submission.</p><div className="mt-4 flex flex-wrap gap-3">{current.jobs?.job_url && <Button asChild><a href={current.jobs.job_url} target="_blank" rel="noreferrer">Open official posting <ExternalLink /></a></Button>}<Button variant="outline" disabled={submitted} onClick={confirmSubmitted}><Check />{submitted ? "Submission confirmed" : "I submitted this application"}</Button></div><div className="mt-5"><PortalAssistant applicationId={current.id} description={current.jobs?.description} url={current.jobs?.job_url} coverLetter={(current.tailored_pack as unknown as TailoredPack | null)?.coverLetter} /></div></section></main>
      <aside><h2 className="font-display text-lg font-semibold">Activity</h2><div className="mt-4 border-l pl-5">{timeline.map((event) => <div key={event.id} className="relative pb-5"><span className="absolute -left-[1.55rem] top-1 grid size-4 place-items-center rounded-full border bg-background">{event.source === "gmail" ? <Mail className="size-2.5 text-primary" /> : <ShieldCheck className="size-2.5 text-primary" />}</span><p className="text-sm font-medium">{event.title}</p>{event.detail && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{event.detail}</p>}<p className="mt-1 text-[10px] text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p></div>)}{!timeline.length && <p className="text-sm text-muted-foreground">Activity will appear as you prepare and submit.</p>}</div></aside></div>
  </div>;
}

function CheckRow({ done, label }: { done: boolean; label: string }) { return <div className={`flex items-center gap-3 border px-4 py-3 text-sm ${done ? "border-success/30 bg-success/5" : "bg-card"}`}><span className={`grid size-5 place-items-center rounded-full ${done ? "bg-success text-success-foreground" : "border text-muted-foreground"}`}>{done && <Check className="size-3" />}</span>{label}</div>; }