// Deterministic mail minimisation. Only mail that looks like recruitment is ever fetched in
// full, sent to an AI provider or stored; everything else is skipped and only its id is kept.
import { gulfBoardBrand, hostIs, isJobBoardHost } from "./jobSources";
import { senderDomain, senderIsCompany } from "./mailMatch";

/** Recruiting systems and job-alert senders: mail from these is always worth reading. */
const RECRUITING_DOMAINS = [
  "myworkday.com",
  "myworkdayjobs.com",
  "greenhouse.io",
  "greenhouse-mail.io",
  "lever.co",
  "hire.lever.co",
  "ashbyhq.com",
  "smartrecruiters.com",
  "taleo.net",
  "icims.com",
  "jobvite.com",
  "workable.com",
  "bamboohr.com",
  "successfactors.com",
  "successfactors.eu",
  "recruitee.com",
  "teamtailor.com",
  "breezy.hr",
  "pinpointhq.com",
  "eightfold.ai",
  "avature.net",
  "oraclecloud.com",
] as const;

/** Phrases recruitment mail uses. Phrases, not bare words: "offer" alone matches every sale. */
const RECRUITMENT_SUBJECT =
  /\b(?:your application|thank you for applying|thanks for applying|application (?:received|status|update|for)|applied|interview|recruiter|recruitment|screening|assessment|coding challenge|take-home|job offer|offer of employment|offer letter|employment offer|rejection|not moving forward|unsuccessful|next steps|job alert|new jobs?|candidate|vacancy|hiring|opportunity|your cv|your resume|shortlisted)\b/i;

/** Gmail's own categories, which hold mail that is almost never recruitment. */
const SKIPPED_LABELS = ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL"] as const;

export type FetchDecision =
  | { fetch: true; reason: "recruiting_sender" | "applied_employer" | "recruitment_subject" }
  | { fetch: false; reason: "promotions_or_social" | "not_recruitment" };

export function isRecruitingSender(sender: string): boolean {
  const domain = senderDomain(sender);
  if (!domain) return false;
  return (
    RECRUITING_DOMAINS.some((d) => hostIs(domain, d)) ||
    isJobBoardHost(domain) ||
    Boolean(gulfBoardBrand(domain))
  );
}

/**
 * Decides from the headers alone (sender, subject, Gmail labels) whether a message is read.
 * Known recruiting systems and job boards are always read, even in Promotions, because alert
 * mail often lands there; every other message in Promotions or Social is skipped.
 */
export function shouldFetchMessage(input: {
  sender: string;
  subject: string;
  labelIds: readonly string[];
  /** Employers of the user's applications. */
  employers: readonly string[];
}): FetchDecision {
  if (isRecruitingSender(input.sender)) return { fetch: true, reason: "recruiting_sender" };
  if (SKIPPED_LABELS.some((label) => input.labelIds.includes(label)))
    return { fetch: false, reason: "promotions_or_social" };
  if (input.employers.some((company) => senderIsCompany(input.sender, company)))
    return { fetch: true, reason: "applied_employer" };
  if (RECRUITMENT_SUBJECT.test(input.subject))
    return { fetch: true, reason: "recruitment_subject" };
  return { fetch: false, reason: "not_recruitment" };
}
