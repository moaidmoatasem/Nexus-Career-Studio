// Host policy for job intake. Job boards forbid automated access in their terms, so the
// server, the portal worker and the extension never fetch, scrape or automate them: board
// roles enter only through the user's own alert emails or text the user pastes. Employer
// sources (public ATS APIs and employer career pages) are the only things read on the server.

/** Brand names, matched against every label of a host name (see isJobBoardHost). */
const BOARD_BRANDS = [
  "linkedin",
  "indeed",
  "glassdoor",
  "bayt",
  "naukrigulf",
  "gulftalent",
  "wuzzuf",
] as const;

/** Link shorteners owned by a board. */
const BOARD_HOSTS = ["lnkd.in"] as const;

/** The Gulf boards whose alert emails are recognised but not parsed yet (Track A, task A.3). */
export const GULF_BOARD_BRANDS = ["bayt", "naukrigulf", "gulftalent", "wuzzuf"] as const;

/** Public employer ATS hosts whose postings may be read on the server. */
export const EMPLOYER_ATS_DOMAINS = [
  "myworkdayjobs.com",
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
] as const;

export const JOB_BOARD_MESSAGE =
  "Nexus never opens LinkedIn, Indeed or other job boards. Paste the job description text here instead, or open the employer's own posting.";

/** True when `host` is `domain` or one of its subdomains (never "linkedin.com.example.org"). */
export function hostIs(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return h === domain || h.endsWith(`.${domain}`);
}

function labels(host: string): string[] {
  return host.toLowerCase().replace(/\.$/, "").split(".");
}

/**
 * True for a job board's host name, in any country domain or subdomain (indeed.com,
 * uk.indeed.com, indeed.co.uk, www.linkedin.com, lnkd.in). It matches on a whole host-name
 * label so "notlinkedin.com" is unaffected (and employer ATS tenants are exempt), and it fails closed: "linkedin.com.example.org"
 * counts as a board too, because a look-alike host is never worth fetching.
 */
export function isJobBoardHost(host: string): boolean {
  // A company name used as a tenant label on a public ATS (indeed.wd1.myworkdayjobs.com) is
  // the employer's own posting, not the board.
  if (EMPLOYER_ATS_DOMAINS.some((d) => hostIs(host, d))) return false;
  if (BOARD_HOSTS.some((b) => hostIs(host, b))) return true;
  return labels(host).some((label) => (BOARD_BRANDS as readonly string[]).includes(label));
}

function hostOf(raw: string): string | null {
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

/** True when the URL points at a job board. Unparseable input is not a board URL. */
export function isJobBoardUrl(raw: string): boolean {
  const host = hostOf(raw);
  return host !== null && isJobBoardHost(host);
}

/** The Gulf board brand an email sender domain belongs to, if any. */
export function gulfBoardBrand(host: string): (typeof GULF_BOARD_BRANDS)[number] | null {
  const hit = labels(host).find((label) =>
    (GULF_BOARD_BRANDS as readonly string[]).includes(label),
  );
  return (hit as (typeof GULF_BOARD_BRANDS)[number] | undefined) ?? null;
}

export class JobBoardError extends Error {
  constructor(message = JOB_BOARD_MESSAGE) {
    super(message);
    this.name = "JobBoardError";
  }
}

/** Throws before any network request when the URL is a job board. */
export function assertNotJobBoard(raw: string): void {
  if (isJobBoardUrl(raw)) throw new JobBoardError();
}

/**
 * One stable link per board posting, so the same role from an alert email, a second alert or a
 * pasted link is recognised as one. LinkedIn: /jobs/view/<id>; Indeed: /viewjob?jk=<id>. The
 * link is only ever stored for the user to open; it is never fetched.
 */
export function canonicalBoardLink(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  const host = url.hostname.toLowerCase();
  if (labels(host).includes("linkedin")) {
    const id = /\/jobs\/view\/(?:[^/?#]*?-)?(\d{5,})/.exec(url.pathname)?.[1];
    if (id) return `https://www.linkedin.com/jobs/view/${id}`;
  }
  if (labels(host).includes("indeed")) {
    const jk = url.searchParams.get("jk");
    if (jk && /^[0-9a-f]{8,32}$/i.test(jk)) return `https://${host}/viewjob?jk=${jk}`;
  }
  return "";
}
