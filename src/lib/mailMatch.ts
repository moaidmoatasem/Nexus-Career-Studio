// Deterministic matching of a recruitment email to one of the user's applications.
// An application only moves automatically when the email names the same employer AND
// the same role, and no other application fits equally well. Everything else goes to
// the review queue. Whole words only: "Arm" never matches "warm regards".

const LEGAL_WORDS = new Set([
  "limited", "ltd", "plc", "llc", "llp", "inc", "incorporated", "corp", "corporation",
  "co", "company", "gmbh", "ag", "sa", "bv", "the",
]);
const TITLE_STOP_WORDS = new Set(["and", "of", "the", "a", "an", "for", "in", "to", "with", "at", "on", "or"]);

/** Lower-cased word tokens; keeps "+" and "#" so "C++" and "C#" stay distinct. */
export function words(text: string): string[] {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter(Boolean);
}

function containsRun(haystack: string[], needle: string[]): boolean {
  if (!needle.length || needle.length > haystack.length) return false;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((token, j) => haystack[i + j] === token)) return true;
  }
  return false;
}

function companyWords(name: string): string[] {
  return words(name).filter((w) => !LEGAL_WORDS.has(w));
}

/** Same employer when one name's words appear, in order, inside the other's ("Amazon" ~ "Amazon Web Services UK"). */
export function sameCompany(a: string, b: string): boolean {
  const wa = companyWords(a);
  const wb = companyWords(b);
  if (!wa.length || !wb.length) return false;
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  return containsRun(long, short);
}

/** The domain part of a From header such as `Talent <jobs@careers.revolut.com>`. */
export function senderDomain(sender: string): string {
  const bracketed = /<([^>]+)>/.exec(sender)?.[1];
  const address = (bracketed ?? sender).trim().toLowerCase();
  const at = address.lastIndexOf("@");
  return at >= 0 ? address.slice(at + 1).replace(/[^a-z0-9.-]/g, "") : "";
}

/** True when `host` is `domain` or one of its subdomains (never "linkedin.com.example.org"). */
export function hostIs(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return h === domain || h.endsWith(`.${domain}`);
}

/** The sender's own domain names the employer, e.g. jobs@amazon.jobs for "Amazon". */
export function senderIsCompany(sender: string, company: string): boolean {
  const first = companyWords(company)[0];
  if (!first || first.length < 3) return false;
  return senderDomain(sender).split(".").includes(first);
}

/**
 * The role is named in the email: the full job title appears as a phrase, or — for long
 * titles of four or more words — at least three quarters of its words appear.
 */
export function titleNamed(title: string, text: string): boolean {
  const titleWords = words(title).filter((w) => !TITLE_STOP_WORDS.has(w));
  if (!titleWords.length) return false;
  const haystack = words(text);
  if (containsRun(haystack, titleWords)) return true;
  if (titleWords.length < 4) return false;
  const present = new Set(haystack);
  return titleWords.filter((w) => present.has(w)).length / titleWords.length >= 0.75;
}

export interface MatchCandidate {
  id: string;
  jobs: { company_name: string; title: string } | null;
}

export interface MailFacts {
  /** Employer named by the classifier (may be empty). */
  companyName: string;
  subject: string;
  sender: string;
  body: string;
}

export interface MailMatch<T> {
  /** The one application the email clearly refers to, or null. */
  app: T | null;
  /** Why it matched or why it did not, for the activity log and review queue. */
  reason: string;
  /** A same-employer application to suggest in the review queue, if exactly one exists. */
  suggestion: T | null;
}

export function matchApplication<T extends MatchCandidate>(apps: T[], mail: MailFacts): MailMatch<T> {
  const text = `${mail.subject}\n${mail.body.slice(0, 8000)}`;
  const evaluated = apps.flatMap((app) => {
    if (!app.jobs) return [];
    const byName = Boolean(mail.companyName) && sameCompany(app.jobs.company_name, mail.companyName);
    const bySender = senderIsCompany(mail.sender, app.jobs.company_name);
    return [{ app, company: byName || bySender, title: titleNamed(app.jobs.title, text) }];
  });
  const strong = evaluated.filter((e) => e.company && e.title);
  const [only] = strong;
  if (strong.length === 1 && only) {
    return { app: only.app, reason: "employer and role title both named in the email", suggestion: null };
  }
  if (strong.length > 1) {
    return { app: null, reason: `${strong.length} applications match this employer and role`, suggestion: null };
  }
  const sameEmployer = evaluated.filter((e) => e.company);
  const [suggested] = sameEmployer;
  return {
    app: null,
    reason: sameEmployer.length ? "Employer matched, but the email doesn't name the role" : "No application with this employer",
    suggestion: sameEmployer.length === 1 && suggested ? suggested.app : null,
  };
}

export type MailSourceKind = "recruiter" | "linkedin_alert" | "indeed_alert" | "workday_alert";

/**
 * Job-alert mail is recognised by the sender's real domain, not the display name, so a
 * spoofed "LinkedIn Jobs <x@example.org>" is treated as ordinary mail. Workday mostly sends
 * application status updates, so only its explicit job-alert digests count as alerts.
 */
export function mailSourceKind(sender: string, subject: string): MailSourceKind {
  const domain = senderDomain(sender);
  if (hostIs(domain, "linkedin.com")) return "linkedin_alert";
  if (hostIs(domain, "indeed.com")) return "indeed_alert";
  if (hostIs(domain, "myworkday.com") && /\bjob alert|\bnew jobs?\b|\bjobs? (?:for you|matching)/i.test(subject)) {
    return "workday_alert";
  }
  return "recruiter";
}

const JOB_LINK_DOMAINS = ["linkedin.com", "indeed.com", "myworkdayjobs.com", "greenhouse.io", "lever.co", "ashbyhq.com"];

/** Up to three job-posting links on known job sites, matched on the real host name. */
export function jobLinks(text: string, limit = 3): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return [...new Set(matches.map((value) => value.replace(/[.,;]+$/, "")))]
    .filter((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && JOB_LINK_DOMAINS.some((domain) => hostIs(url.hostname, domain));
      } catch {
        return false;
      }
    })
    .slice(0, limit);
}
