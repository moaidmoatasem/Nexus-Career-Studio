import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount, exportMyData } from "@/lib/account.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Nexus Career Studio" },
      { name: "description", content: "Download or delete your Nexus data." },
      { property: "og:title", content: "Settings — Nexus Career Studio" },
      {
        property: "og:description",
        content: "You own your career data: export or delete it at any time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const exportFn = useServerFn(exportMyData);
  const deleteFn = useServerFn(deleteMyAccount);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");

  async function download() {
    setBusy(true);
    try {
      const json = await exportFn();
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexus-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Your data was downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const result = await deleteFn({ data: { confirm: "DELETE" } });
      await supabase.auth.signOut();
      toast.success("Your account and data were deleted");
      for (const note of result.notes) toast.warning(note, { duration: 15000 });
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deletion failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" sub="Your career data belongs to you." />
      <section className="rounded-md border bg-card p-5">
        <h2 className="font-display font-semibold">Download your data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One file with your profile, Career Vault, applications, history, processed email records
          and agent activity.
        </p>
        <Button className="mt-4" onClick={download} disabled={busy}>
          <Download />
          Download my data
        </Button>
      </section>
      <section className="mt-6 rounded-md border border-destructive/40 bg-card p-5">
        <h2 className="font-display font-semibold">Delete account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Disconnects Gmail and permanently removes your account and everything in it. This can't be
          undone.
        </p>
        <label className="mt-4 grid gap-1.5 text-sm">
          Type DELETE to confirm
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <Button
          className="mt-3"
          variant="destructive"
          onClick={remove}
          disabled={busy || confirm !== "DELETE"}
        >
          <Trash2 />
          Delete my account
        </Button>
      </section>
    </div>
  );
}
