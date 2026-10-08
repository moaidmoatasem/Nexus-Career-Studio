# <id> <title>

**State:** ready | waiting-on-owner-ask | gate-1 | gate-2 · **Needs:** <tasks that must be merged first>
**File area:** <paths this task owns; other agents stay out of them while it is open>
**Branch:** `agent/<id>-<slug>` · **PLAN.md:** <link to the task line>

## Goal
What changes for the user, and why it matters (one short paragraph).

## Prior art to check first
career-ops or JobSync (see STRATEGY.md, "Where Nexus stands"): what they already do here, and whether this task should
contribute there or reuse their code (keeping the licence notice) instead of building. Say "none found" if so.

## What to build
Numbered steps. For each: the files to touch (existing paths, or "new"), the existing functions and patterns to reuse,
and the rules from AGENTS.md / STRATEGY.md that apply (provenance, untrusted data, job-board policy, personal data,
role- and country-agnostic).

## Database
New migration(s) under `supabase/migrations/` (never edit old ones), RLS policies, and any security-definer function.
Regenerate `src/integrations/supabase/types.ts` with `bun run db:types`; if that is impossible, hand-edit it and say so
in the PR. Extend `src/test/migrations.test.ts` for new SQL.

## Tests
Which test files to add or extend, and the cases they must cover.

## Acceptance checks
- [ ] `bun run check` passes (and `bun run e2e` if a user flow changed).
- [ ] Concrete, checkable behaviour…
- [ ] The task's box is ticked in PLAN.md and its row in `docs/agents/STATUS.md` links the PR.

## Out of scope
What this task must not do (and which task does it instead).

## Owner questions
Decisions only the owner can make. If one blocks the work, stop and ask it in the PR.
