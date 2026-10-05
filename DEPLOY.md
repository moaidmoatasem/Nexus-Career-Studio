# Self-hosting Nexus Career Studio

## 1. Database and auth
Create a Supabase project (cloud or self-hosted) and apply every file in `supabase/migrations/` in order:

```sh
npx supabase link --project-ref <your-ref>
npx supabase db push
```
Enable email sign-in (and Google if wanted). Set the site URL to your domain.

## 2. Configure
Copy `.env.example` to `.env` and fill in values. Keep `.env` out of git.
`APP_USER_CONNECTION_KEY_SECRET` must be 32 random bytes: `openssl rand -base64 32` (a 64-character `openssl rand -hex 32` value also works). Anything else is rejected when Gmail is connected.

## 3. Run with Docker
```sh
docker build \
  --build-arg VITE_SUPABASE_URL=... \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=... \
  --build-arg VITE_SUPABASE_PROJECT_ID=... \
  -t nexus .
docker run -d --env-file .env -p 3000:3000 --restart unless-stopped nexus
```
Put a reverse proxy (Caddy, nginx) in front for HTTPS — Google OAuth requires it.

## 3b. Recommended: Docker Compose (web + background agent)
```sh
cp .env.example .env   # fill in values, incl. AGENT_TICK_SECRET (openssl rand -hex 32)
docker compose up -d --build
curl http://localhost:3000/api/public/health   # shows which capabilities are configured
```
The `scheduler` service wakes the agent every 15 minutes (`AGENT_INTERVAL_SECONDS`), so inbox checks,
Gmail watch renewal and follow-up reminders continue with your browser closed. Turn the agent on in
**Mission Control**. Upgrade: `git pull && docker compose up -d --build`. Roll back: check out the previous
tag and rebuild. Back up: use your database provider's backups (or `pg_dump`) — the app itself is stateless.

## 4. Without Docker
```sh
bun install
NITRO_PRESET=node-server bun run build
node .output/server/index.mjs
```

## 5. Optional integrations
- AI: `LOVABLE_API_KEY` (or swap `src/lib/ai.server.ts` for any OpenAI-compatible endpoint).
- Job-link extraction: `FIRECRAWL_API_KEY`. Without it, add roles manually on **New application**.
- Gmail (step by step):
  1. Google Cloud console → create/select a project.
  2. APIs & Services → Library → enable **Gmail API**.
  3. OAuth consent screen → External; add scopes `gmail.readonly`, `userinfo.email`; add your mailbox under **Test users** while in Testing.
  4. Credentials → Create OAuth client → **Web application** → Authorized redirect URIs: `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback` (exact, no trailing slash). The **Connections** page shows this with a copy button.
  5. Wait ~5 minutes, then **Connections → Connect Gmail** and **Check inbox now**.
  - `redirect_uri_mismatch` = step 4 value differs. `access_denied` = mailbox missing from Test users.
- Automatic Gmail: Pub/Sub topic + authenticated push subscription to `https://<your-domain>/api/public/gmail-push`. Set `GMAIL_PUBSUB_SERVICE_ACCOUNT` to the service account the subscription signs with — the endpoint refuses every notification without it, because otherwise any Google service account could call it. Set `GMAIL_PUBSUB_AUDIENCE` if the subscription's audience differs from the endpoint URL.

## Database updates
Apply new files in `supabase/migrations/` after every upgrade (`npx supabase db push`). On Lovable Cloud, ask Lovable to
apply any migration that arrived through GitHub.

## Lovable services this build still uses
The app runs on your own server and database, but these features call Lovable-hosted services with `LOVABLE_API_KEY`:
- **AI** (vault extraction, tailoring, email classification) — `ai.gateway.lovable.dev`. To use another provider, change
  `src/lib/ai.server.ts`; it uses the OpenAI Responses API, which many "OpenAI-compatible" servers do not implement.
- **Gmail and Firecrawl** — through `connector-gateway.lovable.dev`, so mailbox reads pass through Lovable's gateway.
- **Continue with Google** sign-in — through Lovable's OAuth broker (`oauth.lovable.app`). On your own Supabase, use
  email sign-in or switch the button to `supabase.auth.signInWithOAuth`.
- **Package install** — about 100 entries in `bun.lock` download from Lovable's npm mirror; they are byte-identical to
  npmjs.org (the lockfile's integrity hashes match), so replacing that host with `registry.npmjs.org` also works.

## Costs
A small VPS (1 vCPU / 1 GB) plus free-tier Supabase covers personal use. AI and extraction are billed per use by those providers.

## Optional portal helper (browser worker)
Off by default. It opens official application forms, fills only routine fields (name, email, current employer),
takes a screenshot and stops with "waiting for you". It never submits, never solves security checks, and skips
visa, salary, legal and diversity questions.
```sh
docker compose --profile portal up -d --build
```
Then press **Prepare in portal** on an application. Needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`,
and the private `portal-screenshots` Storage bucket (created by the migrations).

The helper only opens `https` links, refuses any page or request that resolves to a private, loopback or link-local
address (such as a cloud metadata service), runs as a non-root user and starts the browser without your secrets in its
environment. To restrict it further, set `PORTAL_ALLOWED_HOSTS` (for example `lever.co,greenhouse.io,myworkdayjobs.com`).
For defence in depth, also block the worker container's outbound access to internal networks at the firewall.

## Backup and restore
- Backup: `pg_dump "$SUPABASE_DB_URL" -Fc -f nexus-$(date +%F).dump` (daily via cron is enough).
- Restore: `pg_restore -d "$SUPABASE_DB_URL" --clean nexus-YYYY-MM-DD.dump`.
- Each user can also download their own data from **Settings**.
