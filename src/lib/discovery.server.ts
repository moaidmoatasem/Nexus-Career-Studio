import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AtsPostingGone, fetchAtsFacts, parseAtsPosting, type AtsFacts } from "./atsApis.server";
import { assertNotJobBoard, canonicalBoardLink, hostIs, isJobBoardUrl } from "./jobSources";

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
  /** Null when the text did not come from the employer's own page (pasted text). */
  verified_at: string | null;
  /** "unknown" for leads read from an alert email, which are not verified against a posting. */
  lifecycle_status: "active" | "unknown";
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
async function firecrawl(userId: string, path: "/v2/search" | "/v2/scrape", body: unknown) {
  await (await import("./usage.server")).consumeUsage(userId, "firecrawl");
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
  // A board posting has one stable link, however many tracking parameters an email adds.
  if (isJobBoardUrl(raw)) {
    const board = canonicalBoardLink(raw);
    if (board) return board;
  }
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

export async function searchPublicJobs(userId: string, query: string, limit = 6) {
  // Web search may surface board pages; they are dropped, never fetched.
  const response = await firecrawl(userId, "/v2/search", { query, limit });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`Job discovery failed [${response.status}]: ${text.slice(0, 300)}`);
  const raw = JSON.parse(text) as { data?: { web?: Array<{ url?: string }> } };
  return (raw.data?.web ?? []).flatMap((item) =>
    item.url && !isJobBoardUrl(item.url) ? [item.url] : [],
  );
}

/**
 * Greenhouse, Lever and Ashby postings are read from the employer's public JSON API, which is
 * cheaper and steadier than reading the page. The title, employer, location and description come
 * from the API as published; only skills, years and domain are read from that text by the model.
 * Returns null for any other page, or when the API can't be used, so the page is read instead.
 */
async function extractFromAtsApi(
  userId: string,
  canonicalUrl: string,
): Promise<ExtractedJob | null> {
  const posting = parseAtsPosting(canonicalUrl);
  if (!posting) return null;
  let facts: AtsFacts;
  try {
    facts = await fetchAtsFacts(posting);
  } catch (error) {
    if (error instanceof AtsPostingGone)
      throw new Error("This posting is no longer open: the employer's job board does not list it.");
    return null;
  }
  if (facts.title.length < 2 || facts.description.length < 40) return null;
  const { readJobFacts } = await import("./jobText.server");
  const read = await readJobFacts(
    userId,
    `Title: ${facts.title}\nEmployer: ${facts.company}\nLocation: ${facts.location}\n\n${facts.description}`.slice(
      0,
      20_000,
    ),
  );
  const provider = sourceProvider(canonicalUrl);
  const verifiedAt = new Date().toISOString();
  return {
    title: facts.title,
    company_name: facts.company,
    location: facts.location,
    country: read.country.trim(),
    is_remote: facts.isRemote ?? read.is_remote,
    salary_range: facts.salary ?? (read.salary_range?.trim() || null),
    description: facts.description.slice(0, 20_000),
    required_skills: read.required_skills.map((x) => x.trim()).filter(Boolean),
    preferred_skills: read.preferred_skills.map((x) => x.trim()).filter(Boolean),
    min_years_exp: Math.max(0, Math.round(read.min_years_exp)),
    domain: read.domain.trim(),
    job_url: canonicalUrl,
    canonical_url: canonicalUrl,
    source: provider,
    source_provider: provider,
    source_record_id: posting.id,
    verified_at: verifiedAt,
    lifecycle_status: "active",
    extraction_provenance: {
      method: "ats_public_api",
      source_url: canonicalUrl,
      api_url: facts.apiUrl,
      company_source: facts.companySource,
      verified_at: verifiedAt,
    },
  };
}

export async function extractPublicJob(userId: string, rawUrl: string): Promise<ExtractedJob> {
  assertNotJobBoard(rawUrl);
  const canonicalUrl = canonicalizeJobUrl(rawUrl);
  const fromApi = await extractFromAtsApi(userId, canonicalUrl);
  if (fromApi) return fromApi;
  const response = await firecrawl(userId, "/v2/scrape", {
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
export function fnv1a(input: string) {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(input))
    h = BigInt.asUintN(64, (h ^ BigInt(b)) * 0x100000001b3n);
  return h.toString(16).padStart(16, "0");
}
