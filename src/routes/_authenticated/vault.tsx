import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Sparkles, Trash2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractVault } from "@/lib/ai.functions";
import { useVault, useProfile, useInvalidate, uid } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/vault")({
  head: () => ({ meta: [{ title: "Career Vault — Nexus Career Studio" }, { name: "description", content: "Your verified accomplishments." }, { property: "og:title", content: "Career Vault — Nexus Career Studio" }, { property: "og:description", content: "Manage the verified evidence behind every application." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: VaultPage,
});

function VaultPage() {
  const vault = useVault();
  const invalidate = useInvalidate();
  async function toggleVerify(id: string, v: boolean) {
    await supabase.from("vault_items").update({ is_verified: v }).eq("id", id);
    invalidate("vault");
  }
  async function remove(id: string) {
    await supabase.from("vault_items").delete().eq("id", id);
    invalidate("vault");
  }
  return (
    <div>
      <PageHeader title="Career profile" sub="Add the experience, achievements, and preferences that power your applications.">
        <div className="flex gap-2">
          <ExtractDialog onDone={() => invalidate("vault")} />
          <AddItemDialog onDone={() => invalidate("vault")} />
        </div>
      </PageHeader>
      <ProfileCard />
      <div className="mt-6 grid gap-4">
        {vault.data?.length === 0 && <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">No items yet. Paste your CV into the AI extractor to get started.</p>}
        {vault.data?.map((v) => (
          <div key={v.id} className="rounded-lg border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">{v.category}</Badge>
                  <h3 className="font-semibold">{v.title}</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{v.organization} {v.start_date && `· ${v.start_date} – ${v.is_current ? "Present" : v.end_date}`}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant={v.is_verified ? "secondary" : "outline"} onClick={() => toggleVerify(v.id, !v.is_verified)}>
                  <CheckCircle2 className={`h-4 w-4 ${v.is_verified ? "text-success" : ""}`} />{v.is_verified ? "Verified" : "Verify"}
                </Button>
                <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(v.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            {v.description && <p className="mt-3 text-sm" dir="auto">{v.description}</p>}
            {v.metrics.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">{v.metrics.map((m) => <Badge key={m} className="bg-success/15 font-mono text-success hover:bg-success/15">{m}</Badge>)}</div>
            )}
            {v.skills.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{v.skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>}
            <p className="mt-3 font-mono text-[10px] text-muted-foreground">vault_item_id {v.id}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileCard() {
  const profile = useProfile();
  const invalidate = useInvalidate();
  const [f, setF] = useState({ full_name: "", headline: "", years: "0", domains: "", titles: "", locations: "", visa: true });
  useEffect(() => {
    if (profile.data)
      setF({ full_name: profile.data.full_name, headline: profile.data.headline, years: String(profile.data.years_experience), domains: profile.data.target_domains.join(", "), titles: profile.data.target_titles.join(", "), locations: profile.data.target_locations.join(", "), visa: profile.data.requires_visa });
  }, [profile.data]);
  async function save() {
    const id = await uid();
    const { error } = await supabase.from("profiles").update({
      full_name: f.full_name, headline: f.headline, years_experience: Number(f.years) || 0,
      target_domains: f.domains.split(",").map((d) => d.trim()).filter(Boolean), target_titles: f.titles.split(",").map((d) => d.trim()).filter(Boolean), target_locations: f.locations.split(",").map((d) => d.trim()).filter(Boolean), requires_visa: f.visa, updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
    invalidate("profile");
  }
  return (
    <div className="grid gap-3 rounded-lg border bg-card/60 p-5 md:grid-cols-6 md:items-end">
      <div className="md:col-span-2"><Label>Full name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Headline</Label><Input value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} /></div>
      <div><Label>Years exp.</Label><Input type="number" value={f.years} onChange={(e) => setF({ ...f, years: e.target.value })} /></div>
      <div className="flex items-center gap-2 pb-2"><Switch checked={f.visa} onCheckedChange={(v) => setF({ ...f, visa: v })} /><Label>Need visa</Label></div>
      <div className="md:col-span-2"><Label>Target roles</Label><Input placeholder="Product Manager, Data Analyst" value={f.titles} onChange={(e) => setF({ ...f, titles: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Target locations</Label><Input placeholder="London, Remote" value={f.locations} onChange={(e) => setF({ ...f, locations: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Target domains</Label><Input placeholder="Fintech, AI/ML" value={f.domains} onChange={(e) => setF({ ...f, domains: e.target.value })} /></div>
      <Button onClick={save}>Save profile</Button>
    </div>
  );
}

function ExtractDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const run = useServerFn(extractVault);
  async function go() {
    setBusy(true);
    try {
      const r = await run({ data: { text } });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(`Extracted ${r.data.count} items — review and verify them`);
      setOpen(false);
      setText("");
      onDone();
    } catch {
      toast.error("Paste at least a few lines of your CV.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Sparkles className="h-4 w-4" />AI extract from CV</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Extract vault items from your CV</DialogTitle></DialogHeader>
        <Textarea dir="auto" rows={14} placeholder="Paste your CV or LinkedIn text (English or Arabic)…" value={text} onChange={(e) => setText(e.target.value)} />
        <Button onClick={go} disabled={busy || text.length < 20}>{busy ? "Extracting…" : "Extract"}</Button>
      </DialogContent>
    </Dialog>
  );
}

function AddItemDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", organization: "", start_date: "", end_date: "", description: "", metrics: "", skills: "" });
  async function save() {
    if (!f.title) { toast.error("Title is required"); return; }
    const user_id = await uid();
    const lines = (s: string, sep: RegExp) => s.split(sep).map((x) => x.trim()).filter(Boolean);
    const { error } = await supabase.from("vault_items").insert({
      user_id, title: f.title, organization: f.organization, start_date: f.start_date, end_date: f.end_date, description: f.description,
      metrics: lines(f.metrics, /\n/), skills: lines(f.skills, /,/), is_verified: true,
    });
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    onDone();
  }
  const inp = (k: keyof typeof f, p: string) => <Input placeholder={p} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4" />Add item</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add vault item</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {inp("title", "Role or achievement title")}
          {inp("organization", "Organization")}
          <div className="grid grid-cols-2 gap-3">{inp("start_date", "Start (e.g. 2021)")}{inp("end_date", "End")}</div>
          <Textarea placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <Textarea placeholder={"Metrics, one per line\nReduced API latency by 42%"} value={f.metrics} onChange={(e) => setF({ ...f, metrics: e.target.value })} />
          {inp("skills", "Skills (comma separated)")}
          <Button onClick={save}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
