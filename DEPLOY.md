# Self-hosting Nexus Career Studio

Nexus runs entirely on infrastructure you choose: a Node server (Docker or plain Node), a Supabase project for the
database and sign-in, and the providers you pick for AI, job-page reading and Gmail. No Lovable account or service is
needed, and every integration except the database is optional.

| Piece | Required? | What to use |
|---|---|---|
| Database + sign-in | Yes | Supabase — free tier at supabase.com, or [self-hosted](https://supabase.com/docs/guides/self-hosting/docker) |
| AI (CV extraction, tailoring, email triage) | For AI features | Any OpenAI-compatible API: OpenAI, OpenRouter, Gemini, Groq, or a local Ollama |
| Job-page reading | For "Paste job link" and "Find roles now" | Firecrawl — hosted (firecrawl.dev) or self-hosted |
| Gmail | For inbox tracking | Your own Google Cloud OAuth client |

## 1. Database and sign-in (Supabase)
1. Create a project at [supabase.com](https://supabase.com) (or run Supabase yourself).
2. Apply every migration in `supabase/migrations/`:
   ```sh
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   For a self-hosted database: `npx supabase db push --db-url "postgresql://postgres:<password>@<host>:5432/postgres"`.
3. **Authentication → URL Configuration**: set the Site URL to your `APP_URL` and add `https://<your-domain>/auth`
   (and `http://localhost:3000/auth` for local use) to the redirect URLs.
4. Email sign-in works out of the box. For **Continue with Google**, open **Authentication → Providers → Google**,
   enter a Google OAuth client ID and secret, and add `https://<project-ref>.supabase.co/auth/v1/callback` to that
   client's authorized redirect URIs in Google Cloud.
5. From **Project Settings → API**, copy the URL, the publishable (anon) key and the secret (service role) key into `.env`.
6. After you first sign in, open **Sponsor check → Check for a newer register** to import the official Home Office
   register (about 140,000 entries). The background agent refreshes it weekly after that.

## 2. Configure
```sh
cp .env.example .env
openssl rand -base64 32   # → APP_USER_CONNECTION_KEY_SECRET (encrypts stored Gmail tokens)
openssl rand -hex 32      # → AGENT_TICK_SECRET (protects the scheduler endpoint)
```
Set `APP_URL` to the address people use to open the app, without a trailing slash (for example
`https://nexus.example.com`). Keep `.env` out of git.

## 3. AI provider
Set `AI_BASE_URL`, `AI_MODEL` and, for hosted providers, `AI_API_KEY`. Any service that speaks the OpenAI
Chat Completions API works:

| Provider | `AI_BASE_URL` | `AI_MODEL` (example) |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `gpt-5-mini` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-5-mini` or any listed model |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.5-flash` |
| Ollama (local, free) | `http://localhost:11434/v1` (from Docker: `http://host.docker.internal:11434/v1`) | `qwen2.5:14b` |

Use any model your provider currently lists. Nexus asks for JSON-schema output and falls back to plain JSON mode
automatically when a provider doesn't support it; set `AI_RESPONSE_FORMAT=json_object` (or `none`) to skip the first
attempt. Optional: `AI_REASONING_EFFORT` (for models that accept `reasoning_effort`) and `AI_TIMEOUT_MS` (default
120000). Small local models extract and classify well but write weaker cover letters; the fact-check still removes any
number that isn't in your verified evidence.

## 4. Job-page reading (Firecrawl)
Set `FIRECRAWL_API_KEY` for [firecrawl.dev](https://firecrawl.dev), or `FIRECRAWL_API_URL` to point at your own
[Firecrawl](https://github.com/firecrawl/firecrawl) instance (its JSON extraction needs an LLM configured on that
instance). Without either, add roles by hand on **Discover → Add role** or **New application**.

## 5. Gmail
1. In [Google Cloud](https://console.cloud.google.com), create or pick a project and enable the **Gmail API**.
2. **OAuth consent screen**: user type External; add the scopes `openid`, `email` and
   `https://www.googleapis.com/auth/gmail.readonly`; while the app is in Testing, add each mailbox under **Test users**.
3. **Credentials → Create OAuth client → Web application**, with the authorized redirect URI
   `https://<your-domain>/oauth/gmail/return` (add `http://localhost:3000/oauth/gmail/return` for local use).
   **Connections** in the app shows the exact address with a copy button.
4. Put the client ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, restart, then use
   **Connections → Connect Gmail** and **Check inbox now**.

Nexus requests read-only access. The refresh token is stored encrypted with `APP_USER_CONNECTION_KEY_SECRET` and is
only used on the server; **Disconnect** revokes it at Google.

- `redirect_uri_mismatch`: the redirect URI in Google Cloud differs from `APP_URL` + `/oauth/gmail/return`.
- `access_denied`: the mailbox isn't listed under Test users.
- While the consent screen is in **Testing**, Google expires refresh tokens after about 7 days, so you'll see
  "Reconnect Gmail" weekly. Publishing an app that uses `gmail.readonly` requires Google's verification.
- Gmail connections made with an older Lovable-hosted build must be reconnected once.

**Automatic updates (optional).** Create a Pub/Sub topic, give `gmail-api-push@system.gserviceaccount.com` the
Pub/Sub Publisher role on it, and add a push subscription to `https://<your-domain>/api/public/gmail-push` with
authentication enabled for a service account. Then set `GMAIL_PUBSUB_TOPIC` (`projects/<project>/topics/<topic>`) and
`GMAIL_PUBSUB_SERVICE_ACCOUNT` (that service account's email; the endpoint rejects every push without it). Set
`GMAIL_PUBSUB_AUDIENCE` only if the subscription's audience isn't the endpoint URL. Without push, the background
agent still checks the inbox on its schedule.

## 6. Run with Docker Compose (recommended)
```sh
docker compose up -d --build
curl http://localhost:3000/api/public/health   # shows which capabilities are configured
```
The `scheduler` service wakes the agent every 15 minutes (`AGENT_INTERVAL_SECONDS`), so inbox checks, Gmail watch
renewal and follow-up reminders continue with your browser closed. Turn the agent on in **Mission Control**.
Put a reverse proxy (Caddy, nginx) in front for HTTPS; Google requires HTTPS redirect URIs outside localhost.
Upgrade: `git pull && docker compose up -d --build`. Roll back: check out the previous tag and rebuild.

Single container instead:
```sh
docker build --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=... \
  --build-arg VITE_SUPABASE_PROJECT_ID=... -t nexus .
docker run -d --env-file .env -p 3000:3000 --restart unless-stopped nexus
```

## 7. Without Docker
```sh
bun install
bun run build                 # builds a Node server; set NITRO_PRESET to target another host
node .output/server/index.mjs
```
`bun run dev` starts a development server on port 8080.

## Database updates
Apply new files in `supabase/migrations/` after every upgrade: `npx supabase db push`.

## Costs
A small VPS (1 vCPU / 1 GB) plus free-tier Supabase covers personal use. AI and Firecrawl are billed per use by
those providers, or cost nothing with Ollama and a self-hosted Firecrawl.

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

## Moving from a Lovable-hosted instance
The old instance's database stays where it is. Before switching, use **Settings → Download my data** there to keep a
copy of your Career Vault and applications, then set up the new Supabase project as above and sign up again.

## Backup and restore
- Backup: `pg_dump "$SUPABASE_DB_URL" -Fc -f nexus-$(date +%F).dump` (daily via cron is enough).
- Restore: `pg_restore -d "$SUPABASE_DB_URL" --clean nexus-YYYY-MM-DD.dump`.
- Each user can also download their own data from **Settings**.
