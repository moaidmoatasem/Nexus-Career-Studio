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

// ---- scam signals ----

const FREE_MAIL_EXACT = [
  "gmail.com",
  "googlemail.com",
  "ymail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "mail.com",
  "zoho.com",
  "qq.com",
  "163.com",
  "126.com",
  "rediffmail.com",
  "mail.ru",
  "web.de",
  "tutanota.com",
  "tuta.io",
  "fastmail.com",
] as const;
const FREE_MAIL_BRANDS = /^(?:[a-z0-9-]+\.)*(?:yahoo|hotmail|outlook|gmx|yandex)\.[a-z.]{2,}$/;

/** True for consumer webmail. Real employers write from their own domain or a recruiting system. */
export function isFreeMailSender(sender: string): boolean {
  const domain = senderDomain(sender);
  if (!domain) return false;
  return FREE_MAIL_EXACT.some((d) => hostIs(domain, d)) || FREE_MAIL_BRANDS.test(domain);
}

const PAYMENT_WORDS =
  "fees?|deposit|bitcoin|btc|crypto(?:currency)?|usdt|gift\\s?cards?|western\\s?union|moneygram|bank\\s?transfer";
const FEE_PATTERNS: Array<[RegExp, string]> = [
  [
    /(?<!\bno\s)(?<!\bwithout\s)\b(?:processing|registration|application|visa|work\s?permit|training|medical|admin(?:istration)?|clearance|security|recruitment|onboarding|insurance)\s+(?:fees?|charges?|deposit|payment)\b/i,
    "asks for a fee",
  ],
  [
    new RegExp(
      `\\b(?:pay|send|transfer|deposit|wire|remit)\\b[^.\\n]{0,60}\\b(?:${PAYMENT_WORDS})\\b`,
      "i",
    ),
    "asks for a payment",
  ],
  [
    /\b(?:western\s?union|moneygram|gift\s?cards?|bitcoin|usdt)\b/i,
    "mentions an untraceable payment method",
  ],
  [
    /\b(?:your|the)\s+visa\b[^.\n]{0,60}\b(?:pay|payment|fee|cost)\b|\bpay\b[^.\n]{0,30}\b(?:your|the)\s+visa\b/i,
    "asks you to pay for a visa",
  ],
];

/** Why a message looks like a recruitment scam. Empty when nothing stands out. */
export function scamSignals(input: { subject: string; body: string }): string[] {
  const text = `${input.subject}\n${input.body}`;
  return [...new Set(FEE_PATTERNS.filter(([re]) => re.test(text)).map(([, reason]) => reason))];
}

/**
 * Risk reasons for a recruitment-looking message. A fee or payment request is always flagged;
 * a free-mail sender is flagged only when the message really reads as recruitment (a friend
 * writing "interview tips" from Gmail is not). Flagged mail goes to the review queue and never
 * moves an application, even when it names the employer and the role.
 */
export function assessMailRisk(input: {
  sender: string;
  subject: string;
  body: string;
  readsAsRecruitment: boolean;
}): string[] {
  const reasons = scamSignals(input);
  if (input.readsAsRecruitment && isFreeMailSender(input.sender))
    reasons.unshift(`sent from a free-mail address (${senderDomain(input.sender)})`);
  return reasons;
}
