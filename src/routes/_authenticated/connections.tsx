import { createFileRoute } from "@tanstack/react-router";
import { Building2, CheckCircle2, Link2, Mail, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { GmailConnection } from "@/components/GmailConnection";
import { GmailSetupHelp } from "@/components/GmailSetupHelp";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/connections")({
  head: () => ({ meta: [{ title: "Connections — Nexus Career Studio" }, { name: "description", content: "Manage private career data connections." }, { property: "og:title", content: "Connections — Nexus Career Studio" }, { property: "og:description", content: "Connect Gmail and understand each discovery source." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ConnectionsPage,
});

function ConnectionsPage() {
  return <div><PageHeader title="Connections" sub="Choose where opportunities and application updates come from." />
    <section className="border-y py-6"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-start"><div className="flex max-w-xl gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/12 text-primary"><Mail className="size-5" /></span><div><div className="flex items-center gap-2"><h2 className="font-display text-lg font-semibold">Gmail</h2><Badge variant="outline">Optional</Badge></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Imports LinkedIn and Indeed job alerts, then watches recruitment messages for confident application updates. Read-only: Nexus cannot send, delete, or mark mail as read.</p><div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><ShieldCheck className="size-3.5 text-success" />Encrypted per user</span><span className="flex items-center gap-1"><CheckCircle2 className="size-3.5 text-success" />Ambiguous mail requires review</span></div></div></div><GmailConnection /></div><GmailSetupHelp /></section>
    <div className="grid gap-0 md:grid-cols-3">
      <Source icon={Building2} title="Employer career pages" state="Ready" copy="Public Workday, Lever, Greenhouse, Ashby, and employer pages are verified before import." />
      <Source icon={Link2} title="LinkedIn & Indeed" state="Via alerts or links" copy="Paste a public posting or receive your own email alerts. No private account scraping or fake job-feed access." />
      <Source icon={Mail} title="Automatic inbox updates" state="Deployment setup" copy="A self-hosted owner can add Google Pub/Sub. Manual Check inbox remains available without it." />
    </div>
    <section className="mt-8 border-l-2 border-primary px-5 py-2"><h2 className="font-display font-semibold">Community-first operating model</h2><p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">Your deployment owns its database and credentials. Optional AI, extraction, and automatic email delivery can be enabled individually, so the core workflow still works on a low budget.</p></section>
  </div>;
}

function Source({ icon: Icon, title, state, copy }: { icon: typeof Mail; title: string; state: string; copy: string }) {
  return <div className="border-b py-6 md:border-r md:px-5 md:first:pl-0 md:last:border-r-0"><Icon className="size-4 text-primary" /><h3 className="mt-3 font-medium">{title}</h3><p className="mt-1 text-xs font-medium text-success">{state}</p><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{copy}</p></div>;
}