import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, CheckCircle2, AlertTriangle, CircleSlash, Hand, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAgentHealth, runMyAgentNow } from "@/lib/agent.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const MODES = [
  { id: "review_first", label: "Review-first", hint: "Agent finds and drafts. You approve everything." },
  { id: "guided", label: "Guided", hint: "Agent fills routine details. You review answers and submit." },
  { id: "high_autonomy", label: "High autonomy", hint: "Agent works within your rules. Always stops before submitting." },
] as const;

const ICON = { succeeded: CheckCircle2, failed: AlertTriangle, needs_you: Hand, skipped: CircleSlash } as const;
const TONE = { succeeded: "text-success", failed: "text-destructive", needs_you: "text-warning", skipped: "text-muted-foreground" } as const;

export function AgentPanel() {
  const qc = useQueryClient();
  const runNow = useServerFn(runMyAgentNow);
  const healthCall = useServerFn(getAgentHealth);
  const [busy, setBusy] = useState(false);
  const settings = useQuery({ queryKey: ["agent-settings"], queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { data } = await supabase.from("agent_settings").select("*").eq("user_id", auth.user!.id).maybeSingle();
    return { userId: auth.user!.id, enabled: data?.enabled ?? false, autonomy: data?.autonomy ?? "review_first", last_run_at: data?.last_run_at ?? null };
  } });
  const activity = useQuery({ queryKey: ["agent-activity"], queryFn: async () => {
    const { data } = await supabase.from("agent_activity").select("id,task_type,status,summary,created_at,application_id").order("created_at", { ascending: false }).limit(8);
    return data ?? [];
  } });
  const health = useQuery({ queryKey: ["agent-health"], queryFn: () => healthCall() });

  async function save(patch: { enabled?: boolean; autonomy?: string }) {
    if (!settings.data) return;
    const { error } = await supabase.from("agent_settings").upsert({ user_id: settings.data.userId, enabled: settings.data.enabled, autonomy: settings.data.autonomy, ...patch }, { onConflict: "user_id" });
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["agent-settings"] });
  }

  async function run() {
    setBusy(true);
    try {
      const r = await runNow();
      toast[r.ok ? "success" : "error"](r.ok ? "Agent run finished" : "Agent run needs your attention");
      await Promise.all(["agent-activity", "agent-settings", "applications"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Agent run failed"); }
    finally { setBusy(false); }
  }

  const s = settings.data;
  const scheduler = health.data?.scheduler;
  return <section className="mt-6 rounded-md border bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <Bot className="mt-0.5 size-5 text-primary" />
        <div>
          <h2 className="font-display font-semibold">Your career agent</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {s?.enabled ? (scheduler ? "On — checks your inbox and follow-ups in the background." : "On — runs when you press Run now. Add the scheduler on your server for background runs.") : "Off — turn on to let Nexus work between visits."}
            {s?.last_run_at && ` Last run ${new Date(s.last_run_at).toLocaleString()}.`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm"><Switch checked={!!s?.enabled} onCheckedChange={(v) => save({ enabled: v })} disabled={!s} />{s?.enabled ? "On" : "Off"}</label>
        <Button size="sm" variant="outline" onClick={run} disabled={busy}><Play />{busy ? "Running…" : "Run now"}</Button>
      </div>
    </div>

    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      {MODES.map((m) => <button key={m.id} type="button" onClick={() => save({ autonomy: m.id })}
        className={`rounded-md border p-3 text-left text-sm transition-colors ${s?.autonomy === m.id ? "border-primary bg-primary/10" : "hover:bg-secondary"}`}>
        <span className="font-medium">{m.label}</span><span className="mt-1 block text-xs text-muted-foreground">{m.hint}</span>
      </button>)}
    </div>
    <p className="mt-2 text-[11px] text-muted-foreground">In every mode the agent stops for final submission, CAPTCHA or sign-in checks, and legal or visa declarations.</p>

    <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agent activity</h3>
    {activity.data?.length ? <ul className="mt-2 divide-y">
      {activity.data.map((a) => { const Icon = ICON[a.status as keyof typeof ICON] ?? CheckCircle2; return <li key={a.id} className="flex items-start gap-2 py-2 text-sm">
        <Icon className={`mt-0.5 size-4 shrink-0 ${TONE[a.status as keyof typeof TONE] ?? ""}`} />
        <span className="flex-1">{a.summary}</span>
        <time className="shrink-0 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</time>
      </li>; })}
    </ul> : <p className="mt-2 text-sm text-muted-foreground">Nothing yet. Press Run now to see the agent work.</p>}
  </section>;
}
