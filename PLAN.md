# Plan: building the honest job-search agent

Written 2026-10-06 so Claude Code can work through the project in order, updated the same day with the product
direction in [STRATEGY.md](STRATEGY.md), and finalised after a premortem and a review of similar projects: the work now
runs on three tracks with decision gates (see "Tracks and gates"). Project rules are in [AGENTS.md](AGENTS.md); setup
details are in [DEPLOY.md](DEPLOY.md).

## How to work through this plan

- Order: Track N first, 0 → 1 → 2 → 3, then 4 if wanted. Tracks A and B run alongside it. Phases 5–12 sit behind the gates below; once a gate opens, these prerequisites still apply: Phase 5 needs Phase 1; Phase 6 needs 5; Phase 7 needs 6.2–6.4; Phase 8 needs 5.4; Phases 9 and 10 need only Phase 1; Phase 11 needs 6. Phase 12.1–12.3 must be finished before anyone else's data is stored on a server the owner runs. Phase 13 waits for the owner.
- Gates are binding. Work behind a gate starts only after the owner ticks that gate in this file; Claude Code never ticks a gate.
- If the next Track N task is waiting on the owner, continue with the first open **[claude]** task in Track B, or in Track A once A.0 is done, and say which one you picked in the PR.
- Before outlining any phase from 5 onwards, check whether career-ops or JobSync already does it (STRATEGY.md, "Where Nexus stands"). If one does, the outline PR proposes contributing there, or reusing its code with its licence notice kept, instead of rebuilding.
- Phases 5–13 are outlines. The first PR of each of those phases only turns its outline into detailed tasks in this file (files to touch, migrations, tests, acceptance checks) for the owner to review; building starts after that PR merges.
- When a task touches automation, job sources or personal data, follow the automation policy and the rules in STRATEGY.md and AGENTS.md.
- Take the first unchecked task whose prerequisites are done. Each phase is one branch and one pull request against `main`; split a big phase into several PRs. Never merge, never push to `main`, never rewrite published history: the owner merges.
- **[owner]** marks steps only the repository owner can do: accounts, dashboards, payments, DNS, servers, a real mailbox. Prepare everything around them, then ask one precise question and wait. **[claude]** steps need no one.
- Secrets live only in `.env` (git-ignored) or the host's secret store, never in commits, PR text, logs or chat. Generate random secrets yourself and write them straight into `.env` without printing them.
- Before every push: `bun install --frozen-lockfile`, `bunx tsc --noEmit`, `bun run lint` (from task 1.1 on), `bun run test`, `bun run build`. Logic changes get tests. A new environment variable goes into `.env.example` and DEPLOY.md, and into `/api/public/health` when it switches a feature on.
- The PR that finishes a task ticks its box here and updates `roadmap.md`. If a task turns out wrong or impossible, change this plan in the same PR and say why.
- Save tokens: open only the files a task names; skip `bun.lock`, `src/integrations/supabase/types.ts`, `src/routeTree.gen.ts` and old migrations unless the task needs them; run single test files while iterating (`bunx vitest run src/test/<file>`) and the full suite before pushing.

## Where things stand (2026-10-06)

- PR #2 (review fixes) and PR #3 (standalone: own Supabase, any OpenAI-compatible AI, own Google OAuth for Gmail, direct Firecrawl API, plain Vite build) are merged.
- The typecheck passes, 98 tests pass and the build works. `bun run lint` passes (7 `react-refresh` warnings) since task 1.1. CI runs on every pull request since task 1.3.
- Nothing has run against real AI, Firecrawl or Google accounts yet, and the portal helper has never run on a real posting.
- The agent's autonomy setting (Review-first, Guided, High autonomy) is saved but changes nothing.
- Pasted job-board links and links in LinkedIn and Indeed alert emails are fetched on the server through Firecrawl, which those boards' terms forbid; task 2.5 stops that.
- **Find roles now** runs one Firecrawl web search (the first target title and location) for up to 8 roles; task 2.5 moves Greenhouse, Lever and Ashby to their public APIs.
- The premortem found three inbox defects, which task 2.6 fixes. After the first sync, `syncGmailForUser` takes every new inbox message, sends it in full to the AI provider, stores its sender and subject, and puts anything unmatched into the review queue, which shows informational mail too. One message the AI can't classify fails every later sync. One 402 or 403 from the AI provider pauses Gmail until the user disconnects and reconnects.
- A review of similar projects found that career-ops (MIT licence, ~73,600 stars) already does most of what Phases 5–11 planned. STRATEGY.md records the comparison, the three-track decision and the owner's open decisions.
- Open roadmap items: the Track N fixes, the real Gmail walk-through, Gmail live push, Tracks A and B, and the gated phases.

## Tracks and gates

| Track | What | Where |
|---|---|---|
| N | Keep Nexus safe, honest and working: Phases 0–3, and 4 if wanted | This repository |
| A | Contribute Nexus's distinctive pieces to career-ops; the owner uses career-ops for their own search | The owner's fork of career-ops (section "Track A" below) |
| B | Test demand for a hosted, Arabic-first product for job seekers in MENA who don't use developer tools | Interviews and a prototype with made-up data (section "Track B" below) |

- [ ] **Gate 1: demand. [owner]** Tick it when Track B meets the thresholds set in B.1. It opens, in this order unless the owner reorders them: 12.1–12.3 (compliance and hardening, before any hosted pilot), Phase 10 (Arabic interface), Phase 5, 8.3 (approvals in a messaging app), 6.1–6.2 (daily and approval queues), Phase 9 and the rest of Phase 8. The first PR after the tick rewrites these phases for the hosted product, reusing career-ops' MIT-licensed job sources where they fit.
- [ ] **Gate 2: pilot. [owner]** Tick it when a hosted pilot (only after 12.1–12.3) has had at least 10 weekly active users for 4 weeks. It opens 6.3–6.5 (submission and autonomy modes), Phase 7 (browser extension), Phase 11 (MCP server and chat apps) and 12.4–12.6 (billing, institutions, referrals).
- **Dates.** Phase 0's owner steps by 20 October 2026; Phase 3 by 30 November 2026; Track B interviews by 30 November 2026; the Gate 1 decision by 31 December 2026.
- **Fallback.** If Gate 1 isn't ticked by 31 December 2026, Nexus stays a personal tool: the next PR removes Phases 5–12 from this plan (git history keeps them), Track N keeps `main` safe, and new feature work goes upstream through Track A.

## Phase 0: run locally

- [x] **0.1 [owner] Merge PR #3** (done 2026-10-05).
- [ ] **0.1b [owner] Old Lovable copy:** if it holds data you want to keep, download it there (**Settings → Download my data**), then unlink the repo in Lovable. While the repo is linked, Lovable picks up this code and its copy loses AI, Gmail, job-link reading and Google sign-in.
- [ ] **0.2 [owner] Create a Supabase project** (free tier, a nearby region such as Frankfurt). Under **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` and add `http://localhost:3000/auth` as a redirect URL. **[claude]** then runs `npx supabase login` (the owner finishes the browser step), `npx supabase link --project-ref <ref>` and `npx supabase db push` (asks for the database password), and checks that all 19 migrations applied.
- [ ] **0.3 [owner] Google Cloud:** enable the Gmail API; set up the OAuth consent screen, now under Google Auth Platform (External, Testing, scopes `openid`, `email` and `https://www.googleapis.com/auth/gmail.readonly`, your address under Test users); create a Web application OAuth client with the redirect URI `http://localhost:3000/oauth/gmail/return`. Optional: turn on Supabase's Google provider for "Continue with Google" (DEPLOY.md, section 1).
- [ ] **0.4 [claude] Create `.env`** from `.env.example`, generating `APP_USER_CONNECTION_KEY_SECRET` (`openssl rand -base64 32`) and `AGENT_TICK_SECRET` (`openssl rand -hex 32`). **[owner]** supplies the Supabase URL and keys, the AI provider (`AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`), a Firecrawl key, and the Google client ID and secret.
- [ ] **0.5 [claude] Run it** with `docker compose up -d --build`, or `bun run build` then `node --env-file=.env .output/server/index.mjs` (the built server doesn't read `.env` by itself). Expect `http://localhost:3000/api/public/health` to show database, ai, jobLinkReading, gmail and scheduler as true. **[owner]** signs up and imports the sponsor register (**Sponsor check → Check for a newer register**).

## Phase 1: repo hygiene and CI [claude]

- [x] **1.1 Format once** (done in this PR, except the `.git-blame-ignore-revs` entry, which needs the merged commit and goes in the 1.2 PR), in its own PR with no logic changes, merged before other branches open because it touches almost every file. Add `src/integrations/supabase/types.ts` to `.prettierignore`, then run Prettier only on what ESLint checks (`src`, `worker` and root config files) so the docs don't churn. `bun run lint` must then exit 0 (the `format` script is now `eslint . --fix`, because the Prettier CLI and ESLint's Prettier plugin disagree on some member chains); the 7 `react-refresh/only-export-components` warnings may stay. After it merges, add the commit it landed as on `main` to `.git-blame-ignore-revs` (a squash merge changes the hash; done in the 1.2 PR, commit `5a3fc6e`).
- [x] **1.2 Scripts and ports:** add `"typecheck": "tsc --noEmit"` and `"check": "bun run typecheck && bun run lint && bun run test && bun run build"` to `package.json`. Move the dev server in `vite.config.ts` from port 8080 to 3000 so development, Docker and production share one set of localhost redirect URIs, and update every mention of 8080 (grep). In DEPLOY.md, start the built server with `node --env-file=.env .output/server/index.mjs`.
- [x] **1.3 CI:** `.github/workflows/ci.yml` on pull requests and pushes to `main`: checkout, `oven-sh/setup-bun@v2`, `bun install --frozen-lockfile`, then typecheck, lint, test, build (with placeholder `VITE_SUPABASE_*` values) and `for f in worker/*.mjs; do node --check "$f"; done`. A second job runs `docker build .` on pushes to `main`. If GitHub refuses the push because the token can't change workflows, ask the owner to add the file in GitHub's web editor.
- [x] **1.4 Migration replay test,** so SQL mistakes like the old 42P10 upsert fail CI. Add `@electric-sql/pglite` as a dev dependency and `src/test/migrations.test.ts` (`// @vitest-environment node`). Before replaying `supabase/migrations/*.sql` in filename order, create small stand-ins for what Supabase provides: roles `anon`, `authenticated` and `service_role`; schemas `extensions`, `auth` (with `auth.users` and `auth.uid()` returning `nullif(current_setting('request.jwt.claim.sub', true), '')::uuid`) and `storage` (with `buckets`, `objects` and `storage.foldername()`); `pg_trgm` from `@electric-sql/pglite/contrib`. Stub anything else PGlite lacks inside the test and never edit old migrations. Then assert that a duplicate user job insert fails with `23505`, that `match_sponsor_company_v3` finds an exact and a fuzzy name, and that the `portal_tasks` insert policy rejects another user's application, a non-https link and `https://169.254.169.254/` (use `set role authenticated` plus the `sub` setting).
- [ ] **1.5 Housekeeping:** add `"db:types": "supabase gen types typescript --linked > src/integrations/supabase/types.ts"`, and a rule in AGENTS.md that a PR adding a migration regenerates the types. Once the owner confirms the Lovable project is unlinked, delete `.lovable/` (git history keeps the old plans).

## Phase 2: lock down before going public [claude]

Anyone who reaches a public instance can sign up and spend the owner's AI and Firecrawl credit.

- [ ] **2.1 Allowlist:** `ALLOWED_EMAILS`, comma-separated addresses or `@domain` entries; empty keeps today's behaviour. Enforce it in `src/integrations/supabase/auth-middleware.ts` so every server function returns 403 ("This Nexus instance is private"), and skip users who aren't allowed in `runAgentTick` (`src/server/agentRunner.server.ts`). Unit-test the matching (case, spaces, domain entries). In DEPLOY.md, tell the owner to switch off **Allow new users to sign up** in Supabase's Auth settings once their account exists.
- [ ] **2.2 Daily usage caps:** `AI_DAILY_LIMIT` and `FIRECRAWL_DAILY_LIMIT` per user; empty means unlimited. A new migration adds `usage_counters (user_id, day, kind, count)` with RLS on and no client policies, and a `security definer` function `consume_usage(p_user uuid, p_kind text, p_limit int) returns boolean` that increments atomically; revoke `execute` on it from `public`, `anon` and `authenticated` so only the server's service-role client can call it. Give `generateStructured` (`src/lib/ai.server.ts`) and the `firecrawl()` helper (`src/lib/discovery.server.ts`) a required `userId` and check the cap inside them, so the typecheck finds every caller and none can skip it. Over the limit, fail with 429 "Daily AI limit reached; it resets at midnight UTC". Cover the function in the 1.4 replay test and regenerate the types.
- [ ] **2.3 HTTPS option:** a `caddy` service in `docker-compose.yml` under an `https` profile, a `Caddyfile` (`{$DOMAIN}` → `reverse_proxy web:3000`, a persistent data volume) and a DEPLOY.md section. Let the `web` port be bound to localhost when Caddy fronts it, e.g. `ports: ["${WEB_BIND:-0.0.0.0}:3000:3000"]`.
- [ ] **2.4 Gmail push audience behind a proxy:** `src/routes/api/public/gmail-push.ts` builds the expected token audience from `request.url`, which can read `http://` behind a TLS proxy. Use `GMAIL_PUBSUB_AUDIENCE` first, then `${APP_URL}/api/public/gmail-push`, then the request URL, with a test.
- [ ] **2.5 Board-safe job intake:** LinkedIn's terms forbid automated access, and other job boards' terms are similar (see STRATEGY.md). Add one host policy in `src/lib/jobSources.ts`, unit-tested: job boards (linkedin.com, indeed.com, glassdoor.com, bayt.com, naukrigulf.com, gulftalent.com, wuzzuf.net and their subdomains) are never fetched by the server. Enforce it in `extractPublicJob` and `searchPublicJobs` (`src/lib/discovery.server.ts`), in the alert import in `src/server/gmailSync.server.ts` and in `JOB_LINK_DOMAINS` (`src/lib/mailMatch.ts`). For LinkedIn and Indeed alert emails, read the title, company and location from the email itself and save them as leads that keep the alert link for the user to open. When the user pastes a job-board link, ask for the job description text and extract from that text with `generateStructured`. Read Greenhouse, Lever and Ashby postings through their public JSON APIs instead of Firecrawl (cheaper and steadier); Firecrawl stays for other employer career pages. Recognise alert emails from the Gulf boards above as alerts rather than recruiter mail, and skip them until a parser exists (parsers are Track A work, A.3). Update README's product boundaries to match.
- [ ] **2.6 Inbox safety,** from the premortem, in `syncGmailForUser` (`src/server/gmailSync.server.ts`), `src/lib/mailMatch.ts` and the review queue (`src/components/ReviewQueue.tsx`, `useUnmatchedMail` in `src/lib/data.ts`):
  - **Filter before any AI call.** List new messages with `format=metadata` (From, Subject and label ids) first. Fetch a message in full, classify it or store anything about it only when its sender's domain is a known recruiting system or job-alert sender (a list in `mailMatch.ts`), belongs to an employer the user has applied to (`senderIsCompany`), or its subject matches recruitment keywords. Skip `CATEGORY_PROMOTIONS` and `CATEGORY_SOCIAL`. For any other message, keep only its id as skipped, so it is never read again.
  - **Queue only what needs a decision.** Unmatched mail classified as `informational` is not added to `unmatched_mail_messages`, and the review queue hides any that already exist.
  - **One bad message never blocks the sync.** Catch errors per message, count attempts, mark a message skipped with its reason after 3 failures, and keep advancing the sync position.
  - **Recover from a paused AI key.** A 402 or 403 from the AI provider pauses the sync with a plain reason ("The AI provider rejected the key or is out of credits"). The agent retries a paused sync once a day, and a successful retry or **Check inbox now** clears the pause.
  - **Treat mail as untrusted.** The classifier prompt delimits the email and tells the model never to follow instructions inside it.
  - **Scam signals.** Mail from free-mail domains, or asking for fees or visa payments, is marked as a possible scam in the review queue and never moves an application, even when it names the employer and role.
  - **Stale-sync banner.** Today and Connections show a banner when Gmail or the scheduler hasn't succeeded for 24 hours.
  - **Tests** with a fixture mailbox and a stubbed AI provider: personal mail is skipped without an AI call; a message that always fails is skipped after 3 attempts and later mail still syncs; a paused sync recovers; the classifier prompt delimits mail text; a free-mail "offer" naming an applied employer doesn't move the application.

## Phase 3: deploy and verify with real accounts

- [ ] **3.1 [owner] Server and domain:** a small VPS (1 vCPU, 1–2 GB, Ubuntu) and a domain or subdomain whose A record points at it. Give Claude Code SSH access or run the commands it prepares.
- [ ] **3.2 [claude] Deploy:** install Docker, clone the repo, copy `.env` over SSH (never through git), set `APP_URL=https://<domain>` and `DOMAIN`, run `docker compose --profile https up -d --build`, and check `https://<domain>/api/public/health`.
- [ ] **3.3 [owner] Point the services at the domain:** in Supabase, Site URL `https://<domain>` and redirect URL `https://<domain>/auth`; in Google Cloud, redirect URI `https://<domain>/oauth/gmail/return`. Set `ALLOWED_EMAILS`, and switch off Supabase sign-ups after signing up.
- [ ] **3.4 [owner + claude] Live walk-through.** For each failure, open a small PR with a regression test.
  - [ ] Health shows database, ai, jobLinkReading, gmail and scheduler as true.
  - [ ] Email sign-in works, and Google sign-in if it's enabled.
  - [ ] The sponsor register import finishes (about 140,000 rows) and a known sponsor matches.
  - [ ] Career Vault: an uploaded CV is extracted by the AI provider, and items can be verified.
  - [ ] Discover: a pasted Greenhouse or Lever link saves real fields; **Find roles now** adds roles or reports why not.
  - [ ] The tailored resume and cover letter pass the fact-check; the PDF and Word downloads open.
  - [ ] Gmail: Connect, consent, then **Check inbox now** matches or queues recruiter mail; **Disconnect** removes the app at myaccount.google.com/connections; reconnecting works. This ticks the roadmap's "Real Gmail walk-through".
  - [ ] Inbox safety (2.6): personal mail never reaches the AI provider or the review queue, and a paused sync recovers once the AI key works again.
  - [ ] Agent: switch it on, **Run now**, and see scheduled runs every 15 minutes in the activity log.
  - [ ] Settings: the data export downloads.
  - [ ] Portal helper (optional): after `docker compose --profile portal up -d --build`, **Prepare in portal** on a real Lever or Greenhouse posting fills routine fields, saves a screenshot and stops before submit. Keep the Playwright version in `worker/package.json` equal to the image tag in `worker/Dockerfile`.
  - [ ] If the AI provider rejects `json_schema` with an error the fallback doesn't recognise, widen the check in `src/lib/ai.server.ts` and add a test case.
- [ ] **3.5 [owner] Know the Gmail limit:** while the consent screen is in Testing, Google expires refresh tokens after 7 days, so the app asks to reconnect weekly. Google's help pages also describe putting an unverified app in production: connecting then shows an "unverified app" warning, and the project can only ever add 100 new users, though Google says user-facing apps should be verified. For a one-person instance, try that route during 3.4 and record the result in DEPLOY.md.

## Phase 4: Gmail live push (roadmap)

Needs 2.4 and the HTTPS deployment.

- [ ] **4.1 [claude]** Add these commands to DEPLOY.md after checking them against Google's current Pub/Sub docs. Run them if `gcloud` is signed in to the owner's project; otherwise the owner runs them.
  ```sh
  P=<project-id>
  gcloud services enable pubsub.googleapis.com iam.googleapis.com --project "$P"
  gcloud pubsub topics create nexus-gmail --project "$P"
  gcloud pubsub topics add-iam-policy-binding nexus-gmail --project "$P" \
    --member=serviceAccount:gmail-api-push@system.gserviceaccount.com --role=roles/pubsub.publisher
  gcloud iam service-accounts create nexus-gmail-push --project "$P"
  gcloud pubsub subscriptions create nexus-gmail-push --project "$P" --topic=nexus-gmail \
    --push-endpoint="https://<domain>/api/public/gmail-push" \
    --push-auth-service-account="nexus-gmail-push@$P.iam.gserviceaccount.com"
  ```
- [ ] **4.2 [claude]** Set `GMAIL_PUBSUB_TOPIC=projects/<project-id>/topics/nexus-gmail` and `GMAIL_PUBSUB_SERVICE_ACCOUNT=nexus-gmail-push@<project-id>.iam.gserviceaccount.com`, then restart. The next agent run, or reconnecting Gmail, registers the watch.
- [ ] **4.3 [owner + claude] Verify:** health shows `gmailLiveUpdates: true`; a test email shows up in the app within about a minute; the activity log shows `renew_gmail_watch` before the 7-day watch expires. Tick the roadmap item.

## Phase 5: role-agnostic foundations (Gate 1)

Behind Gate 1. Needs Phase 1. Compare with career-ops first: search settings in `config/profile.yml`, form answers in
`application-answers.mjs`, outcomes in `outcome.mjs`.

- [ ] **5.1 Search profiles.** Replace the single set of targets on `profiles` (`target_titles`, `target_locations` and the related columns) with a user-scoped `search_profiles` table (RLS): name, target titles, keywords, seniority, countries and cities, remote, minimum salary and currency, whether a visa is needed per country, excluded companies, and which CV variant to use. Move existing targets into a first profile. Discovery, **Find roles now** and fit scoring (`src/lib/scoring.ts`) take a profile as input. Remove anything tied to one profession or one country (grep for hard-coded titles and UK defaults).
- [ ] **5.2 CV variants.** Several CV versions per user (different titles or emphasis), each built only from verified Career Vault items. Each search profile picks one, and the ATS exports work per variant.
- [ ] **5.3 Answer bank.** The user's own answers to common form questions: notice period, expected salary per currency, right to work and visa status per country, relocation, availability, links. The user writes them; they are never generated. Application kits, the extension and any form filling use them.
- [ ] **5.4 Outcome fields.** For each application, record the source (alert email, ATS feed, pasted text, referral), the channel used to submit, when it was submitted, when the first reply came, and the outcome. Backfill from `application_events`. Outcome analytics (8.4) build on these.

## Phase 6: supervised autopilot (Gates 1 and 2)

6.1–6.2 are behind Gate 1 and 6.3–6.5 behind Gate 2. Replaces the old "autonomy modes" phase. Needs Phase 5. **[owner] Confirm the automation policy in STRATEGY.md before any code is written.**

- [ ] **6.1 Daily queue.** On each run, the agent gathers new roles for each search profile (ATS feeds, alert emails, pasted roles), scores them, and prepares an application kit for the high-fit ones: the tailored CV variant, a cover letter and answers from the answer bank, all through the existing fact-check (`validateBulletProvenance` and the cover-letter audit).
- [ ] **6.2 Approval queue.** A "Ready to send" list on Today: approve, edit or skip each kit, or approve a whole batch. Nothing is submitted without approval. It must work well on a phone.
- [ ] **6.3 Submission channels,** in order of preference: an employer's own API access where the employer has granted it (Greenhouse, Lever and Ashby application endpoints, set up per employer); the browser extension (Phase 7) for hosted forms; otherwise a copy-ready kit with the link. Automatic submission is a setting that is off by default, works only for channels on an allowlist (at first, employer API access only), is capped per day (default 10, at most 30), and never applies to LinkedIn.
- [ ] **6.4 Proof log.** An append-only `application_submissions` table: application, channel, time, what was sent (CV variant and file hash, cover letter, answers) and the confirmation (email, ATS confirmation text, screenshot path). Shown on each application and included in the data export.
- [ ] **6.5 Autonomy modes.** Map the existing modes onto the policy: Review-first approves each kit, Guided approves in batches, High autonomy allows opt-in automatic submission where it is allowed. Put this in a pure `src/lib/agentPolicy.ts` (`policyFor(mode)`, unknown modes treated as Review-first) with a test for every case, used by `runForUser` (`src/server/agentRunner.server.ts`) and `syncGmailForUser` (`src/server/gmailSync.server.ts`). Rewrite the mode hints in `src/components/AgentPanel.tsx` to match.

## Phase 7: browser extension for application forms (Gate 2)

Behind Gate 2. Needs 6.2–6.4. Ask for site access when the user clicks (`activeTab` and optional host permissions)
rather than at install, so the install warning stays small.

- [ ] **7.1** A Chrome extension (Manifest V3) in `extension/`, connected to the user's Nexus instance with a scoped, revocable token from a "Connect extension" page. It fills forms on supported ATS sites (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Workday) from the approved kit and the answer bank, attaches the chosen CV file, and highlights anything it couldn't fill. Port the field logic from `worker/adapters.mjs`.
- [ ] **7.2** The user presses Submit; for a batch-approved kit the extension may offer "Submit now" once. Its host permissions exclude linkedin.com and the other job boards, with a test.
- [ ] **7.3** After submission it records proof (page URL, time, confirmation text, optional screenshot) in the proof log.
- [ ] **7.4** Build script, store listing and privacy disclosure. **[owner]** publishes it in the Chrome Web Store.
- [ ] **7.5** Once the extension covers the same sites, retire the server-side portal worker (`worker/`) and its compose profile.

## Phase 8: monitoring, follow-ups and nudges (Gate 1)

Behind Gate 1. Needs 5.4. Compare with career-ops' follow-up cadence, weekly digest and pattern analysis first.

- [ ] **8.1 Follow-ups.** After 5–7 days without a reply, draft a follow-up (checked like cover letters) that the user sends from their own mail (an "Open in Gmail" compose link, or copy). No permission to send mail is requested.
- [ ] **8.2 Digest.** A daily and a weekly summary, in the app and by email: new matches, approvals waiting, replies, follow-ups due, interviews. Interviews also download as calendar files (.ics), so no calendar permission is needed.
- [ ] **8.3 Messaging channel.** **[owner]** chooses Telegram (free) or WhatsApp Business (paid, template rules) first. **[claude]** builds alerts and one-tap approve or skip for the queue in that channel, linked to the user's account.
- [ ] **8.4 Outcome analytics.** Interviews per 100 applications by source, role, country and CV variant, and time to first reply. Shown in Insights and used by the weekly review to suggest changes to search profiles.
- [ ] **8.5 More inboxes.** Outlook through Microsoft Graph (read-only) and, for a hosted version, a personal forwarding address that receives job emails without any Gmail access.

## Phase 9: visa and mobility (Gate 1)

Behind Gate 1. Needs Phase 1. The UK sponsor plugin for career-ops (A.2) comes first, and this phase reuses its approach.

- [ ] **9.1** Country modules in `src/lib/visa/` with one interface (country, data source, last refresh, employer check, notes). The UK sponsor register becomes the first module.
- [ ] **9.2** Gulf basics: per-country work-permit notes and any official lists of professions reserved for nationals, taken only from official sources with dates. The phase's first PR researches and proposes the sources.
- [ ] **9.3** More public sponsor data, each with its source, date and a scheduled refresh: the Netherlands' register of recognised sponsors, Canada's list of employers with positive LMIAs, and US H-1B employer data.
- [ ] **9.4** Visa status on every role card and in the daily queue, with a "needs sponsorship" filter per search profile.

## Phase 10: Arabic-first interface (Gate 1)

Behind Gate 1. Needs Phase 1. For CV and cover-letter wording, start from what career-ops' Arabic modes already cover
(such as end-of-service gratuity and allowances).

- [ ] **10.1 Direction:** a language setting (English or العربية) kept in a cookie and read on the server in the root route (`src/routes/__root.tsx`), so the first paint already has `<html lang="ar" dir="rtl">`; a switch in Settings and in the sidebar footer; Radix's `DirectionProvider` (`@radix-ui/react-direction`) around the app so menus and popovers mirror.
- [ ] **10.2 Logical CSS:** across `src/`, including `src/components/ui`, replace physical utilities with logical ones (`ml-`/`mr-` → `ms-`/`me-`, `pl-`/`pr-` → `ps-`/`pe-`, `left-`/`right-` → `start-`/`end-`, `text-left`/`text-right` → `text-start`/`text-end`, `border-l`/`border-r` → `border-s`/`border-e`, `rounded-l`/`rounded-r` → `rounded-s`/`rounded-e`), and flip arrow icons with `rtl:rotate-180`.
- [ ] **10.3 Font:** a self-hosted Arabic font from an `@fontsource` package (for example IBM Plex Sans Arabic or Noto Sans Arabic), used only when `lang="ar"`; no font CDN.
- [ ] **10.4 Text:** a small typed dictionary (`src/lib/i18n/en.ts`, `ar.ts`) and a `t()` helper rather than an i18n library, typed so a missing Arabic key fails the typecheck. Translate the navigation and the Today, Discover, Applications, Connections and Settings screens first, then the rest.
- [ ] **10.5 Checks:** a test that the cookie sets `dir`, and Playwright screenshots of the main screens in both directions for the owner to review.
- [ ] **10.6 Arabic and Gulf CVs:** Arabic and English CV variants, and a Gulf CV template with the fields often expected there (such as nationality and visa status), all optional. Export Arabic CVs to Word first (the `docx` library leaves text shaping to Word); add Arabic PDFs only after confirming the PDF renderer shapes real Arabic text correctly.

## Phase 11: MCP server and chat apps (Gate 2)

Behind Gate 2. Needs Phase 6. JobSync already ships an MCP server; compare before outlining.

- [ ] **11.1** A remote MCP endpoint in Nexus (for example `/api/mcp`), authenticated per user, with tools for today's queue, searching roles, tailoring for a role, approving or skipping a kit, application status and notes. Approvals made through MCP follow the same rules as Phase 6.
- [ ] **11.2** Listings as a Claude connector and a ChatGPT app. **[owner]** submits them.
- [ ] **11.3** The separate LinkedIn Career Copilot MCP stays outside Nexus as a personal tool; nothing in Nexus calls it.

## Phase 12: hosted version and compliance (Gates 1 and 2)

12.1–12.3 open with Gate 1 and must be finished before anyone else's data is stored on a server the owner runs;
12.4–12.6 open with Gate 2.

- [ ] **12.1 [owner]** Get legal advice. For Egypt: the data-protection licence or permits, a data protection officer and records of processing (the grace period ends around 1 November 2026). Publish a privacy notice and terms. Decide whether the hosted version reads Gmail (which needs Google's CASA assessment) or uses forwarding and Outlook only. Choose a payment provider.
- [ ] **12.2 [claude]** A data inventory (what is stored, where, why and for how long), retention rules with periods the owner sets, a breach-response runbook with the 72-hour notice, and a list of which AI providers receive which data. Choose the Supabase region to match.
- [ ] **12.3 [claude]** Multi-tenant hardening on top of Phase 2: per-user limits, logged admin access, daily backups (a `backup` compose profile running `pg_dump` and keeping 14 days) with a tested restore, and an account-deletion check that covers every table and storage bucket.
- [ ] **12.4 [claude]** Billing: plans per market (weekly, monthly or per search), entitlements in the database, payment webhooks, and the daily caps from 2.2 tied to plans.
- [ ] **12.5 [claude]** Institutions: invite codes, seat management and a cohort dashboard showing anonymised progress.
- [ ] **12.6 [claude]** Referral credit when a user reports a hire.

## Phase 13: optional, only when the owner asks

- [ ] **13.1 Import an export file** to move data from the Lovable-hosted app: an authenticated server function that reads the **Download my data** JSON, validates it with zod, gives rows new ids while keeping their links (jobs, applications, events, vault items), reuses catalog jobs by `canonical_url`, and can safely run twice. Test it on a PGlite fixture.
- [ ] **13.2 Error reporting:** optional `SENTRY_DSN` (also works with self-hosted GlitchTip) for server and browser errors, off when unset; it replaces the Lovable error reporter that was removed.
- [ ] **13.3 End-to-end smoke test:** Playwright against local Supabase (`npx supabase start`) covering sign-up, adding a role and tailoring with a stubbed AI server, run nightly in CI.

## Track A: contributions to career-ops

Runs now, alongside Track N. The work happens in the owner's fork of
[career-ops-hq/career-ops](https://github.com/career-ops-hq/career-ops), as one pull request per item to career-ops,
following its CONTRIBUTING.md, GOVERNANCE.md and DATA_CONTRACT.md. Nexus's own rules still apply there: no job-board
automation, and claims only from the user's own records.

- [ ] **A.0 [owner]** Fork career-ops on GitHub and attach the fork to the Claude Code session. Before each larger item, open an issue or discussion upstream and link it here.
- [ ] **A.1 Gmail reply feed** (career-ops issue #1583): a plugin that reads only a Gmail label the user chooses, like its existing `plugins/gmail` lead ingest. It keeps only DMARC-passing mail, writes candidates to `data/reply-candidates.json` for `reply-watch.mjs`, never sends, moves or deletes mail, and leaves every tracker change to the user's approval. Bring over lessons from Nexus's `src/lib/mailMatch.ts` only where career-ops' `reply-matcher.mjs` lacks them.
- [ ] **A.2 UK sponsor plugin,** modelled on its `plugins/h1b-sponsor`: a local index built from the Home Office register CSV and refreshed on demand; name matching with legal-suffix normalisation and a confidence threshold (the approach of Nexus's `match_sponsor_company_v3`); it returns the register entry (routes and rating) or "unknown", never a guess, and nothing leaves the user's machine.
- [ ] **A.3 Gulf alert-email parsers** for Bayt, Naukrigulf, GulfTalent and Wuzzuf, reading a label the user chooses. **[owner]** first checks each site's terms, and supplies a few of their own alert emails, anonymised, as test fixtures.
- [ ] **A.4 Arabic and Gulf CV templates** for career-ops' CV generators, with the fields often expected in the Gulf (all optional) and an ATS-safe English counterpart. Add Arabic PDFs only after confirming the renderer shapes Arabic text correctly.
- [ ] **A.5 [owner]** Use career-ops for the owner's own search, and file what's missing as upstream issues rather than building it in Nexus.

## Track B: demand test for a hosted MENA product

Runs now, alongside Track N. No real user data is collected or hosted until Gate 1 and Phase 12.1–12.3; interview notes
stay with the owner, outside this repository.

- [ ] **B.1 [owner] Set the pass thresholds here before the first interview.** Suggested: at least 6 of 10 interviewees would use it every week during a search, and at least 3 would pay a stated price.
- [ ] **B.2 [claude] Test kit:** a one-page description in Arabic and English; a 20-minute interview guide (how they search now, the tools they use, what wastes their time, how they'd feel about approving applications in WhatsApp or Telegram, what they would pay); and a clickable prototype of three screens (today's queue, approving a kit, reply tracking) built with made-up data only. The kit lives in `docs/demand-test/` and contains no personal data.
- [ ] **B.3 [owner] Interviews:** 10–15 job seekers in Egypt and the Gulf who don't use developer tools, across several kinds of role (not only tech), by 30 November 2026.
- [ ] **B.4 [claude] Summary** of the anonymised notes against the thresholds.
- [ ] **B.5 [owner] Decision** by 31 December 2026: tick Gate 1, or take the fallback in "Tracks and gates". If ticking Gate 1, book the legal advice in 12.1 straight away.
