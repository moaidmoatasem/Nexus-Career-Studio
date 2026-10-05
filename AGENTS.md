<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- AI calls live in `src/lib/ai.functions.ts` (auth-protected server functions) using the helper in `src/lib/ai.server.ts`; keeps keys server-side and every call streamed.
- Tailored bullets always pass `validateBulletProvenance` before being saved; ungrounded claims must never reach the user.
- Fit scoring is pure and deterministic in `src/lib/scoring.ts`, shared by client display and server packs so scores always match.
- Sponsor matching runs in SQL (`match_sponsor_company_v3`, pg_trgm) so it scales to the full register.
- Jobs with `user_id` null are a shared catalog; user-added jobs are private via RLS.
- Job discovery decisions and application events are user-scoped durable records; the Today view is derived from those records rather than duplicated state.
- Public job URLs are extracted server-side through the connected Firecrawl gateway; inaccessible pages fail explicitly and never produce invented job fields.
- Per-user Gmail connection handles are encrypted at rest and used only by authenticated server functions; keeps mailbox credentials out of browser-accessible data.
- Recruitment mail advances an application only after a high-confidence multi-signal match; ambiguous messages stay in the user's review queue.
- LinkedIn and Indeed intake uses user-owned alert mail or public links, while employer ATS pages provide discovery; no consumer job-feed OAuth is implied.
- The product is open-source and self-hosted first; optional integrations must degrade to manual workflows so the core journey does not require always-on paid services.
- Server code uses Web Crypto and standard APIs only (no Node built-ins); keeps one codebase running on Docker/Node and edge workers.
- The background agent runs via a secret-protected heartbeat route called by an external scheduler, with per-user leases and an append-only activity log; works identically on Docker and edge hosting.
- The optional portal worker is a separate Playwright service that claims portal_tasks via a service-role RPC, fills only non-sensitive fields and always stops before submit; keeps browser automation off the web runtime.
