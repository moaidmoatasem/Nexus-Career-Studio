import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type IntakeResult = { ok: true; data: { jobId: string; duplicate: boolean } } | { ok: false; error: string };

const inputSchema = z.object({ url: z.string().url().max(2000) });

export const intakeJobUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<IntakeResult> => {
    const { canonicalizeJobUrl, extractPublicJob, saveJobForUser, sourceProvider } = await import("./discovery.server");
    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalizeJobUrl(data.url);
      if (!/^https?:$/.test(new URL(canonicalUrl).protocol)) throw new Error("unsupported");
    } catch {
      return { ok: false, error: "Enter a complete public job URL starting with https://." };
    }
    const source = sourceProvider(canonicalUrl);
    // RLS returns the shared catalog plus this user's own roles, so a posting already in either is reused.
    const findExisting = async () =>
      (await context.supabase.from("jobs").select("id").eq("canonical_url", canonicalUrl).order("user_id", { nullsFirst: false }).limit(1).maybeSingle()).data;
    const existing = await findExisting();
    if (existing) return { ok: true, data: { jobId: existing.id, duplicate: true } };

    const { data: run, error: runError } = await context.supabase.from("discovery_runs").insert({ user_id: context.userId, source, status: "running" }).select("id").single();
    if (runError) return { ok: false, error: runError.message };

    try {
      const extracted = await extractPublicJob(canonicalUrl);
      const saved = await saveJobForUser(context.supabase, context.userId, extracted, source);
      if (saved.status === "failed") throw new Error(saved.error);
      const jobId = saved.status === "added" ? saved.jobId : (await findExisting())?.id;
      if (!jobId) throw new Error("The role was saved by another request but could not be found.");
      await context.supabase.from("discovery_runs").update({ status: "completed", jobs_found: 1, jobs_added: saved.status === "added" ? 1 : 0, completed_at: new Date().toISOString() }).eq("id", run.id);
      return { ok: true, data: { jobId, duplicate: saved.status === "duplicate" } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "The job page could not be imported.";
      await context.supabase.from("discovery_runs").update({ status: "failed", error_summary: message, completed_at: new Date().toISOString() }).eq("id", run.id);
      return { ok: false, error: message };
    }
  });

export const refreshMyDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { canonicalizeJobUrl, extractPublicJob, knownJobUrls, saveJobForUser, searchPublicJobs, sourceProvider } = await import("./discovery.server");
    const { data: profile } = await context.supabase.from("profiles").select("target_titles,target_locations,excluded_employers,excluded_keywords").eq("id", context.userId).single();
    const title = profile?.target_titles[0];
    const location = profile?.target_locations[0];
    if (!profile || !title || !location) return { ok: false as const, error: "Add a target title and location in Career Vault first." };
    const query = `${title} ${location} (site:jobs.lever.co OR site:boards.greenhouse.io OR site:jobs.ashbyhq.com OR site:myworkdayjobs.com)`;
    const found = await searchPublicJobs(query, 8);
    const urls = [...new Set(found.slice(0, 8).flatMap((url) => {
      try { return [canonicalizeJobUrl(url)]; } catch { return []; }
    }))];
    // Skip postings already in the catalog or this user's roles before paying for extraction.
    const known = await knownJobUrls(context.supabase, context.userId, urls);
    let added = 0;
    let duplicates = known.size;
    let excluded = 0;
    const errors: string[] = [];
    for (const url of urls.filter((u) => !known.has(u))) {
      try {
        const extracted = await extractPublicJob(url);
        const blockedEmployer = profile.excluded_employers.some((item) => item.trim() && extracted.company_name.toLowerCase().includes(item.trim().toLowerCase()));
        const text = `${extracted.title} ${extracted.description}`.toLowerCase();
        const blockedKeyword = profile.excluded_keywords.some((item) => item.trim() && text.includes(item.trim().toLowerCase()));
        if (blockedEmployer || blockedKeyword) { excluded += 1; continue; }
        const saved = await saveJobForUser(context.supabase, context.userId, extracted, sourceProvider(url));
        if (saved.status === "added") added += 1;
        else if (saved.status === "duplicate") duplicates += 1;
        else errors.push(`Could not save ${new URL(url).hostname}: ${saved.error}`);
      } catch (error) { errors.push(error instanceof Error ? error.message : "Unreadable posting"); }
    }
    const status = !errors.length ? "completed" : added || duplicates || excluded ? "partial" : "failed";
    await context.supabase.from("discovery_runs").insert({ user_id: context.userId, source: "career_pages", status, jobs_found: urls.length, jobs_added: added, error_summary: errors.length ? `${errors.length} posting(s) could not be verified or saved: ${errors[0] ?? ""}`.slice(0, 500) : null, completed_at: new Date().toISOString() });
    await context.supabase.from("source_connections").upsert({ user_id: context.userId, source: "career_pages", enabled: true, status: status === "failed" ? "needs_attention" : "ready", last_synced_at: new Date().toISOString(), last_error: status === "failed" ? (errors[0] ?? "No posting could be verified.") : null }, { onConflict: "user_id,source" });
    return { ok: true as const, found: urls.length, added, duplicates, excluded, failed: errors.length };
  });
