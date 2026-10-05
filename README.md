# Nexus Career Studio

An open-source, self-hosted career workspace for evidence-led job discovery, assisted applications, ATS resumes, recruitment-email tracking, and UK sponsor checks.

## Product boundaries

- Candidates make the final submission on each employer's official portal.
- Resume and application claims come only from verified Career Vault evidence.
- LinkedIn and Indeed work through user-owned alert emails and pasted public links; there is no unauthorized job-feed scraping.
- Workday, Lever, Greenhouse, and Ashby support uses public postings and assisted completion unless an employer grants API access.
- A Home Office register match confirms a sponsor licence, not sponsorship for a particular vacancy.

## Core workflow

1. Create an account.
2. Add career basics, verified evidence, and job preferences.
3. Discover public roles or paste a job link.
4. Review fit and UK sponsor evidence, then save a role.
5. Prepare a grounded application pack and ATS resume.
6. Complete the official employer portal and confirm submission.
7. Track confident recruitment updates from Gmail; manually review ambiguous messages.

## Local development

Use Node.js 20+ and Bun:

```sh
git clone https://github.com/moaidmoatasem/Nexus-Career-Studio.git
cd Nexus-Career-Studio
bun install
bun run dev
```

The app expects a Lovable Cloud-compatible database and authentication configuration. Never commit credentials. Configure these server-side values in your deployment environment:

- Database URL and publishable/server credentials
- `LOVABLE_API_KEY` for AI and connector requests
- `FIRECRAWL_API_KEY` for public job extraction
- `GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY` for per-user Gmail consent
- `APP_USER_CONNECTION_KEY_SECRET` for encrypted Gmail connection handles (`openssl rand -base64 32`)

The Gmail OAuth application must allow this redirect URI:

```text
https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback
```

## Optional automatic Gmail updates

Manual **Check inbox now** works without background infrastructure. Automatic updates additionally require:

- `GMAIL_PUBSUB_TOPIC`
- `GMAIL_PUBSUB_AUDIENCE`
- `GMAIL_PUBSUB_SERVICE_ACCOUNT` (required: the push endpoint rejects notifications without it)
- A Google Pub/Sub push subscription targeting `/api/public/gmail-push`

Gmail access is read-only. Per-user connection handles are encrypted in the database and never sent to the browser.

## Cost-conscious operation

- Prefer user-triggered discovery and bounded extraction.
- Keep Gmail on manual sync until automatic delivery is necessary.
- Provider usage and database hosting are paid by each deployment owner.
- The core workflow remains usable without Gmail push or a LinkedIn partnership.

## Data ownership

Career evidence, applications, and mailbox-derived records are scoped to the signed-in user. Deployment owners should define retention, backup, export, and account-deletion practices before inviting others.

## Lovable services

AI, Gmail, Firecrawl extraction and Google sign-in currently run through Lovable-hosted services. See
[DEPLOY.md](DEPLOY.md#lovable-services-this-build-still-uses) for what that means for a self-hosted install.

## Stack

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Lovable Cloud-compatible PostgreSQL and authentication
