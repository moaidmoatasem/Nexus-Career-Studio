import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateStructured } from "./ai.server";
import { validateBulletProvenance } from "./provenance";
import { calculateFitScore } from "./scoring";
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
        sb.from("vault_items").select("*").eq("user_id", context.userId),
        sb.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      ]);
      if (!job) throw new Error("Job not found.");
      if (!vault?.length) throw new Error("Add items to your Career Vault first.");
      const { data: sponsor } = await sb.rpc("match_sponsor_company_v3", { search_term: job.company_name });
      const score = calculateFitScore(
        {
          skills: vault.flatMap((v) => v.skills),
          years: profile?.years_experience ?? 0,
          domains: profile?.target_domains ?? [],
          requiresVisa: profile?.requires_visa ?? false,
        },
        {
          requiredSkills: job.required_skills,
          preferredSkills: job.preferred_skills,
          minYearsExp: job.min_years_exp,
          domain: job.domain,
          sponsorVerified: (sponsor?.length ?? 0) > 0,
        },
      );
      const vaultForPrompt = vault.map((v) => ({ id: v.id, title: v.title, organization: v.organization, description: v.description, metrics: v.metrics, skills: v.skills }));
      const out = await generateStructured({
        instructions:
          "You are an ATS resume optimizer enforcing reference binding. Every bullet MUST cite an existing vault_item_id from the provided vault. `verified_metrics` may only contain strings copied verbatim from that item's metrics. Never invent metrics, employers, tools or skills. Write 4–6 bullets, a 3-paragraph cover letter, and a recruiter outreach note of at most 75 words.",
        prompt: `Candidate: ${profile?.full_name || "Candidate"}\nJob: ${job.title} at ${job.company_name}\nRequired: ${job.required_skills.join(", ")}\nPreferred: ${job.preferred_skills.join(", ")}\nDescription: ${job.description}\n\nCareer Vault (JSON):\n${JSON.stringify(vaultForPrompt)}`,
        schema: packSchema,
      });
      const audit = validateBulletProvenance(out.bullets, vault);
      const pack = {
        bullets: audit.validBullets,
        rejected: audit.violations,
        coverLetter: out.cover_letter,
        recruiterOutreach: out.recruiter_outreach,
        scoreBreakdown: score,
        provenanceValid: audit.isValid,
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
      await sb.from("application_events").insert({ user_id: context.userId, application_id: app.id, job_id: job.id, event_type: "tailored", title: "Application pack prepared", detail: `${job.title} at ${job.company_name}`, source: "ai" });
      return { ok: true, data: { applicationId: app.id } };
    } catch (e) {
      return fail(e);
    }
  });

/* 3. ATS email classifier */
export type { EmailClassification } from "./email-classifier.server";

const STATUS_MAP: Record<string, string | null> = {
  applied_ack: "applied",
  screening: "screening",
  interview_invite: "interviewing",
  offer: "offered",
  rejection: "rejected",
  action_required: null,
  informational: null,
};

export const classifyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subject: string; body: string; sender: string }) =>
    z.object({ subject: z.string().max(500), body: z.string().min(5).max(20000), sender: z.string().max(300) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Result<EmailClassification & { movedApplicationId: string | null }>> => {
    try {
      const out = await classifyRecruitmentEmail(data);
      let moved: string | null = null;
      const next = STATUS_MAP[out.status];
      if (out.company_name) {
        const { data: apps } = await context.supabase
          .from("applications")
          .select("id, jobs!inner(company_name)")
          .eq("user_id", context.userId)
          .ilike("jobs.company_name", `%${out.company_name.split(" ")[0]}%`)
          .limit(1);
        const app = apps?.[0];
        if (app) {
          await context.supabase
            .from("applications")
            .update({ ...(next ? { status: next } : {}), last_email_status: out.status, next_action: out.action_summary, updated_at: new Date().toISOString() })
            .eq("id", app.id);
          await context.supabase.from("application_events").insert({ user_id: context.userId, application_id: app.id, event_type: "email_classified", title: "Recruiter email classified", detail: `${out.company_name}: ${out.action_summary}`, source: "email" });
          moved = app.id;
        }
      }
      return { ok: true, data: { ...out, movedApplicationId: moved } };
    } catch (e) {
      return fail(e);
    }
  });
