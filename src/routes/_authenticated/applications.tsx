import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Mail, ExternalLink, Check, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classifyEmail, type EmailClassification } from "@/lib/ai.functions";
import { useApplications, useInvalidate, useUnmatchedMail, type TailoredPack } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GmailConnection } from "@/components/GmailConnection";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({
    meta: [
      { title: "Applications — Nexus Career Studio" },
      { name: "description", content: "Your application pipeline." },
      { property: "og:title", content: "Applications — Nexus Career Studio" },
      { property: "og:description", content: "Track every application from queue to outcome." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppsPage,
});

const STAGES = [
  { id: "queued", label: "Daily queue" },
  { id: "tailored", label: "Ready to dispatch" },
  { id: "applied", label: "Applied" },
  { id: "screening", label: "Screening" },
  { id: "interviewing", label: "Interviewing" },
  { id: "offered", label: "Offer" },
  { id: "rejected", label: "Archived" },
];

function AppsPage() {
  const apps = useApplications();
  const unmatched = useUnmatchedMail();
  const invalidate = useInvalidate();
  async function move(id: string, status: string) {
    const app = apps.data?.find((item) => item.id === id);
    const { data: auth } = await supabase.auth.getUser();
    await supabase
      .from("applications")
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(status === "applied" ? { applied_at: new Date().toISOString() } : {}),
      })
      .eq("id", id);
    if (auth.user && app)
      await supabase.from("application_events").insert({
        user_id: auth.user.id,
        application_id: id,
        job_id: app.job_id,
        event_type: status === "applied" ? "submitted" : "stage_changed",
        title: status === "applied" ? "Application marked submitted" : `Moved to ${status}`,
        detail: `${app.jobs?.title ?? "Role"} at ${app.jobs?.company_name ?? "company"}`,
      });
    invalidate("applications", "application-events");
  }
  async function dispatch(a: NonNullable<typeof apps.data>[number]) {
    const pack = a.tailored_pack as unknown as TailoredPack | null;
    if (pack) await navigator.clipboard.writeText(pack.coverLetter);
    if (a.jobs?.job_url) window.open(a.jobs.job_url, "_blank", "noopener");
    toast.success("Cover letter copied — portal opened. Mark as applied when done.");
  }
  async function linkMail(mail: NonNullable<typeof unmatched.data>[number], applicationId: string) {
    const app = apps.data?.find((item) => item.id === applicationId);
    const { data: auth } = await supabase.auth.getUser();
    if (!app || !auth.user) return;
    await Promise.all([
      supabase
        .from("unmatched_mail_messages")
        .update({ linked_application_id: applicationId, review_status: "linked" })
        .eq("id", mail.id),
      supabase
        .from("applications")
        .update({
          last_email_status: mail.classification,
          next_action: mail.action_summary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId),
      supabase.from("application_events").insert({
        user_id: auth.user.id,
        application_id: applicationId,
        job_id: app.job_id,
        event_type: "email_linked",
        title: "Recruitment email linked after review",
        detail: mail.action_summary,
        source: "gmail",
      }),
    ]);
    invalidate("applications", "application-events", "unmatched-mail");
    toast.success("Email linked to the application.");
  }
  return (
    <div>
      <PageHeader
        title="Applications"
        sub="Prepare each application, submit on the official portal, then track what happens next."
      >
        <div className="flex flex-wrap gap-2">
          <GmailConnection compact />
          <EmailTriage onDone={() => invalidate("applications")} />
        </div>
      </PageHeader>
      {!!unmatched.data?.length && (
        <section className="mb-5 border-l-2 border-warning bg-warning/5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-semibold">
                {unmatched.data.length} email{unmatched.data.length === 1 ? " needs" : "s need"}{" "}
                review
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Nexus could not confidently link these messages, so no application was moved.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {unmatched.data.slice(0, 4).map((mail) => (
              <div key={mail.id} className="rounded-md border bg-card p-3">
                <p className="truncate text-sm font-medium">
                  {mail.subject || "Recruitment email"}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{mail.sender}</p>
                <p className="mt-2 text-xs">{mail.action_summary}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Select onValueChange={(value) => linkMail(mail, value)}>
                    <SelectTrigger className="h-8 min-w-0 flex-1 text-xs">
                      <SelectValue placeholder="Link to application" />
                    </SelectTrigger>
                    <SelectContent>
                      {apps.data?.map((app) => (
                        <SelectItem key={app.id} value={app.id}>
                          {app.jobs?.company_name} · {app.jobs?.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await supabase
                        .from("unmatched_mail_messages")
                        .update({ review_status: "dismissed" })
                        .eq("id", mail.id);
                      invalidate("unmatched-mail");
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((s) => {
          const items = apps.data?.filter((a) => a.status === s.id) ?? [];
          return (
            <div key={s.id} className="w-72 shrink-0 rounded-lg border bg-card/50 p-3">
              <div className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">
                {s.label}
                <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.map((a) => (
                  <div key={a.id} className="rounded-md border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.jobs?.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.jobs?.company_name}
                        </p>
                      </div>
                      <span className="font-mono text-sm text-primary">{a.fit_score}</span>
                    </div>
                    {a.next_action && <p className="mt-2 text-xs text-warning">{a.next_action}</p>}
                    {a.last_email_status && (
                      <Badge variant="outline" className="mt-2 font-mono text-[10px]">
                        {a.last_email_status}
                      </Badge>
                    )}
                    {s.id === "tailored" && (
                      <div className="mt-3 rounded-sm bg-secondary/55 p-2.5">
                        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium">
                          <ClipboardCheck className="size-3.5 text-primary" />
                          Application checklist
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1 text-success">
                            <Check className="size-3" />
                            Resume tailored
                          </span>
                          <span className="flex items-center gap-1 text-success">
                            <Check className="size-3" />
                            Claims audited
                          </span>
                          <span>○ Review portal</span>
                          <span>○ Confirm submission</span>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" asChild>
                        <Link to="/applications/$applicationId" params={{ applicationId: a.id }}>
                          Open
                        </Link>
                      </Button>
                      {s.id === "queued" && (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/synthesize" search={{ job: a.job_id }}>
                            Prepare
                          </Link>
                        </Button>
                      )}
                      {s.id === "tailored" && (
                        <Button size="sm" onClick={() => dispatch(a)}>
                          <ExternalLink className="h-3 w-3" />
                          Portal
                        </Button>
                      )}
                      {s.id === "tailored" && (
                        <Button size="sm" variant="outline" onClick={() => move(a.id, "applied")}>
                          <Check className="h-3 w-3" />
                          Mark applied
                        </Button>
                      )}
                      <Select value={a.status} onValueChange={(v) => move(a.id, v)}>
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map((x) => (
                            <SelectItem key={x.id} value={x.id}>
                              {x.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmailTriage({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ sender: "", subject: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<
    (EmailClassification & { movedApplicationId: string | null; matchNote: string }) | null
  >(null);
  const run = useServerFn(classifyEmail);
  async function go() {
    setBusy(true);
    try {
      const r = await run({ data: f });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setRes(r.data);
      onDone();
    } catch {
      toast.error("Paste the email body first.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setRes(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Mail className="h-4 w-4" />
          Paste an email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Classify a recruiter email</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Input
            placeholder="From (e.g. no-reply@myworkday.com)"
            value={f.sender}
            onChange={(e) => setF({ ...f, sender: e.target.value })}
          />
          <Input
            placeholder="Subject"
            value={f.subject}
            onChange={(e) => setF({ ...f, subject: e.target.value })}
          />
          <Textarea
            rows={8}
            placeholder="Email body"
            value={f.body}
            onChange={(e) => setF({ ...f, body: e.target.value })}
          />
          <Button onClick={go} disabled={busy || f.body.length < 5}>
            {busy ? "Classifying…" : "Classify & update board"}
          </Button>
          <p className="text-xs text-muted-foreground">
            An application only moves when the email names both the employer and the role, and never
            moves backwards.
          </p>
          {res && (
            <div className="rounded-md border bg-secondary/40 p-3 text-sm">
              <p>
                <Badge className="font-mono">{res.status}</Badge>{" "}
                <span className="ms-2 text-muted-foreground">
                  {res.company_name} · {Math.round(res.confidence * 100)}%
                </span>
              </p>
              <p className="mt-2">{res.action_summary}</p>
              {res.scheduling_url && (
                <a
                  className="mt-1 block text-primary underline"
                  href={res.scheduling_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Scheduling link
                </a>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{res.matchNote}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
