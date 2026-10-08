## Working in this repo
- New here, or one of several agents? Start with [docs/agents/README.md](docs/agents/README.md): read order, checks, branch and PR rules, and the task board.
- Nexus is standalone: it must run on any Node host with a Supabase project, and every other integration stays optional.
- Do not add dependencies on hosted gateways or vendor-specific build plugins; call providers through their public APIs.
- Keep `main` deployable and do not rewrite published history.
- The product direction, automation policy and principles are in STRATEGY.md; the work plan is PLAN.md.
- PLAN.md's gates are binding: work behind a closed gate does not start. Before building a feature, check whether career-ops or JobSync already provides it; if one does, propose contributing there first.
- A PR that adds a migration also regenerates `src/integrations/supabase/types.ts` with `bun run db:types` (needs `npx supabase login` and `npx supabase link`), so the typecheck sees the new schema.

## Architecture rules
- AI calls live in `src/lib/ai.functions.ts` (auth-protected server functions) using `generateStructured` in `src/lib/ai.server.ts`, which talks to any OpenAI-compatible Chat Completions API (`AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`) and validates replies with zod; keys stay server-side.
- Tailored bullets always pass `validateBulletProvenance` before being saved; ungrounded claims must never reach the user.
- Fit scoring is pure and deterministic in `src/lib/scoring.ts`, shared by client display and server packs so scores always match.
- Sponsor matching runs in SQL (`match_sponsor_company_v3`, pg_trgm) so it scales to the full register.
- Jobs with `user_id` null are a shared catalog; user-added jobs are private via RLS.
- Job discovery decisions and application events are user-scoped durable records; the Today view is derived from those records rather than duplicated state.
- Job postings are read on the server only from employer sources: public ATS APIs (Greenhouse, Lever, Ashby) and employer career pages through Firecrawl's v2 API (hosted or self-hosted via `FIRECRAWL_API_URL`). Inaccessible pages fail explicitly and never produce invented job fields.
- Gmail uses the deployment's own Google OAuth client (`src/server/gmailApi.server.ts`): a signed state binds each callback to its user, refresh tokens are AES-GCM encrypted at rest, and tokens are only used by server code; keeps mailbox credentials out of browser-accessible data.
- Recruitment mail advances an application only after a high-confidence multi-signal match; ambiguous messages stay in the user's review queue.
- Mail is minimised before anything else happens: a deterministic filter (known recruiting and job-alert senders, employers the user applied to, recruitment keywords) decides which messages are fetched in full, sent to an AI provider or stored; other mail is skipped and only its id is kept. One message that fails classification never blocks the sync.
- Emails, job postings and pasted text are untrusted data: prompts delimit them and tell the model never to follow instructions inside them, and mail from free-mail senders never moves an application.
- Job boards (LinkedIn, Indeed and others whose terms forbid automated access) are never fetched, scraped or automated by the server, the worker or the extension. Their roles enter only through the user's own alert emails or text the user pastes, and are matched to the employer's own posting where possible.
- Submission follows the supervised-autopilot policy in STRATEGY.md: nothing is submitted without the user's approval (per application or per batch); automatic submission is opt-in, limited to allowlisted channels whose terms permit it, capped per day and never used for LinkedIn; CAPTCHAs and security checks always go to the user; visa, salary and legal answers come only from the user's own answer bank; every submission is written to an append-only log with proof.
- The product is role- and country-agnostic: no logic is tied to one profession or market, and country specifics (visa and sponsor data, CV conventions, languages) live in separate modules.
- Personal data: collect the minimum, let every user export and delete everything, send AI providers only what a task needs, and record which providers receive which data. Storing other people's data on a hosted server requires PLAN.md Phase 12 first.
- The product is open-source and self-hosted first; optional integrations must degrade to manual workflows so the core journey does not require always-on paid services.
- Server code uses Web Crypto and standard APIs only (no Node built-ins); keeps one codebase running on Docker/Node and edge workers.
- The background agent runs via a secret-protected heartbeat route called by an external scheduler, with per-user leases and an append-only activity log; works identically on Docker and edge hosting.
- The optional portal worker is a separate Playwright service that claims portal_tasks via a service-role RPC, fills only non-sensitive fields and always stops before submit; keeps browser automation off the web runtime. The browser extension (PLAN.md Phase 7) replaces it.
