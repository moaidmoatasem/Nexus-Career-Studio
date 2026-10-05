import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Hand, Mail, Send, CalendarClock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApplications, useUnmatchedMail } from "@/lib/data";
import { Button } from "@/components/ui/button";

export function ReviewQueue() {
  const qc = useQueryClient();
  const apps = useApplications();
  const mail = useUnmatchedMail();
  const needs = useQuery({ queryKey: ["agent-needs-you"], queryFn: async () => {
    const { data } = await supabase.from("agent_activity").select("id,summary,application_id,created_at").eq("status", "needs_you").order("created_at", { ascending: false }).limit(5);
    return data ?? [];
  } });
  const [choice, setChoice] = useState<Record<string, string>>({});
  const all = apps.data ?? [];
  const ready = all.filter((a) => a.status === "tailored");
  const followUps = all.filter((a) => a.next_action?.startsWith("Follow up"));
  const titleOf = (id: string) => { const a = all.find((x) => x.id === id); return a?.jobs ? `${a.jobs.title} · ${a.jobs.company_name}` : "Application"; };
  const suggest = (company: string | null) => all.find((a) => company && a.jobs?.company_name.toLowerCase().includes(company.toLowerCase().split(" ")[0] ?? ""))?.id;

  async function link(m: { id: string; subject: string; action_summary: string | null }, appId: string) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const app = all.find((a) => a.id === appId);
    const { error } = await supabase.from("unmatched_mail_messages").update({ review_status: "linked", linked_application_id: appId }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("application_events").insert({ user_id: auth.user.id, application_id: appId, job_id: app?.job_id ?? null, event_type: "email_classified", title: "Recruiter email linked by you", detail: m.action_summary ?? m.subject, source: "gmail" });
    toast.success("Email linked to the application");
    await Promise.all(["unmatched-mail", "application-events", "applications"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  }

  const count = (mail.data?.length ?? 0) + ready.length + followUps.length + (needs.data?.length ?? 0);
  return <section className="mt-6 rounded-md border bg-card p-5">
    <h2 className="flex items-center gap-2 font-display font-semibold"><Hand className="size-4 text-warning" />Needs your decision <span className="text-sm font-normal text-muted-foreground">({count})</span></h2>
    {count === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing waiting on you right now.</p>}
    <ul className="mt-3 divide-y text-sm">
      {(mail.data ?? []).map((m) => { const value = choice[m.id] ?? suggest(m.company_name) ?? ""; return <li key={m.id} className="flex flex-wrap items-center gap-2 py-2.5">
        <Mail className="size-4 text-primary" /><span className="min-w-0 flex-1"><b>Unclear email:</b> {m.subject} <span className="text-muted-foreground">from {m.sender}</span></span>
        <select aria-label="Choose application" className="h-8 rounded-md border bg-background px-2 text-xs" value={value} onChange={(e) => setChoice({ ...choice, [m.id]: e.target.value })}>
          <option value="">Choose application…</option>{all.map((a) => <option key={a.id} value={a.id}>{titleOf(a.id)}</option>)}
        </select>
        <Button size="sm" disabled={!value} onClick={() => link(m, value)}>Link</Button>
        <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("unmatched_mail_messages").update({ review_status: "dismissed" }).eq("id", m.id); qc.invalidateQueries({ queryKey: ["unmatched-mail"] }); }}>Dismiss</Button>
      </li>; })}
      {ready.map((a) => <li key={a.id} className="flex items-center gap-2 py-2.5"><Send className="size-4 text-primary" /><span className="flex-1"><b>Ready to submit:</b> {titleOf(a.id)}</span><Button size="sm" variant="outline" asChild><Link to="/applications/$applicationId" params={{ applicationId: a.id }}>Open</Link></Button></li>)}
      {followUps.map((a) => <li key={a.id} className="flex items-center gap-2 py-2.5"><CalendarClock className="size-4 text-warning" /><span className="flex-1"><b>Follow-up due:</b> {titleOf(a.id)}</span><Button size="sm" variant="outline" asChild><Link to="/applications/$applicationId" params={{ applicationId: a.id }}>Open</Link></Button></li>)}
      {(needs.data ?? []).map((n) => <li key={n.id} className="flex items-center gap-2 py-2.5"><Hand className="size-4 text-warning" /><span className="flex-1">{n.summary}</span>{n.summary.includes("Gmail") && <Button size="sm" variant="outline" asChild><Link to="/connections">Fix</Link></Button>}</li>)}
    </ul>
  </section>;
}
