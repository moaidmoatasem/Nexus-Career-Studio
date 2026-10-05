# Plan: finishing Nexus Career Studio

Written 2026-10-06 so Claude Code can work through the rest of the project in order. Project rules are in
[AGENTS.md](AGENTS.md); setup details are in [DEPLOY.md](DEPLOY.md).

## How to work through this plan

- Order: 0 → 1 → 2 → 3 → 4. Phases 5 and 6 only need Phase 1 and can go in any order. Phase 7 waits for the owner.
- Take the first unchecked task whose prerequisites are done. Each phase is one branch and one pull request against `main`; split a big phase into several PRs. Never merge, never push to `main`, never rewrite published history: the owner merges.
- **[owner]** marks steps only the repository owner can do: accounts, dashboards, payments, DNS, servers, a real mailbox. Prepare everything around them, then ask one precise question and wait. **[claude]** steps need no one.
- Secrets live only in `.env` (git-ignored) or the host's secret store, never in commits, PR text, logs or chat. Generate random secrets yourself and write them straight into `.env` without printing them.
- Before every push: `bun install --frozen-lockfile`, `bunx tsc --noEmit`, `bun run lint` (from task 1.1 on), `bun run test`, `bun run build`. Logic changes get tests. A new environment variable goes into `.env.example` and DEPLOY.md, and into `/api/public/health` when it switches a feature on.
- The PR that finishes a task ticks its box here and updates `roadmap.md`. If a task turns out wrong or impossible, change this plan in the same PR and say why.
- Save tokens: open only the files a task names; skip `bun.lock`, `src/integrations/supabase/types.ts`, `src/routeTree.gen.ts` and old migrations unless the task needs them; run single test files while iterating (`bunx vitest run src/test/<file>`) and the full suite before pushing.

## Where things stand (2026-10-06)

- PR #2 (review fixes) is merged. PR #3 makes the app standalone: own Supabase, any OpenAI-compatible AI, own Google OAuth for Gmail, direct Firecrawl API, plain Vite build. It is open.
- The typecheck passes, 98 tests pass and the build works. `bun run lint` fails on 2,143 Prettier formatting errors that predate both PRs. There is no CI.
- Nothing has run against real AI, Firecrawl or Google accounts yet, and the portal helper has never run on a real posting.
- The agent's autonomy setting (Review-first, Guided, High autonomy) is saved but changes nothing.
- Open roadmap items: real Gmail walk-through, Gmail live push, Arabic RTL toggle.

## Phase 0: merge and run locally

- [ ] **0.1 [owner] Merge PR #3.** First download a copy of your data from the old Lovable-hosted app (**Settings → Download my data**). While the repo is linked to the Lovable project, the merge syncs there too and that copy loses AI, Gmail, job-link reading and Google sign-in; unlink the repo in Lovable first if the old copy should keep working.
- [ ] **0.2 [owner] Create a Supabase project** (free tier, a nearby region such as Frankfurt). Under **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` and add `http://localhost:3000/auth` as a redirect URL. **[claude]** then runs `npx supabase login` (the owner finishes the browser step), `npx supabase link --project-ref <ref>` and `npx supabase db push` (asks for the database password), and checks that all 19 migrations applied.
- [ ] **0.3 [owner] Google Cloud:** enable the Gmail API; set up the OAuth consent screen, now under Google Auth Platform (External, Testing, scopes `openid`, `email` and `https://www.googleapis.com/auth/gmail.readonly`, your address under Test users); create a Web application OAuth client with the redirect URI `http://localhost:3000/oauth/gmail/return`. Optional: turn on Supabase's Google provider for "Continue with Google" (DEPLOY.md, section 1).
- [ ] **0.4 [claude] Create `.env`** from `.env.example`, generating `APP_USER_CONNECTION_KEY_SECRET` (`openssl rand -base64 32`) and `AGENT_TICK_SECRET` (`openssl rand -hex 32`). **[owner]** supplies the Supabase URL and keys, the AI provider (`AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`), a Firecrawl key, and the Google client ID and secret.
- [ ] **0.5 [claude] Run it** with `docker compose up -d --build`, or `bun run build` then `node --env-file=.env .output/server/index.mjs` (the built server doesn't read `.env` by itself). Expect `http://localhost:3000/api/public/health` to show database, ai, jobLinkReading, gmail and scheduler as true. **[owner]** signs up and imports the sponsor register (**Sponsor check → Check for a newer register**).

## Phase 1: repo hygiene and CI [claude]

- [ ] **1.1 Format once,** in its own PR with no logic changes, merged before other branches open because it touches almost every file. Add `src/integrations/supabase/types.ts` to `.prettierignore`, then run Prettier only on what ESLint checks (`src`, `worker` and root config files) so the docs don't churn. `bun run lint` must then exit 0; the 7 `react-refresh/only-export-components` warnings may stay. After it merges, add the commit it landed as on `main` to `.git-blame-ignore-revs` (a squash merge changes the hash).
- [ ] **1.2 Scripts and ports:** add `"typecheck": "tsc --noEmit"` and `"check": "bun run typecheck && bun run lint && bun run test && bun run build"` to `package.json`. Move the dev server in `vite.config.ts` from port 8080 to 3000 so development, Docker and production share one set of localhost redirect URIs, and update every mention of 8080 (grep). In DEPLOY.md, start the built server with `node --env-file=.env .output/server/index.mjs`.
- [ ] **1.3 CI:** `.github/workflows/ci.yml` on pull requests and pushes to `main`: checkout, `oven-sh/setup-bun@v2`, `bun install --frozen-lockfile`, then typecheck, lint, test, build (with placeholder `VITE_SUPABASE_*` values) and `for f in worker/*.mjs; do node --check "$f"; done`. A second job runs `docker build .` on pushes to `main`. If GitHub refuses the push because the token can't change workflows, ask the owner to add the file in GitHub's web editor.
- [ ] **1.4 Migration replay test,** so SQL mistakes like the old 42P10 upsert fail CI. Add `@electric-sql/pglite` as a dev dependency and `src/test/migrations.test.ts` (`// @vitest-environment node`). Before replaying `supabase/migrations/*.sql` in filename order, create small stand-ins for what Supabase provides: roles `anon`, `authenticated` and `service_role`; schemas `extensions`, `auth` (with `auth.users` and `auth.uid()` returning `nullif(current_setting('request.jwt.claim.sub', true), '')::uuid`) and `storage` (with `buckets`, `objects` and `storage.foldername()`); `pg_trgm` from `@electric-sql/pglite/contrib`. Stub anything else PGlite lacks inside the test and never edit old migrations. Then assert that a duplicate user job insert fails with `23505`, that `match_sponsor_company_v3` finds an exact and a fuzzy name, and that the `portal_tasks` insert policy rejects another user's application, a non-https link and `https://169.254.169.254/` (use `set role authenticated` plus the `sub` setting).
- [ ] **1.5 Housekeeping:** add `"db:types": "supabase gen types typescript --linked > src/integrations/supabase/types.ts"`, and a rule in AGENTS.md that a PR adding a migration regenerates the types. Once the owner confirms the Lovable project is unlinked, delete `.lovable/` (git history keeps the old plans).

## Phase 2: lock down before going public [claude]

Anyone who reaches a public instance can sign up and spend the owner's AI and Firecrawl credit.

- [ ] **2.1 Allowlist:** `ALLOWED_EMAILS`, comma-separated addresses or `@domain` entries; empty keeps today's behaviour. Enforce it in `src/integrations/supabase/auth-middleware.ts` so every server function returns 403 ("This Nexus instance is private"), and skip users who aren't allowed in `runAgentTick` (`src/server/agentRunner.server.ts`). Unit-test the matching (case, spaces, domain entries). In DEPLOY.md, tell the owner to switch off **Allow new users to sign up** in Supabase's Auth settings once their account exists.
- [ ] **2.2 Daily usage caps:** `AI_DAILY_LIMIT` and `FIRECRAWL_DAILY_LIMIT` per user; empty means unlimited. A new migration adds `usage_counters (user_id, day, kind, count)` with RLS on and no client policies, and a `security definer` function `consume_usage(p_user uuid, p_kind text, p_limit int) returns boolean` that increments atomically; revoke `execute` on it from `public`, `anon` and `authenticated` so only the server's service-role client can call it. Give `generateStructured` (`src/lib/ai.server.ts`) and the `firecrawl()` helper (`src/lib/discovery.server.ts`) a required `userId` and check the cap inside them, so the typecheck finds every caller and none can skip it. Over the limit, fail with 429 "Daily AI limit reached; it resets at midnight UTC". Cover the function in the 1.4 replay test and regenerate the types.
- [ ] **2.3 HTTPS option:** a `caddy` service in `docker-compose.yml` under an `https` profile, a `Caddyfile` (`{$DOMAIN}` → `reverse_proxy web:3000`, a persistent data volume) and a DEPLOY.md section. Let the `web` port be bound to localhost when Caddy fronts it, e.g. `ports: ["${WEB_BIND:-0.0.0.0}:3000:3000"]`.
- [ ] **2.4 Gmail push audience behind a proxy:** `src/routes/api/public/gmail-push.ts` builds the expected token audience from `request.url`, which can read `http://` behind a TLS proxy. Use `GMAIL_PUBSUB_AUDIENCE` first, then `${APP_URL}/api/public/gmail-push`, then the request URL, with a test.

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
  - [ ] Agent: switch it on, **Run now**, and see scheduled runs every 15 minutes in the activity log.
  - [ ] Settings: the data export downloads.
  - [ ] Portal helper (optional): after `docker compose --profile portal up -d --build`, **Prepare in portal** on a real Lever or Greenhouse posting fills routine fields, saves a screenshot and stops before submit. Keep the Playwright version in `worker/package.json` equal to the image tag in `worker/Dockerfile`.
  - [ ] If the AI provider rejects `json_schema` with an error the fallback doesn't recognise, widen the check in `src/lib/ai.server.ts` and add a test case.
- [ ] **3.5 [owner] Know the Gmail limit:** while the consent screen is in Testing, Google expires refresh tokens after 7 days, so the app asks to reconnect weekly. Publishing instead requires Google's verification for the `gmail.readonly` scope.

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

## Phase 5: make the autonomy modes real

`runForUser(db, userId, policy)` in `src/server/agentRunner.server.ts` only records the mode today. **[owner] Confirm or edit this table before any code is written.**

| Action | Review-first | Guided | High autonomy |
|---|---|---|---|
| Check the inbox, add job-alert roles to Discover, renew the Gmail watch | yes | yes | yes |
| Move an application after a high-confidence email match | suggest it under **Needs your decision** | yes | yes |
| Follow up when a week passes without a reply | reminder | reminder and a grounded draft | reminder and a grounded draft |
| Draft a resume and cover letter for new roles at or above a fit threshold | no | no | yes |
| Submit anything, send email, answer visa, salary or legal questions | never | never | never |

- [ ] **5.1** A pure `src/lib/agentPolicy.ts` where `policyFor(mode)` returns these permissions, with unknown modes treated as Review-first and a unit test for every cell.
- [ ] **5.2** Pass the permissions through `runForUser` and `syncGmailForUser` (`src/server/gmailSync.server.ts`); the manual **Check inbox now** follows the same mode. Suggestions reuse the existing review-queue records where possible, and every action is logged with its mode (the `policy` column exists).
- [ ] **5.3** Follow-up drafts via `generateStructured`, fact-checked like cover letters, and never sent.
- [ ] **5.4** The fit threshold: a column on `agent_settings` (migration plus types), a control in `src/components/AgentPanel.tsx`, and draft packs for new roles at or above it.
- [ ] **5.5** Rewrite the mode hints in `AgentPanel.tsx` so they match the table exactly.

## Phase 6: Arabic interface, right to left (roadmap)

- [ ] **6.1 Direction:** a language setting (English or العربية) kept in a cookie and read on the server in the root route (`src/routes/__root.tsx`), so the first paint already has `<html lang="ar" dir="rtl">`; a switch in Settings and in the sidebar footer; Radix's `DirectionProvider` (`@radix-ui/react-direction`) around the app so menus and popovers mirror.
- [ ] **6.2 Logical CSS:** across `src/`, including `src/components/ui`, replace physical utilities with logical ones (`ml-`/`mr-` → `ms-`/`me-`, `pl-`/`pr-` → `ps-`/`pe-`, `left-`/`right-` → `start-`/`end-`, `text-left`/`text-right` → `text-start`/`text-end`, `border-l`/`border-r` → `border-s`/`border-e`, `rounded-l`/`rounded-r` → `rounded-s`/`rounded-e`), and flip arrow icons with `rtl:rotate-180`.
- [ ] **6.3 Font:** a self-hosted Arabic font from an `@fontsource` package (for example IBM Plex Sans Arabic or Noto Sans Arabic), used only when `lang="ar"`; no font CDN.
- [ ] **6.4 Text:** a small typed dictionary (`src/lib/i18n/en.ts`, `ar.ts`) and a `t()` helper rather than an i18n library, typed so a missing Arabic key fails the typecheck. Translate the navigation and the Today, Discover, Applications, Connections and Settings screens first, then the rest. Generated documents (resume, cover letter, ATS PDF) stay in the posting's language; Arabic PDFs are out of scope.
- [ ] **6.5 Checks:** a test that the cookie sets `dir`, and Playwright screenshots of the main screens in both directions for the owner to review.

## Phase 7: optional, only when the owner asks

- [ ] **Import an export file** to move data from the Lovable-hosted app: an authenticated server function that reads the **Download my data** JSON, validates it with zod, gives rows new ids while keeping their links (jobs, applications, events, vault items), reuses catalog jobs by `canonical_url`, and can safely run twice. Test it on a PGlite fixture.
- [ ] **Backups:** a `backup` compose profile that runs `pg_dump` daily into a volume and keeps 14 days.
- [ ] **Error reporting:** optional `SENTRY_DSN` (also works with self-hosted GlitchTip) for server and browser errors, off when unset; it replaces the Lovable error reporter that was removed.
- [ ] **End-to-end smoke test:** Playwright against local Supabase (`npx supabase start`) covering sign-up, adding a role and tailoring with a stubbed AI server, run nightly in CI.
