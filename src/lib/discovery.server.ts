import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { hostIs } from "./mailMatch";

const extractedJobSchema = z.object({
  title: z.string().trim().min(2),
  company_name: z.string().trim().min(2),
  location: z.string().trim(),
  country: z.string().trim(),
  is_remote: z.boolean(),
  salary_range: z.string().nullable(),
  description: z.string().trim().min(40),
  required_skills: z.array(z.string()),
  preferred_skills: z.array(z.string()),
  min_years_exp: z.number().int().nonnegative(),
  domain: z.string(),
  external_reference: z.string().nullable().optional(),
});

export type ExtractedJob = z.infer<typeof extractedJobSchema> & {
  job_url: string;
  canonical_url: string;
  source: string;
  source_provider: string;
  source_record_id: string;
  verified_at: string;
  lifecycle_status: "active";
  extraction_provenance: Record<string, string>;
};

const extractionSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    company_name: { type: "string" },
    location: { type: "string" },
    country: { type: "string" },
    is_remote: { type: "boolean" },
    salary_range: { type: ["string", "null"] },
    description: { type: "string" },
    required_skills: { type: "array", items: { type: "string" } },
    preferred_skills: { type: "array", items: { type: "string" } },
    min_years_exp: { type: "integer" },
    domain: { type: "string" },
    external_reference: { type: ["string", "null"] },
  },
  required: [
    "title",
    "company_name",
    "location",
    "country",
    "is_remote",
    "salary_range",
    "description",
    "required_skills",
    "preferred_skills",
    "min_years_exp",
    "domain",
    "external_reference",
  ],
  additionalProperties: false,
};

/**
 * Firecrawl's v2 API, hosted (api.firecrawl.dev, needs FIRECRAWL_API_KEY) or self-hosted
 * (set FIRECRAWL_API_URL; a key is optional there).
 */
function firecrawl(path: "/v2/search" | "/v2/scrape", body: unknown) {
  const base = (process.env["FIRECRAWL_API_URL"]?.trim() || "https://api.firecrawl.dev").replace(
    /\/+$/,
    "",
  );
  const key = process.env["FIRECRAWL_API_KEY"]?.trim();
  if (!key && !process.env["FIRECRAWL_API_URL"])
    throw new Error(
      "Job-page reading is not set up: set FIRECRAWL_API_KEY (or FIRECRAWL_API_URL for a self-hosted Firecrawl).",
    );
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
}

export function canonicalizeJobUrl(raw: string) {
  const url = new URL(raw);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || ["trk", "trackingId", "refId", "gh_src"].includes(key))
      url.searchParams.delete(key);
  }
  if ([...url.searchParams.keys()].length === 0) url.search = "";
  return url.toString().replace(/\/$/, "");
}

export function sourceProvider(url: string) {
  const host = new URL(url).hostname;
  if (hostIs(host, "linkedin.com")) return "linkedin";
  if (hostIs(host, "indeed.com")) return "indeed";
  if (hostIs(host, "myworkdayjobs.com")) return "workday";
  if (hostIs(host, "greenhouse.io")) return "greenhouse";
  if (hostIs(host, "lever.co")) return "lever";
  if (hostIs(host, "ashbyhq.com")) return "ashby";
  return "career_page";
}

type Db = SupabaseClient<Database>;

/**
 * Canonical URLs (from `urls`) that are already in the catalog or this user's own roles.
 * Checked before extraction so known postings cost nothing to re-discover.
 */
export async function knownJobUrls(db: Db, userId: string, urls: string[]): Promise<Set<string>> {
  if (!urls.length) return new Set();
  const { data, error } = await db
    .from("jobs")
    .select("canonical_url")
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .in("canonical_url", urls);
  if (error) throw new Error(`Could not check existing roles: ${error.message}`);
  return new Set((data ?? []).flatMap((row) => (row.canonical_url ? [row.canonical_url] : [])));
}

export type SaveJobResult =
  | { status: "added"; jobId: string }
  | { status: "duplicate" }
  | { status: "failed"; error: string };

/**
 * Saves an extracted posting as one of the user's roles. A plain insert is used on purpose:
 * PostgREST upserts cannot target the partial unique index on (user_id, canonical_url), so an
 * existing posting surfaces as a unique-violation (23505) and is reported as a duplicate.
 */
export async function saveJobForUser(
  db: Db,
  userId: string,
  job: ExtractedJob,
  source: string,
): Promise<SaveJobResult> {
  const { data, error } = await db
    .from("jobs")
    .insert({ ...job, external_reference: job.external_reference ?? null, user_id: userId, source })
    .select("id")
    .single();
  if (error)
    return error.code === "23505"
      ? { status: "duplicate" }
      : { status: "failed", error: error.message };
  return { status: "added", jobId: data.id };
}

export async function searchPublicJobs(query: string, limit = 6) {
  const response = await firecrawl("/v2/search", { query, limit });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`Job discovery failed [${response.status}]: ${text.slice(0, 300)}`);
  const raw = JSON.parse(text) as { data?: { web?: Array<{ url?: string }> } };
  return (raw.data?.web ?? []).flatMap((item) => (item.url ? [item.url] : []));
}

export async function extractPublicJob(rawUrl: string): Promise<ExtractedJob> {
  const canonicalUrl = canonicalizeJobUrl(rawUrl);
  const response = await firecrawl("/v2/scrape", {
    url: canonicalUrl,
    onlyMainContent: true,
    formats: [
      {
        type: "json",
        schema: extractionSchema,
        prompt:
          "Extract only facts explicitly stated in this current job posting. Use empty values when absent. Never infer employer, salary, skills, experience, or location.",
      },
    ],
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`Job page could not be read [${response.status}]: ${text.slice(0, 300)}`);
  const raw = JSON.parse(text) as { json?: unknown; data?: { json?: unknown } };
  const parsed = extractedJobSchema.parse(raw.json ?? raw.data?.json);
  const provider = sourceProvider(canonicalUrl);
  const pathId = new URL(canonicalUrl).pathname.split("/").filter(Boolean).at(-1) ?? "";
  return {
    ...parsed,
    job_url: canonicalUrl,
    canonical_url: canonicalUrl,
    source: provider,
    source_provider: provider,
    source_record_id: parsed.external_reference || pathId || fnv1a(canonicalUrl),
    verified_at: new Date().toISOString(),
    lifecycle_status: "active",
    extraction_provenance: {
      method: "firecrawl_json_schema",
      source_url: canonicalUrl,
      verified_at: new Date().toISOString(),
    },
  };
}

/** Stable non-cryptographic id (FNV-1a 64-bit), portable across runtimes. */
function fnv1a(input: string) {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(input))
    h = BigInt.asUintN(64, (h ^ BigInt(b)) * 0x100000001b3n);
  return h.toString(16).padStart(16, "0");
}
