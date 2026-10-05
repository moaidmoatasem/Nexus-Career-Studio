import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateStructured } from "./ai.server";
import { auditFreeText, evidenceNumbers, itemEvidence, validateBulletProvenance } from "./provenance";
import { scoreRole } from "./scoring";
import { matchApplication } from "./mailMatch";
import { isSubmittedStage, nextStageFromEmail, stageForEmail } from "./stages";
import { classifyRecruitmentEmail, type EmailClassification } from "./email-classifier.server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : "Something went wrong." });

/* 1. Vault extractor */
const vaultSchema = z.object({
  items: z.array(
    z.object({
      category: z.enum(["experience", "achievement", "skill", "education", "project", "certification"]),
      title: z.string(),
      organization: z.string(),
      start_date: z.string(),
      end_date: z.string(),
      is_current: z.boolean(),
      description: z.string(),
      metrics: z.array(z.string()),
      skills: z.array(z.string()),
    }),
  ),
});

export const extractVault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { text: string }) => z.object({ text: z.string().min(20).max(30000) }).parse(d))
  .handler(async ({ data, context }): Promise<Result<{ count: number }>> => {
    try {
      const out = await generateStructured({
        instructions:
          "You are a Master Career Vault extractor. Convert resume text into structured items. Copy quantitative metrics VERBATIM from the source into `metrics`; never invent numbers, tools or skills. Use empty strings when a field is absent. Preserve Arabic text in NFC form.",
        prompt: `Resume text:\n"""\n${data.text.normalize("NFC")}\n"""`,
        schema: vaultSchema,
      });
      if (!out.items.length) return { ok: true, data: { count: 0 } };
      const rows = out.items.map((i) => ({ ...i, user_id: context.userId, is_verified: false }));
      const { error } = await context.supabase.from("vault_items").insert(rows);
      if (error) throw new Error(error.message);
      return { ok: true, data: { count: rows.length } };
    } catch (e) {
      return fail(e);
    }
  });

/* 2. Reference-bound tailoring + outreach */
const packSchema = z.object({
  bullets: z.array(
    z.object({
      vault_item_id: z.string(),
      tailored_text: z.string(),
      verified_metrics: z.array(z.string()),
      aligned_skills: z.array(z.string()),
    }),
  ),
  cover_letter: z.string(),
  recruiter_outreach: z.string(),
});

export const synthesizePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<{ applicationId: string }>> => {
    try {
      const sb = context.supabase;
      const [{ data: job }, { data: vault }, { data: profile }] = await Promise.all([
        sb.from("jobs").select("*").eq("id", data.jobId).maybeSingle(),
        // Only evidence the candidate has verified may be used in tailored materials.
        sb.from("vault_items").select("*").eq("user_id", context.userId).eq("is_verified", true),
        sb.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      ]);
      if (!job) throw new Error("Job not found.");
      if (!vault?.length) throw new Error("Verify at least one Career Vault item first — only verified evidence is used.");
      const { data: sponsor } = await sb.rpc("match_sponsor_company_v3", { search_term: job.company_name });
      const score = scoreRole({ vault, profile, job, sponsorSimilarity: sponsor?.[0]?.similarity ?? null });
      const vaultForPrompt = vault.map((v) => ({ id: v.id, title: v.title, organization: v.organization, start_date: v.start_date, end_date: v.end_date, description: v.description, metrics: v.metrics, skills: v.skills }));
      const out = await generateStructured({
        instructions:
          "You are an ATS resume optimizer enforcing reference binding. Every bullet MUST cite an existing vault_item_id from the provided vault. `verified_metrics` may only contain strings copied verbatim from that item's metrics. Never invent metrics, employers, tools or skills. Every number you write — in bullets, the cover letter and the outreach note — must appear in the vault data, the candidate's stated years of experience, or the job posting; never estimate or round. Write 4–6 bullets, a 3-paragraph cover letter, and a recruiter outreach note of at most 75 words.",
        prompt: `Candidate: ${profile?.full_name || "Candidate"}\nYears of experience: ${profile?.years_experience ?? "not stated"}\nJob: ${job.title} at ${job.company_name}\nRequired: ${job.required_skills.join(", ")}\nPreferred: ${job.preferred_skills.join(", ")}\nDescription: ${job.description}\n\nCareer Vault (JSON):\n${JSON.stringify(vaultForPrompt)}`,
        schema: packSchema,
      });
      const audit = validateBulletProvenance(out.bullets, vault);
      // Free text may reuse numbers from verified evidence, the profile, or the posting itself.
      const allowed = evidenceNumbers([
        ...vault.flatMap(itemEvidence),
        profile ? String(profile.years_experience) : null,
        job.title, job.description, job.salary_range, job.location, String(job.min_years_exp),
        ...job.required_skills, ...job.preferred_skills,
      ]);
      const letter = auditFreeText(out.cover_letter, allowed, "cover_letter");
      const note = auditFreeText(out.recruiter_outreach, allowed, "recruiter_outreach");
      const rejected = [...audit.violations, ...letter.violations, ...note.violations];
      const pack = {
        bullets: audit.validBullets,
        rejected,
        coverLetter: letter.text,
        recruiterOutreach: note.text,
        scoreBreakdown: score,
        provenanceValid: rejected.length === 0,
        generatedAt: new Date().toISOString(),
      };
      const { data: app, error } = await sb
        .from("applications")
        .upsert(
          { user_id: context.userId, job_id: job.id, status: "tailored", fit_score: score.totalScore, tailored_pack: JSON.parse(JSON.stringify(pack)), updated_at: new Date().toISOString() },
          { onConflict: "user_id,job_id" },
        )
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await sb.from("application_events").insert({ user_id: context.userId, application_id: app.id, job_id: job.id, event_type: "tailored", title: "Application pack prepared", detail: `${job.title} at ${job.company_name}${rejected.length ? ` · ${rejected.length} unsupported line(s) removed` : ""}`, source: "ai" });
      return { ok: true, data: { applicationId: app.id } };
    } catch (e) {
      return fail(e);
    }
  });

/* 3. ATS email classifier */
export type { EmailClassification } from "./email-classifier.server";

export const classifyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subject: string; body: string; sender: string }) =>
    z.object({ subject: z.string().max(500), body: z.string().min(5).max(20000), sender: z.string().max(300) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Result<EmailClassification & { movedApplicationId: string | null; matchNote: string }>> => {
    try {
      const out = await classifyRecruitmentEmail(data);
      // Same rules as Gmail sync: employer AND role must both be named, and the classifier must be confident.
      const { data: apps, error } = await context.supabase.from("applications").select("id,job_id,status,applied_at,jobs(company_name,title)").eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      const match = matchApplication(apps ?? [], { companyName: out.company_name, subject: data.subject, sender: data.sender, body: data.body });
      const app = match.app && out.confidence >= 0.75 ? match.app : null;
      if (!app) {
        const why = match.app ? `the classifier is only ${Math.round(out.confidence * 100)}% sure` : match.reason.charAt(0).toLowerCase() + match.reason.slice(1);
        return { ok: true, data: { ...out, movedApplicationId: null, matchNote: `Nothing was moved: ${why}. Open the application and update it yourself if this email belongs to it.` } };
      }
      const next = nextStageFromEmail(app.status, stageForEmail(out.status));
      const now = new Date().toISOString();
      const appliedAt = next && isSubmittedStage(next) && !app.applied_at ? now : null;
      const { error: updateError } = await context.supabase
        .from("applications")
        .update({ ...(next ? { status: next } : {}), ...(appliedAt ? { applied_at: appliedAt } : {}), last_email_status: out.status, next_action: out.action_summary, updated_at: now })
        .eq("id", app.id);
      if (updateError) throw new Error(updateError.message);
      await context.supabase.from("application_events").insert({ user_id: context.userId, application_id: app.id, job_id: app.job_id, event_type: "email_classified", title: "Recruiter email classified", detail: `${out.company_name}: ${out.action_summary}${next ? ` · moved to ${next}` : ""}`, source: "email" });
      const title = app.jobs ? `${app.jobs.title} at ${app.jobs.company_name}` : "the matching application";
      return { ok: true, data: { ...out, movedApplicationId: app.id, matchNote: next ? `Moved ${title} to ${next}.` : `Updated the next step for ${title}; its stage stays at ${app.status}.` } };
    } catch (e) {
      return fail(e);
    }
  });
