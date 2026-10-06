# Strategy: the honest job-search agent

Direction set on 2026-10-06 after a market review of AI job-search tools (key sources at the end). The codebase stays
Nexus Career Studio; "Job Seeker Mate" is the working name for the consolidated product, and the final name is still the
owner's call. [PLAN.md](PLAN.md) turns this into build steps; [AGENTS.md](AGENTS.md) holds the rules code must follow.

## Why this direction

- **Volume is no longer the bottleneck; trust is.** LinkedIn's CEO said in September 2026 that job seekers send 30% more
  applications than before the pandemic, making it harder to "know who can actually do the job". Greenhouse's 2025 AI in
  Hiring report (4,136 people in the US, UK, Ireland and Germany) found only 8% of job seekers think AI makes hiring
  fairer, while 91% of recruiters have caught candidate deception.
- **Auto-apply bots feed the problem.** Reviews of mass auto-apply tools are mixed to poor, the early leader Sonara shut
  down in February 2024, LinkedIn's terms ban bots and extensions that automate activity, and employers increasingly
  screen out generic AI applications.
- **The big platforms are making discovery free, inside their own walls.** Indeed (Career Scout, and an app in ChatGPT
  since February 2026), LinkedIn (AI job search, Hiring Assistant) and ZipRecruiter (ChatGPT app, March 2026) each keep
  applications on their own site. None of them tracks a candidate's whole search across platforms, reads replies,
  follows up, or tells the candidate honestly that a role is a poor fit.
- **That neutral, candidate-owned layer is the opening**, and Nexus already has early versions of most of it: a verified
  Career Vault with a deterministic fact-check, ATS discovery, sponsor matching, inbox tracking and a background agent.

## Positioning

**The honest agent: a job-search partner that works for the candidate across every source and never misstates their
experience.**

1. **Verified truth.** Every claim in every application traces to the verified Career Vault; nothing is invented.
2. **The whole pipeline, across every board.** One tracker, replies detected from the inbox, follow-ups drafted on time.
3. **Fewer, better, faster applications.** High-fit roles, tailored, sent early, with proof of what was sent and when.
4. **Cross-border mobility.** Sponsor and visa status on every role, starting with the UK register.
5. **Arabic-first for MENA.** Arabic and English, Gulf CV conventions, approvals and alerts on the messaging apps people
   use.

## Who it is for, in order

1. Mid-career professionals in Egypt, the Levant and the Gulf looking for Gulf, UK or remote roles.
2. International graduates and skilled workers who need UK visa sponsorship.
3. Final-year students and bootcamp graduates, reached through their institutions.

These are where to start, not limits: the product stays role- and country-agnostic.

## Core loop

Discover roles → score fit and sponsor status → draft tailored, fact-checked materials → the user approves (one tap,
singly or in a batch) → submit through the fastest permitted channel and log proof → watch for replies → draft
follow-ups after 5–7 days → weekly review of what is working, then adjust the search.

## Automation policy: supervised autopilot

- **Automatic:** discovery, fit scoring, tailoring, tracking, reply detection and follow-up drafts.
- **Submission:** only after the user approves, per application or for a batch, in the app or a messaging app.
- **Automatic submission:** opt-in, limited to channels whose terms allow it (for example an employer's own API access),
  and capped at a small daily number of high-fit roles.
- **Never:** automating or scraping LinkedIn or other job boards, solving CAPTCHAs or security checks, inventing answers
  to visa, salary or legal questions, or sending email without approval.
- **Always:** an append-only record of every submission with proof (time, channel, what was sent, confirmation).

## Architecture direction

Three planes:

1. **Data plane, owned by the user.** Career Vault, documents, mailbox reading and the application log. Self-hosted by
   default; a hosted version later, once its certifications and legal basics are in place.
2. **Agent plane.** The background agent plans the day, scores fit, drafts materials and schedules follow-ups. It stays
   model-agnostic through any OpenAI-compatible API, with a cheaper model for parsing and a stronger one for writing.
3. **Action plane, graded by risk.** Public ATS APIs to read jobs; a browser extension that fills forms in the user's own
   signed-in browser; automatic submission only where allowed; never LinkedIn.

Interfaces: the web app is the core; a browser extension for employer application forms; WhatsApp or Telegram for
approvals and alerts; an MCP server with Claude and ChatGPT apps so people can talk to their agent (a channel for
reaching users, not the core).

## Rules that shape the design

| Constraint | Consequence |
|---|---|
| LinkedIn's User Agreement and prohibited-software page ban crawlers, bots and extensions that scrape or automate LinkedIn; LinkedIn sued Proxycurl, which shut down in July 2025 | No LinkedIn automation or server-side fetching; LinkedIn roles enter only through the user's alert emails or text the user pastes |
| Greenhouse, Lever and Ashby let anyone read postings through public APIs, but submitting through their APIs needs the employer's key | Read postings freely; submit through the hosted form (browser extension) or an employer partnership |
| Reading Gmail on a server for other people needs Google's restricted-scope verification and an annual CASA security assessment | Self-hosting uses the owner's own OAuth client; a hosted version budgets the assessment or offers email forwarding, Outlook or IMAP |
| Egypt's Personal Data Protection Law (Law 151/2020): its executive regulations were issued in 2025 with a one-year grace period ending around 1 November 2026; they require licences or permits, a data protection officer, 72-hour breach notice, and permits for cross-border transfers (sending CVs to an AI provider abroad counts) | Get legal advice and the required licences before storing other people's data on a server run from Egypt |
| GDPR and UK GDPR for UK and EU users | Lawful basis, data minimisation, export and deletion, transfer safeguards |
| The EU AI Act treats AI used to recruit or select people as high-risk (obligations now due 2 December 2027); New York City's Local Law 144 covers employers' automated decision tools | A candidate-side product is likely outside both; any employer-facing feature needs legal review first |

## Business model (shape only)

- Free, open-source self-hosting with the user's own AI key.
- Paid hosted plans priced for each market, including weekly or per-search options, since job hunts come in short
  bursts; an outcome-aligned option ("pay until hired") is worth testing.
- Seats for universities, bootcamps, outplacement firms and public employment programmes.
- Users leaving once hired is success: plan for referrals, re-activation at the next job change, and institution
  contracts.

Price points and revenue targets are kept out of this public repository.

## Moats to build

- **Trust:** verified claims, and an agent that never gets the user's accounts restricted.
- **Outcome data:** which applications get replies, by role, country and source. Only a cross-platform tool can see it.
- **Regional depth:** Arabic, sponsor and visa data, local job sources.
- **Institution contracts and community:** cohorts, alumni and referrals.

Technology alone is not a moat: open-source auto-apply bots show anyone can build one.

## Metrics

- Activation: Career Vault completed and a first batch approved within 48 hours.
- Interviews per 100 applications, compared with the user's own baseline (measured, never claimed).
- Reply-detection accuracy, weekly active approvers, time to first interview, hires per month.
- Free-to-paid conversion, paid months per hire, referrals per hire.
- AI cost per active user.

## Main risks

| Risk | Mitigation |
|---|---|
| LinkedIn or job-board enforcement, and users' accounts being restricted | No board automation; user-initiated input only; partnerships where possible |
| Anti-bot measures and CAPTCHAs on application forms | Fill forms in the user's own browser session; the user handles every check |
| Employers detecting and rejecting AI applications | Verified-truth tailoring, low volume, high fit |
| Gmail verification cost for a hosted version | Self-hosted mode; Outlook, IMAP or forwarding; budget the assessment |
| Egypt data-protection compliance | Legal advice, data protection officer, licences and records before hosting others' data |
| Big platforms bundling free AI (LinkedIn, Indeed, Bayt, OpenAI) | Be the neutral cross-platform layer; plug into their apps rather than compete on job inventory |
| Users leaving once hired | Referrals, re-activation, institution seats, outcome-based pricing |
| Low willingness to pay in Egypt | Local pricing, per-search packs, institution-paid seats |
| Dependence on one AI provider | OpenAI-compatible model routing; local models for parsing |

## Open decisions for the owner

1. The product name.
2. Confirm the supervised-autopilot policy above.
3. When to open a hosted version to other people, and the compliance path (Egypt data-protection licensing and officer;
   Gmail assessment or email forwarding). Time-sensitive because of the November 2026 deadline.
4. Prices per market and the payment provider.
5. Messaging channel for approvals: WhatsApp Business (paid, template rules) or Telegram (free) first.
6. Keep the separate LinkedIn Career Copilot MCP as a personal tool, outside the product.

## Key sources

Figures are as reported in September–October 2026. Many vendor numbers are self-reported, and the legal points are a
summary, not legal advice.

- Fortune, 30 Sep 2026, LinkedIn CEO on application volume: https://fortune.com/2026/09/30/linkedin-ceo-dan-shapero-says-job-seekers-sending-out-30-more-applications-pre-pandemic-harder-know-who-can-do-job/
- Greenhouse 2025 AI in Hiring report: https://www.greenhouse.com/blog/rebuilding-trust-in-hiring-how-to-create-transparent-candidate-experiences-in-the-age-of-ai
- LinkedIn, prohibited software and extensions: https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions
- Sonara's shutdown (Teal review): https://www.tealhq.com/post/sonara-review
- Proxycurl's shutdown: https://www.cleanlist.ai/alternatives/proxycurl
- Indeed's app in ChatGPT: https://www.indeed.com/news/releases/indeed-launches-app-in-chatgpt
- Indeed Career Scout and Talent Scout: https://www.indeed.com/news/releases/indeed-introduces-new-suite-of-hiring-products-career-scout-talent-scout-premium-sponsored-jobs-and-indeed-connect
- ZipRecruiter's ChatGPT app: https://www.businesswire.com/news/home/20260319526585/en/ziprecruiter-launches-chatgpt-app-for-ai-powered-job-discovery/
- Greenhouse Job Board API: https://docs.greenhouse.io/job-board.html
- Lever Postings API: https://github.com/lever/postings-api
- Ashby application form submission: https://developers.ashbyhq.com/reference/applicationformsubmit
- Google restricted-scope verification: https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- Egypt PDPL executive regulations: https://cms.law/en/are/legal-updates/egypt-s-pdpl-executive-regulations-issued-one-year-compliance-countdown-begins
- EU AI Act deadlines after the Digital Omnibus: https://cdp.cooley.com/digital-ai-omnibus-delays-key-deadlines-introduces-new-rules/
