import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type IntakeResult = { ok: true; data: { jobId: string; duplicate: boolean } } | { ok: false; error: string };

const inputSchema = z.object({ url: z.string().url().max(2000) });

export const intakeJobUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<IntakeResult> => {
    const { canonicalizeJobUrl, extractPublicJob, sourceProvider } = await import("./discovery.server");
    const canonicalUrl = canonicalizeJobUrl(data.url);
    const source = sourceProvider(canonicalUrl);
    const { data: existing } = await context.supabase.from("jobs").select("*").eq("user_id", context.userId).eq("canonical_url", canonicalUrl).maybeSingle();
    if (existing) return { ok: true, data: { jobId: existing.id, duplicate: true } };

    const { data: run, error: runError } = await context.supabase.from("discovery_runs").insert({ user_id: context.userId, source, status: "running" }).select("id").single();
    if (runError) return { ok: false, error: runError.message };

    try {
      const extracted = await extractPublicJob(canonicalUrl);
      const normalized = { ...extracted, external_reference: extracted.external_reference ?? null };
      const { data: job, error } = await context.supabase.from("jobs").insert({ ...normalized, user_id: context.userId, source }).select("id").single();
      if (error) throw new Error(error.message);
      await context.supabase.from("discovery_runs").update({ status: "completed", jobs_found: 1, jobs_added: 1, completed_at: new Date().toISOString() }).eq("id", run.id);
      return { ok: true, data: { jobId: job.id, duplicate: false } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "The job page could not be imported.";
      await context.supabase.from("discovery_runs").update({ status: "failed", error_summary: message, completed_at: new Date().toISOString() }).eq("id", run.id);
      return { ok: false, error: message };
    }
  });

export const refreshMyDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { extractPublicJob, searchPublicJobs } = await import("./discovery.server");
    const { data: profile } = await context.supabase.from("profiles").select("target_titles,target_locations,excluded_employers,excluded_keywords").eq("id", context.userId).single();
    const title = profile?.target_titles[0];
    const location = profile?.target_locations[0];
    if (!title || !location) return { ok: false as const, error: "Add a target title and location in Career Vault first." };
    const query = `${title} ${location} (site:jobs.lever.co OR site:boards.greenhouse.io OR site:jobs.ashbyhq.com OR site:myworkdayjobs.com)`;
    const urls = await searchPublicJobs(query, 8);
    let added = 0;
    const errors: string[] = [];
    for (const url of urls.slice(0, 8)) {
      try {
        const extracted = await extractPublicJob(url);
        const blockedEmployer = profile.excluded_employers.some((item) => extracted.company_name.toLowerCase().includes(item.toLowerCase()));
        const text = `${extracted.title} ${extracted.description}`.toLowerCase();
        const blockedKeyword = profile.excluded_keywords.some((item) => text.includes(item.toLowerCase()));
        if (blockedEmployer || blockedKeyword) continue;
        const { data: inserted, error } = await context.supabase.from("jobs").upsert({ ...extracted, external_reference: extracted.external_reference ?? null, user_id: context.userId }, { onConflict: "user_id,canonical_url", ignoreDuplicates: true }).select("id").maybeSingle();
        if (!error && inserted) added += 1;
      } catch (error) { errors.push(error instanceof Error ? error.message : "Unreadable posting"); }
    }
    await context.supabase.from("discovery_runs").insert({ user_id: context.userId, source: "career_pages", status: errors.length === urls.length ? "failed" : "completed", jobs_found: urls.length, jobs_added: added, error_summary: errors.length ? `${errors.length} posting(s) could not be verified.` : null, completed_at: new Date().toISOString() });
    await context.supabase.from("source_connections").upsert({ user_id: context.userId, source: "career_pages", enabled: true, status: errors.length === urls.length ? "needs_attention" : "ready", last_synced_at: new Date().toISOString(), last_error: errors.length === urls.length ? (errors[0] ?? "No posting could be verified.") : null }, { onConflict: "user_id,source" });
    return { ok: true as const, found: urls.length, added };
  });