# Gate 2 stubs: 6.3, 6.4, 6.5, Phase 7, Phase 11, 12.4, 12.5, 12.6

**State:** gate-2 · **Needs:** Gate 2 ticked (a hosted pilot, only after 12.1–12.3, with at least 10 weekly active
users for 4 weeks), plus each item's prerequisites below
**File area:** none until a full brief exists · **Branch:** `agent/<id>-<slug>` · **PLAN.md:** Phases 6, 7, 11, 12

These are placeholders, not build instructions. **Detail each brief from `_TEMPLATE.md` before building**: when Gate 2
opens, the orchestrator checks the code as it then stands, compares with career-ops and JobSync first (PLAN.md "How to
work through this plan"), and turns the stub into a full brief in its own PR for the owner to review. Policy for all
of them: STRATEGY.md "Automation policy: supervised autopilot" and the Submission, job-board and personal-data rules in
AGENTS.md. **[owner]** must have confirmed the automation policy (STRATEGY.md open decision 4) before any Phase 6 code.

**6.3 Submission channels.** Goal: send an approved kit through the best permitted channel: employer-granted API
access (Greenhouse, Lever, Ashby application endpoints, keys per employer), then the browser extension, else a
copy-ready kit with the link. Needs 6.1–6.2 and 5.3 (answer bank). Constraints: nothing is submitted without the
user's approval (per application or batch); automatic submission is an opt-in setting, off by default, only for
allowlisted channels whose terms permit it (at first employer API access only), capped per day (default 10, max 30),
never LinkedIn or any job board; visa, salary and legal answers only from the user's answer bank; every submission
writes to the 6.4 proof log. Detail this brief before building.

**6.4 Proof log.** Goal: an append-only `application_submissions` record per submission (application, channel, time,
CV variant and file hash, cover letter, answers, confirmation text or email, screenshot path), shown on each
application, included in `exportMyData` and covered by account deletion (`src/lib/account.functions.ts`). Needs 6.2.
Constraints: no update or delete grants (append-only, enforced in SQL and tested in `src/test/migrations.test.ts`);
written by every channel including the extension; records only what was actually sent. Detail this brief before building.

**6.5 Autonomy modes.** Goal: make the saved autonomy setting real through a pure `src/lib/agentPolicy.ts`
(`policyFor(mode)`, unknown modes treated as Review-first) used by `runForUser` (`src/server/agentRunner.server.ts`)
and `syncGmailForUser` (`src/server/gmailSync.server.ts`), with the hints in `src/components/AgentPanel.tsx` rewritten.
Needs 6.3–6.4. Constraints: Review-first approves each kit, Guided approves batches, High autonomy only enables the
opt-in automatic submission where 6.3 allows it; no mode may bypass approval for other channels, the daily cap,
CAPTCHAs (always the user's) or the free-mail rule for inbox updates. Detail this brief before building.

**Phase 7 Browser extension.** Goal: a Manifest V3 extension in `extension/` that fills employer application forms
(Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Workday) in the user's own signed-in browser from the approved
kit and answer bank, porting field logic from `worker/adapters.mjs`, then retiring `worker/`. Needs 6.2–6.4.
Constraints: site access at click time (`activeTab`, optional host permissions); host permissions exclude linkedin.com
and the other job boards in `src/lib/jobSources.ts`, with a test; the user presses Submit (a batch-approved kit may
offer "Submit now" once); CAPTCHAs and security checks go to the user; proof goes to the 6.4 log; a scoped, revocable
token per user. **[owner]** publishes to the Chrome Web Store. Detail this brief before building.

**Phase 11 MCP server and chat apps.** Goal: a per-user authenticated remote MCP endpoint (for example `/api/mcp`)
with tools for today's queue, role search, tailoring, approve/skip, status and notes; then Claude connector and
ChatGPT app listings (**[owner]** submits). Needs Phase 6. Compare with JobSync's MCP server first. Constraints:
approvals through MCP follow Phase 6 exactly (same caps, allowlist, proof log); tool inputs and postings are untrusted
data; tailored output still passes `validateBulletProvenance`; Nexus never calls the separate LinkedIn Career Copilot
MCP (11.3). Detail this brief before building.

**12.4 Billing.** Goal: plans per market (weekly, monthly, per search), entitlements in the database, payment-provider
webhooks, and the 2.2 daily caps (`src/lib/usage.server.ts`) tied to plans. Needs 12.1 (**[owner]** chooses the
payment provider) and 12.3. Constraints: provider called through its public API with webhook signatures verified using
Web Crypto (no Node built-ins, no vendor build plugins); billing stays optional so self-hosting works without it; no
card data stored; prices stay out of this public repository (STRATEGY.md). Detail this brief before building.

**12.5 Institutions.** Goal: invite codes, seat management and a cohort dashboard of anonymised progress for
universities, bootcamps and employment programmes. Needs 12.4. Constraints: institutions see aggregates only, never a
member's vault, mail or applications without that member's explicit consent; the 12.2 inventory and retention rules
cover the new data; candidate-side only (employer-facing features need legal review, STRATEGY.md on the EU AI Act).
Detail this brief before building.

**12.6 Referrals.** Goal: referral credit when a user reports a hire. Needs 12.4. Constraints: the hire is self-reported
and never inferred from mail; credit is recorded in the database with the minimum personal data; no messages are sent
to referred people without their own action. Detail this brief before building.
