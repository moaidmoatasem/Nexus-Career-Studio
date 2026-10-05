import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bookmark, MapPin } from "lucide-react";
import { useJobs, useRoleDecisions, useApplications } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({ meta: [{ title: "Saved roles — Nexus Career Studio" }, { name: "description", content: "Your shortlisted opportunities." }, { property: "og:title", content: "Saved roles — Nexus Career Studio" }, { property: "og:description", content: "Review shortlisted roles and start a grounded application." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SavedRoles,
});

function SavedRoles() {
  const jobs = useJobs();
  const decisions = useRoleDecisions();
  const applications = useApplications();
  const saved = new Set((decisions.data ?? []).filter((item) => item.decision === "saved").map((item) => item.job_id));
  const rows = (jobs.data ?? []).filter((job) => saved.has(job.id));
  return <div><PageHeader title="Saved roles" sub="Your shortlist, ready for a closer review." />
    <div className="space-y-3">{rows.map((job) => {
      const application = applications.data?.find((item) => item.job_id === job.id);
      return <article key={job.id} className="flex flex-col justify-between gap-4 border-b py-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><Bookmark className="size-4 text-primary" /><h2 className="font-display text-lg font-semibold">{job.title}</h2></div><p className="mt-1 text-sm text-muted-foreground">{job.company_name}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><MapPin className="size-3" />{job.location || "Location not stated"}</span><Badge variant="outline">{job.source.replaceAll("_", " ")}</Badge></div></div><Button asChild><Link to={application ? "/applications/$applicationId" : "/synthesize"} {...(application ? { params: { applicationId: application.id } } : { search: { job: job.id } })}>{application ? "Open application" : "Prepare application"}<ArrowRight /></Link></Button></article>;
    })}{!rows.length && <div className="border-y border-dashed py-14 text-center"><Bookmark className="mx-auto size-6 text-muted-foreground" /><h2 className="mt-3 font-display text-lg font-semibold">No saved roles yet</h2><p className="mt-1 text-sm text-muted-foreground">Save promising roles from Discover before preparing an application.</p><Button className="mt-5" asChild><Link to="/radar">Discover roles <ArrowRight /></Link></Button></div>}</div>
  </div>;
}