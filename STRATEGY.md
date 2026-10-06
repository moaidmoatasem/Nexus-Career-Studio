# Strategy: the honest job-search agent

Direction set on 2026-10-06 after a market review of AI job-search tools, and revised the same day after a premortem and
a closer look at similar projects (key sources at the end). The codebase stays Nexus Career Studio; "Job Seeker Mate" is
the working name for a consolidated product, and the final name is still the owner's call. [PLAN.md](PLAN.md) turns this
into build steps; [AGENTS.md](AGENTS.md) holds the rules code must follow.

## Decision (2026-10-06)

The idea is sound, but its general form already exists as mature open source (see "Where Nexus stands" below). The work
therefore runs on three tracks, with gates in PLAN.md:

- **Track N: keep Nexus safe, honest and working.** Fix the known defects, make job intake board-safe, add CI and run it
  on real accounts (PLAN.md Phases 0–3). New feature work in Nexus waits for the gates.
- **Track A: contribute upstream now.** Offer what Nexus does best to career-ops (inbox reply tracking, UK sponsor
  checks, Gulf alert-email parsers, Arabic and Gulf CV templates), and use career-ops for the owner's own search.
- **Track B: test demand in parallel.** A hosted, Arabic-first, phone-first product for job seekers in the Middle East
  and North Africa who will never open a terminal. Interviews and a prototype with made-up data come first; building
  starts only if the test passes the thresholds the owner sets beforehand (Gate 1).
- **Fallback.** If Gate 1 isn't passed by 31 December 2026, Nexus stays a personal, self-hosted tool, the gated phases
  leave the plan, and new feature work goes upstream.

## Where Nexus stands among similar projects (October 2026)

| | Nexus | career-ops | JobSync | JobFlow AI | Jobright, Sonara |
|---|---|---|---|---|---|
| How you run it | Self-host: Supabase, Google Cloud, AI key | Locally, inside an AI coding tool; one-line install | Self-hosted web app; MCP server | Hosted, free tier | Hosted subscription |
| Finds jobs from | One Firecrawl web search per click (up to 8 roles), pasted links, alert emails | 103 free sources, incl. Workday, SuccessFactors, Taleo and Telegram channels | Greenhouse, Lever, Ashby | Your inbox only | Large databases, mostly US |
| Checks tailored text | Each bullet cites a verified record; numbers checked | Numbers, employers, titles and tools, on every PDF | None found | Doesn't tailor | Jobright: invented metrics reported; Sonara: one untailored CV |
| Tracks replies | Reads Gmail live and updates status (three defects; PLAN.md 2.6) | Matches and classifies replies you paste in | None found | Gmail, Outlook and IMAP | None found |
| Visa data | UK register inside the fit score | US H-1B plugin; flags no-sponsorship postings | None found | None | US H-1B listings (Jobright) |
| Submits | Not yet; supervised plan | Never; pre-fills forms | No | No | Yes, in bulk |
| Arabic / MENA | Planned | Arabic modes, incl. Arab labour-law terms | None found | None found | None found |
| Scale | No users; not yet run on real accounts | ~73,600 stars, 200 contributors, 628 test files, v1.35.0 | ~1,000 stars | Paid product | Paid products |

"None found" means the feature did not appear in the sources checked, not that it is proven absent.

What changed from the first review:

- **career-ops** (MIT licence) follows nearly the same principles: fewer, better applications, evidence over keywords, a
  human decides, local-first. It already covers most of the agent work this plan had scheduled. It also treats postings
  and emails as untrusted input, checks that a posting is still open before evaluating it, and in its web app keeps the
  CV-writing agent away from file-writing tools.
- **Reply tracking from the inbox is not rare.** JobFlow AI does it for Gmail, Outlook and IMAP, as do several small
  open-source tools and browser extensions. career-ops has a matcher and classifier but no automatic Gmail feed yet (its
  issue #1583).
- **UK sponsor lookup is not unique.** Free Chrome extensions check employers against the Home Office register, one of
  them on LinkedIn job cards. The two checked have about 200 and 2,000 users, so sponsor lookup alone attracts few people.
- **Arabic is not open ground.** career-ops ships Arabic modes for Arabic CVs and cover letters, including terms such as
  end-of-service gratuity and housing allowance.
- **Sonara did not stay dead.** It shut down in February 2024, BOLD (Zety, LiveCareer) bought it, and it is live again.

What Nexus still has:

1. Every bullet must cite a record the user marked as verified: stricter provenance than checking against a CV file,
   though career-ops checks more kinds of claim.
2. Live inbox tracking and fact-checked tailoring in one product. The gap is narrow and on career-ops' own list.
3. UK sponsor matching inside the fit score.
4. A multi-user web app. It is an advantage only if someone hosts it: today Nexus is harder to set up than career-ops.
5. Supervised submission with proof of what was sent: planned, not built, and the riskiest part.

Lessons from similar projects:

- career-ops grew from its founder's own search (740 listings evaluated, 68 applications, 12 interviews, 1 offer), then
  press, a manifesto, public hire stories, a README in 17 languages and plugins. Its reach came from a story and a
  community, not from features.
- Mass auto-apply tools get bought rather than fixed: Sonara returned under BOLD.
- Automating LinkedIn ends in an arms race. AIHawk, the best-known LinkedIn auto-apply bot, became a browser agent built
  to avoid detection, and LinkedIn keeps winning against scrapers (Proxycurl closed in 2025; a court judgment against
  ProAPIs was reported in September 2026).
- Google's limits are real: CareerSync, an open-source Gmail tracker, says Google's restrictions cap it at 100 users.

## Why this direction

- **Volume is no longer the bottleneck; trust is.** LinkedIn's CEO said in September 2026 that job seekers send 30% more
  applications than before the pandemic, making it harder to "know who can actually do the job". Greenhouse's 2025 AI in
  Hiring report (4,136 people in the US, UK, Ireland and Germany) found only 8% of job seekers think AI makes hiring
  fairer, while 91% of recruiters have caught candidate deception.
- **Auto-apply bots feed the problem.** Reviews of mass auto-apply tools are mixed to poor; Sonara, the early leader,
  shut down in February 2024 and was later bought and relaunched by BOLD; LinkedIn's terms ban bots and extensions that
  automate activity; and employers increasingly screen out generic AI applications.
- **The big platforms are making discovery free, inside their own walls.** Indeed (Career Scout, and an app in ChatGPT
  since February 2026), LinkedIn (AI job search and Job Match for all members, Hiring Assistant for employers) and
  ZipRecruiter (ChatGPT app, March 2026) each keep applications on their own site, and OpenAI announced a jobs platform
  for mid-2026.
- **The candidate-owned layer across platforms exists, but for technical users it is taken.** career-ops covers it as
  open source and JobFlow AI covers inbox tracking commercially. The open space is people who will never use a
  terminal, in their own language and on their phone, starting with MENA (Track B).

## Positioning (for Track B)

**The honest job-search partner for people who will never open a terminal: Arabic-first, phone-first, and never
inventing a claim.**

1. **Verified truth.** Every claim cites a record the user verified, every number is checked, and anything the checker
   can't verify is flagged for the user.
2. **The whole pipeline, across every board.** One tracker, replies detected from the inbox, follow-ups drafted on time.
3. **Fewer, better, faster applications.** High-fit roles, tailored, sent early, with proof of what was sent and when.
4. **Cross-border mobility.** Sponsor and visa status on every role, starting with the UK register.
5. **Arabic-first for MENA.** Arabic and English, Gulf CV conventions, approvals and alerts on the messaging apps people
   use.

## Who it is for, in order

1. Mid-career professionals in Egypt, the Levant and the Gulf looking for Gulf, UK or remote roles.
2. International graduates and skilled workers who need UK visa sponsorship.
3. Final-year students and bootcamp graduates, reached through their institutions.

These are where to start, not limits: the product stays role- and country-agnostic. Self-hosting reaches developers
only; the first and third groups need a hosted product, which is what Track B tests.

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
   default; a hosted version only after Gate 1 and its legal basics. Mail is filtered deterministically before anything
   reaches an AI provider or the database (PLAN.md 2.6).
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
| Google expires refresh tokens after 7 days while a consent screen is in Testing; an unverified app in production shows a warning and can add only 100 new users over its lifetime | Self-hosters test the unverified-production route (PLAN.md 3.5); a hosted version needs verification or a Gmail-free intake |
| Egypt's Personal Data Protection Law (Law 151/2020): its executive regulations were issued in 2025 with a one-year grace period ending around 1 November 2026; they require licences or permits, a data protection officer, 72-hour breach notice, and permits for cross-border transfers (sending CVs to an AI provider abroad counts) | Get legal advice and the required licences before storing other people's data on a server run from Egypt |
| GDPR and UK GDPR for UK and EU users | Lawful basis, data minimisation, export and deletion, transfer safeguards |
| The EU AI Act treats AI used to recruit or select people as high-risk (obligations now due 2 December 2027); New York City's Local Law 144 covers employers' automated decision tools | A candidate-side product is likely outside both; any employer-facing feature needs legal review first |
| The Chrome Web Store reviews extensions with broad host permissions, and new developers, more closely; review can take weeks | The extension asks for site access at click time rather than at install |
| Recruitment scams are common in the Gulf: on 25 August 2026 Dubai Police warned about fake job and visa offers sold through social media and messaging apps | Scam signals in the review queue; mail from free-mail senders never moves an application |
| Free Supabase projects pause after a week of inactivity | Self-hosters run the scheduler on an always-on host; a banner shows when syncing stops |

## Business model (shape only)

Applies only if Track B passes.

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

Technology alone is not a moat: career-ops already ships most of the agent features as MIT-licensed open source. What
can be defended is trust, distribution and depth in one market, and outcome data, and all of these need users first.

## Metrics

- Gates: Track B results against the thresholds set in PLAN.md B.1 (Gate 1); weekly active outside users of a hosted
  pilot (Gate 2: at least 10 for 4 weeks).
- Activation: Career Vault completed and a first batch approved within 48 hours.
- Interviews per 100 applications, compared with the user's own baseline (measured, never claimed).
- Reply-detection accuracy, weekly active approvers, time to first interview, hires per month.
- Free-to-paid conversion, paid months per hire, referrals per hire.
- AI cost per active user.

## Main risks

From the market review and the premortem. Dates are the tripwires in PLAN.md.

| Risk | Early warning sign | Mitigation |
|---|---|---|
| Stuck between self-hosting (developers only) and a hosted version blocked by compliance | By 31 December 2026, no non-developer uses Nexus | Track B decides the route; legal advice before any hosted pilot (PLAN.md 12.1) |
| The owner is the bottleneck: reviews, owner steps, a full-time job and overlapping side projects | Phase 0 owner steps not done by 20 October 2026, or Phase 3 by 30 November 2026 | Gates keep the plan small; fold or park overlapping projects |
| No demand for this version | Track B misses the thresholds set beforehand | Fallback to a personal tool; contribute upstream (Track A) |
| Thin, slow queue for Gulf users | Fewer than half of queued roles arrive without pasting, or the median time from arrival to approval is over a day | Gulf alert parsers (Track A); phone alerts before the extension |
| The inbox feature floods the review queue and sends personal mail to the AI provider | The review queue is mostly non-recruitment mail | PLAN.md 2.6: deterministic filter before any AI call |
| Inbox tracking stalls on one unreadable message or a paused AI key | The activity log repeats "Inbox check failed" | PLAN.md 2.6: per-message errors and a daily retry of paused syncs |
| Self-hosted copies die quietly (7-day Gmail tokens in Testing, paused free Supabase projects, sleeping laptops) | No successful sync for 24 hours | Stale-sync banner; test the unverified-production route (PLAN.md 3.5) |
| Recruitment scams surfaced with the app's credibility | A fee or visa-payment request reaches the review queue | Scam signals (PLAN.md 2.6) |
| A wrong claim or answer reaches an employer, including through prompt injection in postings or emails | Users edit kits after approval because something was wrong | Flag unverifiable sentences; treat postings and emails as untrusted; automatic submission stays off until approvals and the proof log have run cleanly for weeks |
| LinkedIn or job-board enforcement, and users' accounts being restricted | Any warning from a board | No board automation; user-initiated input only; partnerships where possible |
| Anti-bot measures and CAPTCHAs on application forms | Forms failing in the user's browser | Fill forms in the user's own browser session; the user handles every check |
| The browser extension stalls in review or scares people off | Review takes over two weeks, or few installs | Site access at click time (`activeTab`, optional host permissions) |
| Big platforms and open source give the features away (LinkedIn, Indeed, Bayt, OpenAI, career-ops) | Testers say "I can do this in ChatGPT or career-ops" | Compete on market depth and distribution, not features; plug into their apps and contribute upstream |
| Gmail verification cost for a hosted version | A hosted pilot nears 100 Gmail users | Forwarding, Outlook or IMAP intake; budget the assessment |
| Egypt data-protection compliance | No legal advice before a hosted pilot | Legal advice, data protection officer, licences and records before hosting others' data |
| Users leaving once hired, and low willingness to pay in Egypt | Short paid periods | Referrals, re-activation, institution seats, local pricing and per-search packs |
| Dependence on one AI provider | Price or policy changes | OpenAI-compatible model routing; local models for parsing |

## Open decisions for the owner

1. Confirm the three-track decision above (the plan follows it until the owner changes it).
2. Track B's pass thresholds, set before the first interview (PLAN.md B.1).
3. The product name.
4. Confirm the supervised-autopilot policy (needed only once Gate 1 opens Phase 6).
5. If Track B passes: when to open a hosted pilot, and the compliance path (Egypt data-protection licensing and officer;
   Gmail assessment or email forwarding).
6. Prices per market and the payment provider (Track B only).
7. Messaging channel for approvals: WhatsApp Business (paid, template rules) or Telegram (free) first.
8. Keep the separate LinkedIn Career Copilot MCP as a personal tool, outside the product.

## Key sources

Figures are as reported in September–October 2026. Many vendor numbers are self-reported, star counts come from GitHub
pages, and the legal points are a summary, not legal advice.

- Fortune, 30 Sep 2026, LinkedIn CEO on application volume: https://fortune.com/2026/09/30/linkedin-ceo-dan-shapero-says-job-seekers-sending-out-30-more-applications-pre-pandemic-harder-know-who-can-do-job/
- Greenhouse 2025 AI in Hiring report: https://www.greenhouse.com/blog/rebuilding-trust-in-hiring-how-to-create-transparent-candidate-experiences-in-the-age-of-ai
- LinkedIn, prohibited software and extensions: https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions
- Sonara's shutdown (Teal review): https://www.tealhq.com/post/sonara-review
- Sonara's purchase by BOLD and relaunch (Resumly, a competitor): https://www.resumly.ai/answers/what-happened-to-sonara-ai
- Proxycurl's shutdown: https://www.cleanlist.ai/alternatives/proxycurl
- LinkedIn v. ProAPIs (Sigma Law Group): https://sigmalawgroup.com/blog/2026-09-18-linkedin-proapis-scraping-consent-judgment/
- Indeed's app in ChatGPT: https://www.indeed.com/news/releases/indeed-launches-app-in-chatgpt
- Indeed Career Scout and Talent Scout: https://www.indeed.com/news/releases/indeed-introduces-new-suite-of-hiring-products-career-scout-talent-scout-premium-sponsored-jobs-and-indeed-connect
- ZipRecruiter's ChatGPT app: https://www.businesswire.com/news/home/20260319526585/en/ziprecruiter-launches-chatgpt-app-for-ai-powered-job-discovery/
- LinkedIn's 2026 AI job-search changes (Jobsistant): https://www.jobsistant.com/guides/linkedin-2026-ai-changes
- OpenAI Jobs Platform (Built In): https://builtin.com/articles/openai-jobs-platform
- career-ops: https://github.com/career-ops-hq/career-ops
- JobSync: https://github.com/Gsync/jobsync
- AIHawk: https://github.com/feder-cr/Jobs_Applier_AI_Agent_AIHawk
- CareerSync: https://github.com/Tomiwajin/CareerSync
- JobFlow AI: https://jobflow-ai.com/
- UK Visa Sponsor Checker for LinkedIn: https://chromewebstore.google.com/detail/uk-visa-sponsor-checker-f/jblclhhcofndafibklkfgahehlpngjdd?hl=en
- Work Sponsors extension: https://chromewebstore.google.com/detail/work-sponsors-uk-visa-spo/dimfinoaanekfobepegcgajdbeofbipc?hl=en
- Jobright review (ATS Verification): https://atsverification.com/blog/jobright-ai-review-2026/
- Jobright H-1B listings: https://jobright.ai/jobs/h1b-visa-sponsored-software-engineering-intern-jobs-in-within-us
- Greenhouse Job Board API: https://docs.greenhouse.io/job-board.html
- Lever Postings API: https://github.com/lever/postings-api
- Ashby application form submission: https://developers.ashbyhq.com/reference/applicationformsubmit
- Google restricted-scope verification: https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- Google, managing an app's audience (Testing tokens, user cap): https://support.google.com/cloud/answer/15549945?hl=en
- Google, unverified apps: https://support.google.com/cloud/answer/7454865?hl=en
- Google Workspace API user data policy: https://developers.google.com/workspace/workspace-api-user-data-developer-policy?hl=en
- Supabase pricing (free projects pause after a week of inactivity): https://supabase.com/pricing
- Chrome Web Store review process: https://developer.chrome.com/docs/webstore/review-process
- The National, 25 Aug 2026, Dubai Police warning on fake job and visa offers: https://www.thenationalnews.com/news/uae/2026/08/25/dubai-police-fake-visa-job-offer-warning/
- Egypt PDPL executive regulations: https://cms.law/en/are/legal-updates/egypt-s-pdpl-executive-regulations-issued-one-year-compliance-countdown-begins
- EU AI Act deadlines after the Digital Omnibus: https://cdp.cooley.com/digital-ai-omnibus-delays-key-deadlines-introduces-new-rules/
