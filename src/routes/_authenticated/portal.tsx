import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { synthesizePack } from "@/lib/ai.functions";
import { useInvalidate } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "New application — Nexus Career Studio" },
      {
        name: "description",
        content: "Enter job details and prepare a grounded resume and cover letter.",
      },
      { property: "og:title", content: "New application — Nexus Career Studio" },
      {
        property: "og:description",
        content: "Type a role's details and get application materials from your Career Vault.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalPage,
});

const split = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function PortalPage() {
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const synth = useServerFn(synthesizePack);
  const [busy, setBusy] = useState<string | null>(null);
  const [f, setF] = useState({
    title: "",
    company_name: "",
    location: "",
    job_url: "",
    required: "",
    description: "",
  });
  const set =
    (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim() || !f.company_name.trim() || f.description.trim().length < 40) {
      toast.error("Add a job title, company and at least a short job description.");
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const user_id = auth.user?.id;
    if (!user_id) return;
    try {
      setBusy("Saving the role…");
      const { data: job, error } = await supabase
        .from("jobs")
        .insert({
          user_id,
          title: f.title.trim(),
          company_name: f.company_name.trim(),
          location: f.location.trim(),
          job_url: f.job_url.trim(),
          description: f.description.trim(),
          required_skills: split(f.required),
        })
        .select("id")
        .single();
      if (error || !job) throw new Error(error?.message ?? "Could not save the role");
      const { data: app, error: appErr } = await supabase
        .from("applications")
        .upsert({ user_id, job_id: job.id, status: "queued" }, { onConflict: "user_id,job_id" })
        .select("id")
        .single();
      if (appErr || !app) throw new Error(appErr?.message ?? "Could not create the application");
      await supabase.from("application_events").insert({
        user_id,
        application_id: app.id,
        job_id: job.id,
        event_type: "queued",
        title: "Application started from portal",
        source: "portal",
      });
      setBusy("Writing your resume and cover letter from your Career Vault…");
      const r = await synth({ data: { jobId: job.id } });
      if (!r.ok) toast.error(`Role saved, but materials could not be generated: ${r.error}`);
      else toast.success("Resume and cover letter ready to review");
      invalidate("applications");
      navigate({ to: "/applications/$applicationId", params: { applicationId: app.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New application"
        sub="Type the job details. Nexus writes a resume and cover letter from your verified Career Vault, then tracks it on your board. You submit on the employer's site."
      />
      <form onSubmit={submit} className="grid gap-4 rounded-xl border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            Job title *<Input value={f.title} onChange={set("title")} />
          </label>
          <label className="grid gap-1.5 text-sm">
            Company *<Input value={f.company_name} onChange={set("company_name")} />
          </label>
          <label className="grid gap-1.5 text-sm">
            Location
            <Input value={f.location} onChange={set("location")} />
          </label>
          <label className="grid gap-1.5 text-sm">
            Official posting link
            <Input type="url" value={f.job_url} onChange={set("job_url")} placeholder="https://" />
          </label>
        </div>
        <label className="grid gap-1.5 text-sm">
          Key skills (comma separated)
          <Input value={f.required} onChange={set("required")} />
        </label>
        <label className="grid gap-1.5 text-sm">
          Job description *
          <Textarea
            rows={10}
            value={f.description}
            onChange={set("description")}
            placeholder="Paste the full job description"
          />
        </label>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {busy ?? "Only facts from your Career Vault are used."}
          </p>
          <Button type="submit" disabled={!!busy}>
            <Send className="h-4 w-4" />
            Create application
          </Button>
        </div>
      </form>
    </div>
  );
}
