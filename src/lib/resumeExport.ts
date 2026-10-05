// Browser-only resume export helpers. Heavy libraries are loaded on demand.
import type { TailoredPack } from "@/lib/data";

export type AtsProfile = "generic" | "workday" | "lever";

export const PROFILES: Record<AtsProfile, { label: string; hint: string; headings: { experience: string; education: string; skills: string }; dateStyle: "range" | "monthYear"; checklist: string[] }> = {
  generic: {
    label: "Generic ATS", hint: "Safest choice for unknown systems.",
    headings: { experience: "EXPERIENCE", education: "EDUCATION & CERTIFICATIONS", skills: "SKILLS" }, dateStyle: "range",
    checklist: ["Upload the PDF unless the portal asks for Word.", "Paste the plain text where a text box is offered.", "Check every auto-filled field against your resume."],
  },
  workday: {
    label: "Workday-compatible", hint: "Conservative layout with standard section names.",
    headings: { experience: "WORK EXPERIENCE", education: "EDUCATION", skills: "SKILLS" }, dateStyle: "monthYear",
    checklist: ["Workday often prefers Word (DOCX) for auto-fill — upload the DOCX.", "Each employer runs its own Workday: you may need a new account per company.", "Re-check job titles and dates Workday parsed into 'My Experience'.", "Answer work-authorisation and visa questions yourself — Nexus never fills these."],
  },
  lever: {
    label: "Lever-compatible", hint: "Compact, recruiter-readable output.",
    headings: { experience: "EXPERIENCE", education: "EDUCATION", skills: "SKILLS" }, dateStyle: "range",
    checklist: ["Upload the PDF in 'Resume/CV'.", "Paste your cover letter into 'Additional information' if there is no upload.", "Add your LinkedIn and portfolio links in the Links section."],
  },
};

export interface ResumeModel {
  name: string; headline: string;
  experience: { id: string; title: string; org: string; dates: string; bullets: string[] }[];
  education: string[]; skills: string[];
}

const nfc = (s: string) => (s || "").normalize("NFC");

export function fileBase(name: string) {
  return nfc(name || "resume").replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-|-$/g, "") || "resume";
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toPlainText(m: ResumeModel, p: AtsProfile) {
  const h = PROFILES[p].headings;
  const lines = [m.name, m.headline, "", h.experience];
  for (const e of m.experience) { lines.push(`${e.title}${e.org ? `, ${e.org}` : ""}`, e.dates, ...e.bullets.map((b) => `- ${b}`), ""); }
  if (m.education.length) lines.push(h.education, ...m.education, "");
  if (m.skills.length) lines.push(h.skills, m.skills.join(", "));
  return nfc(lines.filter((l, i) => l !== "" || lines[i - 1] !== "").join("\n"));
}

export async function downloadPdf(m: ResumeModel, p: AtsProfile) {
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]);
  pdfMake.addVirtualFileSystem(pdfFonts);
  const h = PROFILES[p].headings;
  const content: unknown[] = [{ text: nfc(m.name), style: "name" }];
  if (m.headline) content.push({ text: nfc(m.headline), style: "headline" });
  content.push({ text: h.experience, style: "section" });
  for (const e of m.experience) content.push(
    { text: nfc(`${e.title}${e.org ? `, ${e.org}` : ""}`), style: "role" },
    { text: nfc(e.dates), style: "date" },
    { ul: e.bullets.map(nfc), margin: [12, 2, 0, 7] },
  );
  if (m.education.length) content.push({ text: h.education, style: "section" }, ...m.education.map((t) => ({ text: nfc(t), margin: [0, 2, 0, 4] })));
  if (m.skills.length) content.push({ text: h.skills, style: "section" }, { text: nfc(m.skills.join(", ")) });
  const compact = p === "lever";
  const def = { pageSize: "A4", pageMargins: compact ? [36, 36, 36, 36] : [42, 42, 42, 42], info: { title: `${m.name} resume` }, defaultStyle: { font: "Roboto", fontSize: compact ? 9.5 : 10, lineHeight: 1.25 }, styles: { name: { fontSize: 20, bold: true }, headline: { fontSize: 11, margin: [0, 2, 0, 8] }, section: { fontSize: 10, bold: true, margin: [0, 12, 0, 4] }, role: { bold: true, margin: [0, 4, 0, 0] }, date: { fontSize: 9 } }, content };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdfMake.createPdf(def as any).getBlob();
  save(blob, `${fileBase(m.name)}-${p}-resume.pdf`);
}

export async function downloadDocx(m: ResumeModel, p: AtsProfile) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const h = PROFILES[p].headings;
  const heading = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 }, children: [new TextRun({ text: t, bold: true })] });
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: nfc(m.name), bold: true, size: 40 })] }),
    ...(m.headline ? [new Paragraph({ children: [new TextRun(nfc(m.headline))] })] : []),
    heading(h.experience),
    ...m.experience.flatMap((e) => [
      new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: nfc(`${e.title}${e.org ? `, ${e.org}` : ""}`), bold: true })] }),
      new Paragraph({ children: [new TextRun({ text: nfc(e.dates), size: 18 })] }),
      ...e.bullets.map((b) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun(nfc(b))] })),
    ]),
    ...(m.education.length ? [heading(h.education), ...m.education.map((t) => new Paragraph({ children: [new TextRun(nfc(t))] }))] : []),
    ...(m.skills.length ? [heading(h.skills), new Paragraph({ children: [new TextRun(nfc(m.skills.join(", ")))] })] : []),
  ];
  const doc = new Document({ creator: "Nexus Career Studio", title: `${m.name} resume`, styles: { default: { document: { run: { font: "Calibri", size: 21 } } } }, sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 850, right: 850 } } }, children }] });
  save(await Packer.toBlob(doc), `${fileBase(m.name)}-${p}-resume.docx`);
}

export function downloadProvenanceReport(m: ResumeModel, pack: TailoredPack, vault: { id: string; title: string; organization: string; metrics: string[] }[]) {
  const byId = new Map(vault.map((v) => [v.id, v]));
  const lines = [`# Fact-check report — ${nfc(m.name)}`, `Generated ${new Date(pack.generatedAt).toLocaleString()}`, `Status: ${pack.provenanceValid ? "every line traced to your Career Vault" : "some lines were removed because they could not be verified"}`, ""];
  pack.bullets.forEach((b, i) => {
    const src = byId.get(b.vault_item_id);
    lines.push(`## Line ${i + 1}`, `"${nfc(b.tailored_text)}"`, `Source: ${src ? `${src.title}${src.organization ? `, ${src.organization}` : ""}` : "unknown"}`, `Numbers used: ${b.verified_metrics.join("; ") || "none"}`, `Skills matched: ${b.aligned_skills.join(", ") || "none"}`, "");
  });
  if (pack.rejected.length) { lines.push("## Removed (could not be verified)"); pack.rejected.forEach((r) => lines.push(`- Line ${r.bulletIndex + 1}: ${r.detail}`)); }
  save(new Blob([lines.join("\n")], { type: "text/markdown" }), `${fileBase(m.name)}-fact-check.md`);
}

export function downloadCoverLetter(name: string, text: string) {
  save(new Blob([nfc(text)], { type: "text/plain" }), `${fileBase(name)}-cover-letter.txt`);
}
