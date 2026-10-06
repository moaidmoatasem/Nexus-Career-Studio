# Nexus Career Studio

An open-source, self-hosted career workspace for evidence-led job discovery, assisted applications, ATS resumes, recruitment-email tracking, and UK sponsor checks.

## Where it's going

Nexus set out to become an honest job-search agent for any role (working name "Job Seeker Mate"). A review of similar
projects in October 2026 found that [career-ops](https://github.com/career-ops-hq/career-ops), an MIT-licensed
open-source agent, already covers much of the planned agent work. The next steps are therefore deliberately small: keep
Nexus safe and working, offer its distinctive pieces (inbox reply tracking, UK sponsor checks) upstream to career-ops,
and test whether job seekers in the Middle East and North Africa who don't use developer tools want a hosted,
Arabic-first version. Nexus will never automate LinkedIn or other job boards. [STRATEGY.md](STRATEGY.md) explains the
decision and [PLAN.md](PLAN.md) the plan.

## Product boundaries

- Candidates make the final submission on each employer's official portal.
- Resume and application claims come only from verified Career Vault evidence.
- Job boards (LinkedIn, Indeed, Glassdoor, Bayt, Naukrigulf, GulfTalent, Wuzzuf) are never fetched, scraped or automated by the server, the portal worker or an extension; their terms forbid it. A pasted board link is refused with a request for the job text, and only employer postings (Greenhouse, Lever, Ashby, Workday and employer career pages) are read on the server. Board roles enter through your own alert emails (their title, employer and location become a lead whose link you open yourself) and text you paste, which completes the lead.
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

## Run it yourself

Nexus is standalone: it needs a Supabase project (free tier, or self-hosted) and, optionally, the AI, Firecrawl and
Google accounts you choose. No Lovable account or service is required.

```sh
git clone https://github.com/moaidmoatasem/Nexus-Career-Studio.git
cd Nexus-Career-Studio
cp .env.example .env      # fill in Supabase, then whichever integrations you want
docker compose up -d --build
```

For development, use Node.js 20+ and Bun: `bun install` then `bun run dev`.
[DEPLOY.md](DEPLOY.md) walks through the database, AI provider, Gmail and Firecrawl setup step by step.

| Integration | Settings | Without it |
|---|---|---|
| AI — any OpenAI-compatible API (OpenAI, OpenRouter, Gemini, Ollama…) | `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` | Add Career Vault items by hand; the ATS resume still works |
| Job-page reading — Firecrawl, hosted or self-hosted | `FIRECRAWL_API_KEY` or `FIRECRAWL_API_URL` | Add roles by hand |
| Gmail — your own Google OAuth client, read-only | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_USER_CONNECTION_KEY_SECRET` | Paste recruiter emails by hand |
| Automatic Gmail updates — Google Pub/Sub | `GMAIL_PUBSUB_TOPIC`, `GMAIL_PUBSUB_SERVICE_ACCOUNT` | The agent checks the inbox on its schedule |

Gmail access is read-only. Each user's refresh token is encrypted in the database and never sent to the browser.

## Cost-conscious operation

- Prefer user-triggered discovery and bounded extraction.
- Keep Gmail on manual sync until automatic delivery is necessary.
- Provider usage and database hosting are paid by each deployment owner.
- The core workflow remains usable without Gmail push or a LinkedIn partnership.

## Data ownership

Career evidence, applications, and mailbox-derived records are scoped to the signed-in user. Deployment owners should define retention, backup, export, and account-deletion practices before inviting others.

## Stack

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Supabase (PostgreSQL, authentication, storage)
- Nitro (Node server by default)
