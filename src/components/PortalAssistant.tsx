import { Bot, Copy, Hand } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SIGNAL_LABEL, scanSponsorship } from "@/lib/sponsorship";
import { toast } from "sonner";
import { useProfile, useVault } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Portal = { id: string; label: string; steps: string[] };

const PORTALS: { match: RegExp; portal: Portal }[] = [
  { match: /lever\.co/i, portal: { id: "lever", label: "Lever", steps: ["Open the posting and click Apply.", "Upload your Lever-compatible PDF in Resume/CV.", "Paste the fields below; check the parsed name and email.", "Paste your cover letter in Additional information if there is no upload box.", "Review answers, then submit yourself."] } },
  { match: /greenhouse\.io/i, portal: { id: "greenhouse", label: "Greenhouse", steps: ["Scroll to the application form under the job description.", "Upload your resume PDF; attach or paste the cover letter.", "Paste the fields below into First name, Last name and links.", "Answer custom questions yourself where Nexus has no verified fact.", "Review, then submit yourself."] } },
  { match: /myworkdayjobs\.com|workday/i, portal: { id: "workday", label: "Workday", steps: ["Create or sign in to this employer's Workday account (each company has its own).", "Choose 'Autofill with resume' and upload the Workday-compatible Word file.", "Check every job title and date Workday parsed into My Experience.", "Answer eligibility, visa and self-identification questions yourself.", "Review, then submit yourself."] } },
  { match: /ashbyhq\.com/i, portal: { id: "ashby", label: "Ashby", steps: ["Click Apply for this job.", "Upload your resume PDF and paste the fields below.", "Review custom questions, then submit yourself."] } },
  { match: /workable\.com/i, portal: { id: "workable", label: "Workable", steps: ["Click Apply for this job.", "Upload your resume; Workable will pre-fill — correct anything wrong.", "Review, then submit yourself."] } },
  { match: /smartrecruiters\.com/i, portal: { id: "smartrecruiters", label: "SmartRecruiters", steps: ["Click I'm interested.", "Upload your resume and check parsed fields.", "Review, then submit yourself."] } },
];
const GENERIC: Portal = { id: "generic", label: "Employer site", steps: ["Open the official posting.", "Upload your Generic ATS PDF (or Word if requested).", "Paste the fields below where they fit.", "Review every answer, then submit yourself."] };

export function detectPortal(url?: string | null): Portal {
  return PORTALS.find((p) => url && p.match.test(url))?.portal ?? GENERIC;
}

export function PortalAssistant({ url, coverLetter, applicationId, description }: { url?: string | null | undefined; coverLetter?: string | undefined; applicationId?: string | undefined; description?: string | undefined }) {
  const qc = useQueryClient();
  const sponsorship = scanSponsorship(description ?? "");
  const task = useQuery({ enabled: !!applicationId, queryKey: ["portal-task", applicationId], refetchInterval: 15000, queryFn: async () => {
    const { data } = await supabase.from("portal_tasks").select("id,status,stop_reason,error,filled_fields,updated_at").eq("application_id", applicationId!).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data;
  } });
  async function queuePortal() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user || !applicationId || !url) return;
    if (!url.startsWith("https://")) { toast.error("The browser helper only opens secure (https) posting links."); return; }
    const { error } = await supabase.from("portal_tasks").insert({ user_id: auth.user.id, application_id: applicationId, portal_url: url, adapter: detectPortal(url).id });
    if (error) toast.error(error.message); else { toast.success("Queued for the browser helper on your server"); qc.invalidateQueries({ queryKey: ["portal-task", applicationId] }); }
  }
  const profile = useProfile();
  const vault = useVault();
  const portal = detectPortal(url);
  const [first = "", ...rest] = (profile.data?.full_name ?? "").split(" ");
  // "Verified fields" means exactly that: only Career Vault items the candidate has verified.
  const verified = (vault.data ?? []).filter((v) => v.is_verified);
  const current = verified.find((v) => v.category === "experience" && v.is_current) ?? verified.find((v) => v.category === "experience");
  const fields = [
    ["First name", first], ["Last name", rest.join(" ")], ["Headline", profile.data?.headline ?? ""],
    ["Current title", current?.title ?? ""], ["Current employer", current?.organization ?? ""],
    ["Skills", Array.from(new Set(verified.flatMap((v) => v.skills))).slice(0, 15).join(", ")],
    ...(coverLetter ? [["Cover letter", coverLetter]] : []),
  ].filter(([, v]) => v) as [string, string][];

  return <section className="rounded-md border bg-card p-5">
    <div className="flex items-center gap-2"><h3 className="font-display font-semibold">Portal assistant</h3><Badge variant="outline">{portal.label}</Badge></div>
    <p className="mt-2 text-xs text-muted-foreground">{SIGNAL_LABEL[sponsorship.signal]}{sponsorship.quote && <> — “{sponsorship.quote}”</>}. A sponsor licence alone doesn't guarantee this role is sponsored.</p>
    <ol className="mt-3 list-decimal space-y-1 ps-5 text-sm text-muted-foreground">{portal.steps.map((s) => <li key={s}>{s}</li>)}</ol>
    <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verified fields to paste</h4>
    <ul className="mt-2 divide-y text-sm">{fields.map(([k, v]) => <li key={k} className="flex items-center gap-3 py-1.5"><span className="w-32 shrink-0 text-muted-foreground">{k}</span><span className="flex-1 truncate">{v}</span><Button size="icon" variant="ghost" title={`Copy ${k}`} onClick={() => { navigator.clipboard.writeText(v); toast.success(`${k} copied`); }}><Copy /></Button></li>)}</ul>
    {applicationId && url && <div className="mt-4 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2"><Bot className="size-4 text-primary" /><span className="flex-1">Optional: let the browser helper on your server fill routine fields, then hand over to you.</span>
        <Button size="sm" variant="outline" onClick={queuePortal} disabled={task.data?.status === "queued" || task.data?.status === "running"}>Prepare in portal</Button></div>
      {task.data && <p className="mt-2 text-xs text-muted-foreground">Status: {task.data.status.replace(/_/g, " ")}{task.data.stop_reason ? ` — ${task.data.stop_reason}` : ""}{task.data.error ? ` — ${task.data.error}` : ""}{task.data.status === "queued" ? " (needs the helper running on your server; see the setup guide)" : ""}</p>}
    </div>}
    <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><Hand className="mt-0.5 size-3.5 shrink-0 text-warning" />You handle security checks, sign-in codes, salary, visa and legal declarations, diversity questions and the final Submit. Nexus never answers these for you.</p>
  </section>;
}
