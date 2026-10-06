// Public job-board JSON APIs of Greenhouse, Lever and Ashby. They are the employers' own
// published feeds (no scraping, no login), cheaper and steadier than reading the page.
import { z } from "zod/v4";

export type AtsPosting = {
  provider: "greenhouse" | "lever" | "ashby";
  board: string;
  id: string;
  /** Lever and Greenhouse run separate EU hosts. */
  eu: boolean;
};

export type AtsFacts = {
  title: string;
  company: string;
  /** Where the company name came from: the API, or the employer's board name in the URL. */
  companySource: "api" | "board_name";
  location: string;
  isRemote: boolean | null;
  salary: string | null;
  description: string;
  postingUrl: string;
  apiUrl: string;
};

/** Raised when the employer's board no longer lists the posting. */
export class AtsPostingGone extends Error {}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const BOARD = /^[A-Za-z0-9._-]{1,100}$/;

/** Recognises the public posting URL of a Greenhouse, Lever or Ashby job; anything else is null. */
export function parseAtsPosting(raw: string): AtsPosting | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  const ok = (board: string | undefined, id: string | undefined) =>
    board !== undefined && id !== undefined && BOARD.test(board) && ID.test(id);

  if (
    ["boards.greenhouse.io", "job-boards.greenhouse.io", "job-boards.eu.greenhouse.io"].includes(
      host,
    )
  ) {
    const eu = host.includes(".eu.");
    if (parts[0] === "embed" && parts[1] === "job_app") {
      const board = url.searchParams.get("for") ?? undefined;
      const id = url.searchParams.get("token") ?? undefined;
      return ok(board, id) ? { provider: "greenhouse", board: board!, id: id!, eu } : null;
    }
    return parts[1] === "jobs" && ok(parts[0], parts[2])
      ? { provider: "greenhouse", board: parts[0]!, id: parts[2]!, eu }
      : null;
  }
  if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") {
    return ok(parts[0], parts[1])
      ? { provider: "lever", board: parts[0]!, id: parts[1]!, eu: host.includes(".eu.") }
      : null;
  }
  if (host === "jobs.ashbyhq.com") {
    return ok(parts[0], parts[1])
      ? { provider: "ashby", board: parts[0]!, id: parts[1]!, eu: false }
      : null;
  }
  return null;
}

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  pound: "£",
  euro: "€",
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : whole;
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/** Plain text from a posting's HTML. Greenhouse sends its HTML entity-escaped, so that is undone first. */
export function htmlToText(html: string): string {
  const unescaped = /&lt;\s*\/?\s*[a-z]/i.test(html) ? decodeEntities(html) : html;
  const text = unescaped
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|ul|ol|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "acme-robotics" -> "Acme Robotics": the employer's own board name, used only when the API names no company. */
export function companyFromBoard(board: string): string {
  return board
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const str = z.string().nullish();

const greenhouseSchema = z.object({
  title: z.string(),
  company_name: str,
  location: z.object({ name: str }).nullish(),
  content: str,
  absolute_url: str,
});

const leverSchema = z.object({
  text: z.string(),
  categories: z.object({ location: str }).nullish(),
  workplaceType: str,
  descriptionPlain: str,
  description: str,
  additional: str,
  additionalPlain: str,
  lists: z.array(z.object({ text: str, content: str })).nullish(),
  salaryRange: z
    .object({
      currency: str,
      interval: str,
      min: z.number().nullish(),
      max: z.number().nullish(),
    })
    .nullish(),
  hostedUrl: str,
});

const ashbyJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  location: str,
  isRemote: z.boolean().nullish(),
  descriptionPlain: str,
  descriptionHtml: str,
  jobUrl: str,
  compensation: z.object({ compensationTierSummary: str }).nullish(),
});
const ashbyBoardSchema = z.object({ jobs: z.array(ashbyJobSchema) });

function apiUrlFor(p: AtsPosting): string {
  const board = encodeURIComponent(p.board);
  const id = encodeURIComponent(p.id);
  if (p.provider === "greenhouse")
    return `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`;
  if (p.provider === "lever")
    return `https://${p.eu ? "api.eu.lever.co" : "api.lever.co"}/v0/postings/${board}/${id}`;
  return `https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`;
}

/** Lever sends intervals like "per-year-salary" or "per-hour". */
function intervalText(interval: string | null | undefined): string {
  const found = /year|month|week|day|hour/i.exec(interval ?? "")?.[0]?.toLowerCase();
  return found ? ` per ${found}` : "";
}

function money(n: number): string {
  return n.toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

export async function fetchAtsFacts(
  p: AtsPosting,
  fetchImpl: typeof fetch = fetch,
): Promise<AtsFacts> {
  const apiUrl = apiUrlFor(p);
  let response: Response;
  try {
    response = await fetchImpl(apiUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(`The ${p.provider} job board could not be reached.`);
  }
  if (response.status === 404) throw new AtsPostingGone();
  if (!response.ok) throw new Error(`The ${p.provider} job board answered ${response.status}.`);
  const json: unknown = await response.json().catch(() => null);

  if (p.provider === "greenhouse") {
    const j = greenhouseSchema.parse(json);
    const company = j.company_name?.trim();
    return {
      title: j.title.trim(),
      company: company || companyFromBoard(p.board),
      companySource: company ? "api" : "board_name",
      location: j.location?.name?.trim() ?? "",
      isRemote: null,
      salary: null,
      description: htmlToText(j.content ?? ""),
      postingUrl: j.absolute_url ?? "",
      apiUrl,
    };
  }
  if (p.provider === "lever") {
    const j = leverSchema.parse(json);
    const lists = (j.lists ?? [])
      .map((l) => `${l.text ?? ""}\n${htmlToText(l.content ?? "")}`.trim())
      .filter(Boolean);
    const body = j.descriptionPlain?.trim() || htmlToText(j.description ?? "");
    const extra = j.additionalPlain?.trim() || htmlToText(j.additional ?? "");
    const r = j.salaryRange;
    return {
      title: j.text.trim(),
      company: companyFromBoard(p.board),
      companySource: "board_name",
      location: j.categories?.location?.trim() ?? "",
      isRemote: j.workplaceType ? j.workplaceType.toLowerCase() === "remote" : null,
      salary:
        r?.min != null && r.max != null && r.currency
          ? `${r.currency} ${money(r.min)}–${money(r.max)}${intervalText(r.interval)}`
          : null,
      description: [body, ...lists, extra].filter(Boolean).join("\n\n"),
      postingUrl: j.hostedUrl ?? "",
      apiUrl,
    };
  }
  const board = ashbyBoardSchema.parse(json);
  const j = board.jobs.find((job) => job.id === p.id);
  if (!j) throw new AtsPostingGone();
  return {
    title: j.title.trim(),
    company: companyFromBoard(p.board),
    companySource: "board_name",
    location: j.location?.trim() ?? "",
    isRemote: j.isRemote ?? null,
    salary: j.compensation?.compensationTierSummary?.trim() || null,
    description: j.descriptionPlain?.trim() || htmlToText(j.descriptionHtml ?? ""),
    postingUrl: j.jobUrl ?? "",
    apiUrl,
  };
}
