import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Copy, Download, FileCheck2, FileText, Mail, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  PROFILES,
  downloadPdf,
  downloadDocx,
  downloadProvenanceReport,
  downloadCoverLetter,
  toPlainText,
  type AtsProfile,
  type ResumeModel,
} from "@/lib/resumeExport";
import { useVault, useProfile, useApplications, type TailoredPack } from "@/lib/data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/resume")({
  validateSearch: z.object({ job: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "ATS Resume — Nexus Career Studio" },
      { name: "description", content: "Single-column ATS-safe resume." },
      { property: "og:title", content: "ATS Resume — Nexus Career Studio" },
      {
        property: "og:description",
        content: "Review and export a clean, evidence-grounded resume.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResumePage,
});

const nfc = (s: string) => s.normalize("NFC");

function ResumePage() {
  const { job } = Route.useSearch();
  const vault = useVault();
  const profile = useProfile();
  const apps = useApplications();
  const pack = apps.data?.find((a) => a.job_id === job)?.tailored_pack as unknown as
    TailoredPack | undefined;
  // The resume is built only from evidence the candidate has verified.
  const verified = (vault.data ?? []).filter((v) => v.is_verified);
  const unverifiedCount = (vault.data?.length ?? 0) - verified.length;
  const experiences = verified.filter(
    (v) => v.category === "experience" || v.category === "project",
  );
  const education = verified.filter(
    (v) => v.category === "education" || v.category === "certification",
  );
  const skills = Array.from(new Set(verified.flatMap((v) => v.skills)));
  const [busy, setBusy] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<AtsProfile>("generic");
  const bulletsFor = (id: string, fallback: string[]) => {
    const tailored = pack?.bullets
      .filter((b) => b.vault_item_id === id)
      .map((b) => b.tailored_text);
    return tailored?.length ? tailored : fallback;
  };
  const model: ResumeModel = {
    name: profile.data?.full_name || "Your Name",
    headline: profile.data?.headline ?? "",
    experience: experiences.map((v) => ({
      id: v.id,
      title: v.title,
      org: v.organization,
      dates: `${v.start_date}${v.start_date ? " – " : ""}${v.is_current ? "Present" : v.end_date}`,
      bullets: bulletsFor(v.id, v.metrics.length ? v.metrics : [v.description].filter(Boolean)),
    })),
    education: education.map(
      (v) =>
        `${v.title}${v.organization ? `, ${v.organization}` : ""}${v.end_date ? ` · ${v.end_date}` : ""}`,
    ),
    skills,
  };
  async function run(label: string, fn: () => Promise<void> | void) {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      toast.error(`${label} failed. Try Print instead.`);
    } finally {
      setBusy(null);
    }
  }
  const prof = PROFILES[profileId];

  return (
    <div>
      <div className="mb-6 rounded-md border bg-card p-4 print:hidden">
        <p className="text-sm text-muted-foreground">
          {pack
            ? "Using fact-checked tailored lines for the selected role."
            : "Showing your general resume. Prepare an application to tailor it."}
        </p>
        {unverifiedCount > 0 && (
          <p className="mt-1 text-xs text-warning">
            {unverifiedCount} unverified Career Vault item{unverifiedCount === 1 ? " is" : "s are"}{" "}
            left out. Verify {unverifiedCount === 1 ? "it" : "them"} in Career profile to include{" "}
            {unverifiedCount === 1 ? "it" : "them"}.
          </p>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(Object.keys(PROFILES) as AtsProfile[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setProfileId(id)}
              className={`rounded-md border p-3 text-left text-sm ${profileId === id ? "border-primary bg-primary/10" : "hover:bg-secondary"}`}
            >
              <span className="font-medium">{PROFILES[id].label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{PROFILES[id].hint}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => run("PDF", () => downloadPdf(model, profileId))} disabled={!!busy}>
            <Download className="h-4 w-4" />
            {busy === "PDF" ? "Building…" : "Download PDF"}
          </Button>
          <Button
            variant="outline"
            onClick={() => run("Word file", () => downloadDocx(model, profileId))}
            disabled={!!busy}
          >
            <FileText className="h-4 w-4" />
            {busy === "Word file" ? "Building…" : "Download Word"}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              run("Copy", async () => {
                await navigator.clipboard.writeText(toPlainText(model, profileId));
                toast.success("Plain text copied for portal text boxes");
              })
            }
            disabled={!!busy}
          >
            <Copy className="h-4 w-4" />
            Copy as text
          </Button>
          {pack?.coverLetter && (
            <Button
              variant="outline"
              onClick={() => downloadCoverLetter(model.name, pack.coverLetter)}
            >
              <Mail className="h-4 w-4" />
              Cover letter
            </Button>
          )}
          {pack && (
            <Button
              variant="outline"
              onClick={() => downloadProvenanceReport(model, pack, vault.data ?? [])}
            >
              <FileCheck2 className="h-4 w-4" />
              Fact-check report
            </Button>
          )}
          <Button variant="ghost" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
        <ul className="mt-3 list-disc ps-5 text-xs text-muted-foreground">
          {prof.checklist.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
      {/* Paper intentionally uses fixed print colors so the PDF is always black-on-white. */}
      <article
        dir="auto"
        className="ats-paper mx-auto max-w-[210mm] rounded-sm p-12 text-[11pt] leading-snug shadow-glow print:p-0 print:shadow-none"
      >
        <h1 className="text-2xl font-bold">{nfc(profile.data?.full_name || "Your Name")}</h1>
        {profile.data?.headline && <p>{nfc(profile.data.headline)}</p>}
        <h2 className="mt-6 border-b pb-1 text-sm font-bold uppercase">
          {prof.headings.experience}
        </h2>
        {experiences.map((v) => (
          <section key={v.id} className="mt-3">
            <p className="font-bold">
              {nfc(v.title)}
              {v.organization && `, ${nfc(v.organization)}`}
            </p>
            <p className="text-sm">
              {v.start_date}
              {v.start_date && " – "}
              {v.is_current ? "Present" : v.end_date}
            </p>
            <ul className="mt-1 list-disc ps-5">
              {bulletsFor(v.id, v.metrics.length ? v.metrics : [v.description].filter(Boolean)).map(
                (b, i) => (
                  <li key={i}>{nfc(b)}</li>
                ),
              )}
            </ul>
          </section>
        ))}
        {education.length > 0 && (
          <h2 className="mt-6 border-b pb-1 text-sm font-bold uppercase">
            {prof.headings.education}
          </h2>
        )}
        {education.map((v) => (
          <p key={v.id} className="mt-2">
            {nfc(v.title)}
            {v.organization && `, ${nfc(v.organization)}`} {v.end_date}
          </p>
        ))}
        {skills.length > 0 && (
          <>
            <h2 className="mt-6 border-b pb-1 text-sm font-bold uppercase">
              {prof.headings.skills}
            </h2>
            <p className="mt-2">{skills.join(", ")}</p>
          </>
        )}
      </article>
    </div>
  );
}
