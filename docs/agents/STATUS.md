# Task board

Kept up to date by the orchestrator. A worker adds its PR link to its row, in its own PR.

**States:**
- `ready`: any agent may take it.
- `owner`: needs the repository owner.
- `ask`: Phase 13; starts when the owner asks for it.
- `gate-1` / `gate-2`: waits until the owner ticks that gate in PLAN.md.

Two tasks may run at the same time only when their file areas (in each brief) don't overlap. Shared files that many
tasks touch (`src/integrations/supabase/types.ts`, `src/test/migrations.test.ts`, `src/lib/account.functions.ts`,
the sidebar list) take small, additive edits only; rebase on `main` before pushing.

## Ready now

| id | task | needs | brief | PR |
|---|---|---|---|---|
| N.1 | Complete data export and account deletion | — | [brief](briefs/N.1-complete-export-and-deletion.md) | |
| N.2 | Fact-check numbers written in Arabic-Indic digits | — | [brief](briefs/N.2-arabic-digit-provenance.md) | |
| 4.1 | Gmail live-push setup steps in DEPLOY.md (unverified until 4.3) | — | [brief](briefs/4.1-gmail-push-docs.md) | |

## Waiting on the owner

| id | task | what the owner does |
|---|---|---|
| 0.1b | Unlink the old Lovable copy | Confirm it's unlinked; then 1.5 deletes `.lovable/` |
| 0.2–0.5 | Run locally | Local Supabase (DEPLOY.md section 0) or a hosted project, plus AI, Google and Firecrawl keys |
| 3.1–3.5 | Deploy and live walk-through | A server and a domain |
| 4.2–4.3 | Gmail live push | After 3.x and 4.1 |
| A.0–A.5 | Track A, career-ops | Fork career-ops and attach the fork to a session |
| B.1, B.3–B.5 | Track B, demand test | Set the thresholds, run the interviews, decide on Gate 1 |

## Phase 13: when the owner asks

| id | task | brief |
|---|---|---|
| 13.1 | Import a Lovable export | [brief](briefs/13.1-import-lovable-export.md) |
| 13.2 | Optional error reporting (Sentry or GlitchTip) | [brief](briefs/13.2-error-reporting.md) |

## Gate 1

**Order within each phase:**
- **Phase 5:** 5.2, 5.3 and 5.4 can run in parallel. 5.1 can too, except its CV-variant link, which waits for 5.2.
- **Phase 9:** 9.1 first, then 9.2 and 9.3 in parallel, then 9.4, which needs 5.1 and 6.1.
- **Phase 10:**
  1. 10.1.
  2. 10.2, which runs alone because it touches most UI files.
  3. 10.3 and 10.4 in parallel.
  4. 10.5.
  5. 10.6, which needs 10.3, 10.4 and 5.2.
- **Phase 12:** 12.2 and 12.3 must be done before anyone else's data is stored on a server the owner runs. 12.3
  builds on N.1.

| id | task | needs | brief |
|---|---|---|---|
| 5.1 | Search profiles | Phase 1 | [brief](briefs/5.1-search-profiles.md) |
| 5.2 | CV variants | Phase 1 | [brief](briefs/5.2-cv-variants.md) |
| 5.3 | Answer bank | Phase 1 | [brief](briefs/5.3-answer-bank.md) |
| 5.4 | Outcome fields | Phase 1 | [brief](briefs/5.4-outcome-fields.md) |
| 9.1 | Visa country modules (UK first) | Phase 1; A.2 unless the owner waives it | [brief](briefs/9.1-visa-modules.md) |
| 9.2 | Gulf work-permit basics | 9.1 | [brief](briefs/9.2-gulf-basics.md) |
| 9.3 | More public sponsor data (NL, CA, US) | 9.1 | [brief](briefs/9.3-more-sponsor-data.md) |
| 9.4 | Visa status on role cards and a filter | 9.1, 5.1, 6.1 | [brief](briefs/9.4-visa-on-cards.md) |
| 10.1 | Language setting and direction | Phase 1 | [brief](briefs/10.1-direction.md) |
| 10.2 | Logical CSS | 10.1 | [brief](briefs/10.2-logical-css.md) |
| 10.3 | Self-hosted Arabic font | 10.2 | [brief](briefs/10.3-arabic-font.md) |
| 10.4 | Translations | 10.2 | [brief](briefs/10.4-translations.md) |
| 10.5 | Direction checks and screenshots | 10.3, 10.4 | [brief](briefs/10.5-rtl-checks.md) |
| 10.6 | Arabic and Gulf CVs | 10.3, 10.4, 5.2 | [brief](briefs/10.6-arabic-gulf-cvs.md) |
| 12.2 | Data inventory, retention and breach runbook | — | [brief](briefs/12.2-data-inventory.md) |
| 12.3 | Multi-tenant hardening and backups | N.1 | [brief](briefs/12.3-multitenant-hardening.md) |

Gate 1 also opens 8.3 (approvals in a messaging app), 6.1–6.2 (daily and approval queues) and the rest of Phase 8.
They have no briefs yet; the orchestrator writes them when the gate opens. PLAN.md's Gate 1 note says the first PR
after the tick rewrites these phases for the hosted product, so check each brief against PLAN.md before assigning it.

## Gate 2

6.3–6.5, Phase 7, Phase 11 and 12.4–12.6 have one-paragraph stubs in [gate-2-stubs.md](briefs/gate-2-stubs.md). Each
gets a full brief before anyone builds it.
